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
    const ext = path.extname(file.originalname)
    cb(null, `upload_${Date.now()}${ext}`)
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

// In-memory job store
const jobs = new Map()

// POST /api/upload - Upload spreadsheet, return columns + preview
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' })

    const jobId = uuidv4()
    const filePath = req.file.path
    const ext = path.extname(req.file.originalname).toLowerCase()

    // Parse file
    const { columns, rows } = await parseSpreadsheet(filePath, ext)

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Planilha vazia' })
    }

    // Detect likely image columns
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

// POST /api/process - Start image processing
router.post('/process', async (req, res) => {
  const { jobId, selectedColumns } = req.body
  const job = jobs.get(jobId)
  if (!job) return res.status(404).json({ error: 'Job não encontrado' })
  if (!selectedColumns || selectedColumns.length === 0) {
    return res.status(400).json({ error: 'Selecione pelo menos uma coluna de imagem' })
  }

  job.selectedColumns = selectedColumns
  job.status = 'processing'

  // Count total images to process
  let totalImages = 0
  for (const row of job.rows) {
    for (const colName of selectedColumns) {
      const colIdx = job.columns.indexOf(colName)
      if (colIdx >= 0 && row[colIdx] && isUrl(row[colIdx])) totalImages++
    }
  }
  job.progress = { current: 0, total: totalImages }

  // Start processing in background
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
    error: job.error,
    results: job.status === 'done' ? job.results : undefined,
  })
})

// GET /api/download/:jobId/excel - Download new spreadsheet
router.get('/download/:jobId/excel', async (req, res) => {
  const job = jobs.get(req.params.jobId)
  if (!job || job.status !== 'done') {
    return res.status(400).json({ error: 'Processamento não concluído' })
  }

  if (!job.outputExcelPath) {
    return res.status(500).json({ error: 'Arquivo de saída não gerado' })
  }

  const filename = `convertido_${path.basename(job.originalFilename, path.extname(job.originalFilename))}.xlsx`
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.sendFile(job.outputExcelPath)
})

// GET /api/download/:jobId/images - Download all images as zip
router.get('/download/:jobId/images', async (req, res) => {
  const job = jobs.get(req.params.jobId)
  if (!job || job.status !== 'done') {
    return res.status(400).json({ error: 'Processamento não concluído' })
  }

  const successResults = job.results.filter(r => r.success && r.finalPath)
  if (successResults.length === 0) {
    return res.status(404).json({ error: 'Nenhuma imagem processada' })
  }

  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', 'attachment; filename="imagens_amazon.zip"')

  const archive = archiver('zip', { zlib: { level: 6 } })
  archive.pipe(res)

  for (const result of successResults) {
    const filename = path.basename(result.finalPath)
    archive.file(result.finalPath, { name: filename })
  }

  await archive.finalize()
})

/**
 * Background processing: download, convert, upload each image
 */
async function runProcessing(job) {
  try {
    const results = []
    let processed = 0

    for (let rowIdx = 0; rowIdx < job.rows.length; rowIdx++) {
      for (const colName of job.selectedColumns) {
        const colIdx = job.columns.indexOf(colName)
        if (colIdx < 0) continue

        const url = job.rows[rowIdx][colIdx]
        if (!url || !isUrl(url)) continue

        const id = `r${rowIdx}_c${colIdx}`

        try {
          const result = await processImage(url, id)
          // Replace URL in row data
          job.rows[rowIdx][colIdx] = result.publicUrl || result.finalPath
          results.push({
            rowIdx,
            colIdx,
            colName,
            originalUrl: url,
            newUrl: result.publicUrl || result.finalPath,
            finalPath: result.finalPath,
            success: true,
          })
        } catch (err) {
          console.warn(`[Process] Falha ${id}: ${err.message}`)
          results.push({
            rowIdx,
            colIdx,
            colName,
            originalUrl: url,
            newUrl: url, // keep original on failure
            finalPath: null,
            success: false,
            error: err.message,
          })
        }

        processed++
        job.progress = { current: processed, total: job.progress.total }

        // 1s delay between images
        await new Promise(r => setTimeout(r, 1000))
      }
    }

    job.results = results

    // Generate output Excel
    job.outputExcelPath = await generateOutputExcel(job)
    job.status = 'done'

    const success = results.filter(r => r.success).length
    console.log(`[Job ${job.id}] Concluído: ${success}/${results.length} imagens`)
  } catch (err) {
    console.error(`[Job ${job.id}] Erro:`, err.message)
    job.status = 'error'
    job.error = err.message
  }
}

/**
 * Generate output Excel with replaced image URLs
 */
async function generateOutputExcel(job) {
  await fs.mkdir(path.join(OUTPUT_DIR, 'excel'), { recursive: true })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Produtos')

  // Header row
  sheet.addRow(job.columns)
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } }

  // Data rows (with replaced URLs)
  for (const row of job.rows) {
    sheet.addRow(row)
  }

  // Auto-width
  sheet.columns.forEach((col, i) => {
    col.width = Math.min(Math.max((job.columns[i] || '').length + 4, 12), 50)
  })

  const outputPath = path.join(OUTPUT_DIR, 'excel', `output_${job.id.slice(0, 8)}.xlsx`)
  await workbook.xlsx.writeFile(outputPath)
  return outputPath
}

/**
 * Parse spreadsheet (xlsx or csv)
 */
async function parseSpreadsheet(filePath, ext) {
  if (ext === '.csv') return parseCsv(filePath)
  return parseExcel(filePath)
}

async function parseExcel(filePath) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)
  const sheet = workbook.worksheets[0]
  if (!sheet || sheet.rowCount === 0) throw new Error('Planilha vazia')

  // Find header row
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

/**
 * Priority list for the main/cover image column (first match wins)
 */
const PRIMARY_IMAGE_PRIORITY = [
  'ps_item_cover_image',
  'imagem',
  'imagem 1',
  'image',
  'image 1',
  'link imagem 1',
  'foto',
  'foto principal',
  'cover_image',
  'main_image',
]

/**
 * Detect which columns likely contain image URLs
 * Returns { allImageColumns, primaryColumn }
 */
function detectImageColumns(columns, rows) {
  const candidates = []
  const imageKeywords = ['imagem', 'image', 'img', 'foto', 'photo', 'picture', 'url', 'link', 'cover']

  for (let i = 0; i < columns.length; i++) {
    const colLower = columns[i].toLowerCase()
    const nameMatch = imageKeywords.some(k => colLower.includes(k))

    // Check if column values look like URLs
    let urlCount = 0
    const sampleSize = Math.min(rows.length, 10)
    for (let r = 0; r < sampleSize; r++) {
      if (rows[r][i] && isUrl(rows[r][i])) urlCount++
    }
    const hasUrls = urlCount >= sampleSize * 0.3

    if (nameMatch || hasUrls) {
      candidates.push(columns[i])
    }
  }

  // Find primary column by priority
  let primaryColumn = null
  for (const priorityName of PRIMARY_IMAGE_PRIORITY) {
    const match = candidates.find(c => c.toLowerCase() === priorityName)
    if (match) {
      primaryColumn = match
      break
    }
  }

  // If no exact match, try partial match on priority list
  if (!primaryColumn) {
    for (const priorityName of PRIMARY_IMAGE_PRIORITY) {
      const match = candidates.find(c => c.toLowerCase().includes(priorityName))
      if (match) {
        primaryColumn = match
        break
      }
    }
  }

  // Fallback: first candidate
  if (!primaryColumn && candidates.length > 0) {
    primaryColumn = candidates[0]
  }

  return { allImageColumns: candidates, primaryColumn }
}

function isUrl(str) {
  if (!str || typeof str !== 'string') return false
  return str.startsWith('http://') || str.startsWith('https://')
}

export default router
