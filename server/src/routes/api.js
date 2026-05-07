import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs/promises'
import multer from 'multer'
import ExcelJS from 'exceljs'
import archiver from 'archiver'
import { processImage } from '../image/imageProcessor.js'

const router = Router()
const UPLOAD_DIR = path.resolve('output/uploads')
const OUTPUT_DIR = path.resolve('output')

// Multer config
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
    cb(null, UPLOAD_DIR)
  },
  filename: (req, file, cb) => {
    cb(null, `upload_${Date.now()}${path.extname(file.originalname)}`)
  },
})
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (['.xlsx', '.xls', '.csv'].includes(ext)) cb(null, true)
    else cb(new Error('Use .xlsx, .xls ou .csv'))
  },
  limits: { fileSize: 10 * 1024 * 1024 },
})

// Job store
const jobs = new Map()

// POST /api/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' })

    const jobId = uuidv4()
    const filePath = req.file.path
    const ext = path.extname(req.file.originalname).toLowerCase()

    const { columns, rows } = await parseSpreadsheet(filePath, ext)
    if (rows.length === 0) return res.status(400).json({ error: 'Planilha vazia' })

    const { allImageColumns, primaryColumn } = detectImageColumns(columns, rows)

    const job = {
      id: jobId,
      status: 'uploaded',
      filePath,
      originalFilename: req.file.originalname,
      columns,
      rows,
      imageColumns: allImageColumns,
      primaryColumn,
      selectedColumns: [],
      results: [],
      progress: { current: 0, total: 0 },
      summary: { ok: 0, errors: 0, skipped: 0 },
      outputExcelPath: null,
      error: null,
    }
    jobs.set(jobId, job)

    res.json({
      jobId,
      columns,
      imageColumns: allImageColumns,
      primaryColumn,
      totalRows: rows.length,
      preview: rows.slice(0, 8).map(row => {
        const obj = {}
        columns.forEach((col, i) => { obj[col] = row[i] || '' })
        return obj
      }),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/process
router.post('/process', async (req, res) => {
  const { jobId, selectedColumns } = req.body
  const job = jobs.get(jobId)
  if (!job) return res.status(404).json({ error: 'Job não encontrado' })
  if (!selectedColumns || selectedColumns.length === 0) {
    return res.status(400).json({ error: 'Selecione pelo menos uma coluna de imagem' })
  }

  job.selectedColumns = selectedColumns
  job.status = 'processing'

  // Count total images
  let totalImages = 0
  for (const row of job.rows) {
    for (const colName of selectedColumns) {
      const colIdx = job.columns.indexOf(colName)
      if (colIdx >= 0 && row[colIdx] && isImageUrl(row[colIdx])) totalImages++
    }
  }
  job.progress = { current: 0, total: totalImages }
  job.summary = { ok: 0, errors: 0, skipped: 0 }

  runProcessing(job)
  res.json({ status: 'processing', totalImages })
})

// GET /api/status/:jobId
router.get('/status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId)
  if (!job) return res.status(404).json({ error: 'Job não encontrado' })
  res.json({
    status: job.status,
    progress: job.progress,
    summary: job.summary,
    error: job.error,
    results: job.status === 'done' ? job.results : undefined,
  })
})

// GET /api/download/:jobId/excel
router.get('/download/:jobId/excel', async (req, res) => {
  const job = jobs.get(req.params.jobId)
  if (!job || job.status !== 'done') return res.status(400).json({ error: 'Não concluído' })
  if (!job.outputExcelPath) return res.status(500).json({ error: 'Arquivo não gerado' })

  const filename = `convertido_${path.basename(job.originalFilename, path.extname(job.originalFilename))}.xlsx`
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.sendFile(job.outputExcelPath)
})

// GET /api/download/:jobId/images
router.get('/download/:jobId/images', async (req, res) => {
  const job = jobs.get(req.params.jobId)
  if (!job || job.status !== 'done') return res.status(400).json({ error: 'Não concluído' })

  const successResults = job.results.filter(r => r.success && r.finalPath)
  if (successResults.length === 0) return res.status(404).json({ error: 'Nenhuma imagem' })

  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', 'attachment; filename="imagens_amazon.zip"')

  const archive = archiver('zip', { zlib: { level: 6 } })
  archive.pipe(res)
  for (const result of successResults) {
    archive.file(result.finalPath, { name: path.basename(result.finalPath) })
  }
  await archive.finalize()
})

/**
 * Sequential batch processing
 */
async function runProcessing(job) {
  try {
    const results = []
    let processed = 0
    // Track status per row (for the Status column)
    const rowStatus = new Array(job.rows.length).fill(null)

    for (let rowIdx = 0; rowIdx < job.rows.length; rowIdx++) {
      let rowHasImage = false
      let rowSuccess = true
      let rowError = ''

      for (const colName of job.selectedColumns) {
        const colIdx = job.columns.indexOf(colName)
        if (colIdx < 0) continue

        const url = job.rows[rowIdx][colIdx]
        if (!url || !isImageUrl(url)) {
          if (url && !isImageUrl(url)) {
            // Has value but not a valid image URL — skip
          }
          continue
        }

        rowHasImage = true
        const id = `r${rowIdx}_c${colIdx}_${Date.now()}`

        try {
          const result = await processImage(url, id)
          const newUrl = result.publicUrl || url // fallback to original if ImgBB fails
          job.rows[rowIdx][colIdx] = newUrl

          results.push({
            rowIdx, colIdx, colName,
            originalUrl: url,
            newUrl,
            finalPath: result.finalPath,
            success: true,
          })
          job.summary.ok++
        } catch (err) {
          console.warn(`[Process] Row ${rowIdx + 1}, ${colName}: ${err.message}`)
          results.push({
            rowIdx, colIdx, colName,
            originalUrl: url,
            newUrl: url,
            finalPath: null,
            success: false,
            error: err.message,
          })
          job.summary.errors++
          rowSuccess = false
          rowError = err.message
        }

        processed++
        job.progress = { current: processed, total: job.progress.total }

        // 1.5s delay between images to avoid memory/rate issues
        await new Promise(r => setTimeout(r, 1500))
      }

      if (!rowHasImage) {
        rowStatus[rowIdx] = 'Skipped (sem URL)'
        job.summary.skipped++
      } else if (rowSuccess) {
        rowStatus[rowIdx] = 'OK'
      } else {
        rowStatus[rowIdx] = `Error: ${rowError.substring(0, 50)}`
      }
    }

    job.results = results

    // Generate output Excel with Status column
    job.outputExcelPath = await generateOutputExcel(job, rowStatus)
    job.status = 'done'

    console.log(`[Job ${job.id}] Done: ${job.summary.ok} OK, ${job.summary.errors} errors, ${job.summary.skipped} skipped`)
  } catch (err) {
    console.error(`[Job ${job.id}] Fatal:`, err.message)
    job.status = 'error'
    job.error = err.message
  }
}

/**
 * Generate output Excel: original columns + replaced URLs + Status column
 */
async function generateOutputExcel(job, rowStatus) {
  await fs.mkdir(path.join(OUTPUT_DIR, 'excel'), { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Produtos')

  // Header: original columns + Status
  const headers = [...job.columns, 'Status']
  sheet.addRow(headers)
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } }

  // Data rows
  for (let i = 0; i < job.rows.length; i++) {
    const row = [...job.rows[i]]
    row.push(rowStatus[i] || '')
    sheet.addRow(row)
  }

  // Auto-width
  sheet.columns.forEach((col, i) => {
    col.width = Math.min(Math.max((headers[i] || '').length + 4, 12), 50)
  })

  const outputPath = path.join(OUTPUT_DIR, 'excel', `output_${job.id.slice(0, 8)}.xlsx`)
  await workbook.xlsx.writeFile(outputPath)
  return outputPath
}

// --- Parsing ---

async function parseSpreadsheet(filePath, ext) {
  if (ext === '.csv') return parseCsv(filePath)
  return parseExcel(filePath)
}

async function parseExcel(filePath) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)
  const sheet = workbook.worksheets[0]
  if (!sheet || sheet.rowCount === 0) throw new Error('Planilha vazia')

  let headerRowNum = 1
  for (let i = 1; i <= Math.min(10, sheet.rowCount); i++) {
    const row = sheet.getRow(i)
    const nonEmpty = (row.values || []).filter(v => v != null && String(v).trim()).length
    if (nonEmpty >= 2) { headerRowNum = i; break }
  }

  const columns = []
  sheet.getRow(headerRowNum).eachCell((cell, colNum) => {
    columns[colNum - 1] = String(cell.value || '').trim()
  })

  const rows = []
  for (let i = headerRowNum + 1; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i)
    const values = []
    let hasData = false
    for (let c = 0; c < columns.length; c++) {
      const val = row.getCell(c + 1).value
      const str = val != null ? String(val).trim() : ''
      values.push(str)
      if (str) hasData = true
    }
    if (hasData) rows.push(values)
  }

  return { columns: columns.filter(Boolean), rows }
}

async function parseCsv(filePath) {
  const content = await fs.readFile(filePath, 'utf-8')
  const lines = content.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) throw new Error('CSV vazio')

  const sep = lines[0].includes(';') ? ';' : ','
  const columns = lines[0].split(sep).map(c => c.replace(/"/g, '').trim())

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(sep).map(v => v.replace(/"/g, '').trim())
    if (values.some(v => v)) rows.push(values)
  }

  return { columns, rows }
}

// --- Column Detection ---

const PRIMARY_IMAGE_PRIORITY = [
  'ps_item_cover_image',
  'imagem de capa',
  'imagem do produto',
  'imagem',
  'imagem 1',
  'image',
  'image 1',
  'link imagem 1',
  'foto',
  'foto principal',
  'cover_image',
  'main_image',
  'main-image-url',
]

const IMAGE_KEYWORDS = [
  'imagem', 'image', 'img', 'foto', 'photo', 'picture',
  'cover', 'capa', 'opção de imagem', 'url', 'link',
]

function detectImageColumns(columns, rows) {
  const candidates = []

  for (let i = 0; i < columns.length; i++) {
    const colLower = columns[i].toLowerCase().trim()

    // Check column name matches image keywords
    const nameMatch = IMAGE_KEYWORDS.some(k => colLower.includes(k))

    // Check if values contain image URLs
    let imageUrlCount = 0
    const sampleSize = Math.min(rows.length, 15)
    for (let r = 0; r < sampleSize; r++) {
      if (rows[r][i] && isImageUrl(rows[r][i])) imageUrlCount++
    }
    const hasImageUrls = imageUrlCount >= Math.max(1, sampleSize * 0.2)

    if (nameMatch || hasImageUrls) {
      candidates.push(columns[i])
    }
  }

  // Find primary by priority
  let primaryColumn = null
  for (const name of PRIMARY_IMAGE_PRIORITY) {
    const match = candidates.find(c => c.toLowerCase().trim() === name)
    if (match) { primaryColumn = match; break }
  }
  if (!primaryColumn) {
    for (const name of PRIMARY_IMAGE_PRIORITY) {
      const match = candidates.find(c => c.toLowerCase().includes(name))
      if (match) { primaryColumn = match; break }
    }
  }
  if (!primaryColumn && candidates.length > 0) {
    primaryColumn = candidates[0]
  }

  return { allImageColumns: candidates, primaryColumn }
}

function isImageUrl(str) {
  if (!str || typeof str !== 'string') return false
  if (!str.startsWith('http://') && !str.startsWith('https://')) return false
  // Check for image extensions or known image CDNs
  const lower = str.toLowerCase()
  const hasImageExt = /\.(jpg|jpeg|png|webp|gif|bmp|tiff)(\?|$|#)/i.test(lower)
  const isImageCdn = lower.includes('mlstatic') || lower.includes('imgbb') ||
    lower.includes('shopee') || lower.includes('cloudinary') ||
    lower.includes('imgur') || lower.includes('images')
  return hasImageExt || isImageCdn || lower.includes('image') || lower.includes('/img/')
}

export default router
