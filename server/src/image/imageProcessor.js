import sharp from 'sharp'
import fs from 'fs/promises'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const OUTPUT_DIR = path.resolve('output/images')
const TARGET_SIZE = 2000 // 2000x2000px square canvas

async function ensureDir() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true })
}

/**
 * Download image from any URL
 */
export async function downloadImage(imageUrl, id) {
  await ensureDir()

  const response = await fetch(imageUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' },
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const contentType = response.headers.get('content-type') || ''
  let ext = '.jpg'
  if (contentType.includes('webp') || imageUrl.includes('.webp')) ext = '.webp'
  else if (contentType.includes('png') || imageUrl.includes('.png')) ext = '.png'

  const filename = `${id}_original${ext}`
  const outputPath = path.join(OUTPUT_DIR, filename)

  const buffer = Buffer.from(await response.arrayBuffer())
  await fs.writeFile(outputPath, buffer)

  return outputPath
}

/**
 * Remove background using rembg with birefnet-general model
 * Then flatten transparent areas to pure white
 */
export async function removeBackground(inputPath, id) {
  await ensureDir()
  const noBgPath = path.join(OUTPUT_DIR, `${id}_nobg.png`)

  try {
    await execFileAsync('py', [
      '-m', 'rembg', 'i',
      '-m', 'birefnet-general',
      inputPath, noBgPath,
    ], { timeout: 120000 }) // 2min timeout (model download on first run)

    // Flatten: replace transparent areas with pure white
    const flattenedPath = path.join(OUTPUT_DIR, `${id}_flat.png`)
    await sharp(noBgPath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
      .then(async ({ data, info }) => {
        // Set any pixel with alpha < 128 to pure white
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) {
            data[i] = 255     // R
            data[i + 1] = 255 // G
            data[i + 2] = 255 // B
            data[i + 3] = 255 // A
          } else {
            data[i + 3] = 255 // Make fully opaque
          }
        }
        await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
          .png()
          .toFile(flattenedPath)
      })

    // Cleanup intermediate
    await fs.unlink(noBgPath).catch(() => {})
    return flattenedPath
  } catch (err) {
    console.warn(`[Image] rembg falhou: ${err.message}. Usando imagem original.`)
    return inputPath
  }
}

/**
 * Convert to Amazon format: 2000x2000 JPG, white background, quality 95
 */
export async function convertToAmazonFormat(inputPath, id) {
  await ensureDir()
  const finalPath = path.join(OUTPUT_DIR, `${id}_final.jpg`)

  await sharp(inputPath)
    .resize(TARGET_SIZE, TARGET_SIZE, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 95 })
    .toFile(finalPath)

  return finalPath
}

/**
 * Upload to ImgBB with retry
 */
export async function uploadToImgBB(imagePath, apiKey, retries = 1) {
  const imageBuffer = await fs.readFile(imagePath)
  const base64 = imageBuffer.toString('base64')

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const formData = new URLSearchParams()
      formData.append('key', apiKey)
      formData.append('image', base64)

      const response = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(30000),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`HTTP ${response.status}: ${text.substring(0, 100)}`)
      }

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error?.message || 'Upload failed')
      }

      return data.data.display_url
    } catch (err) {
      if (attempt < retries) {
        console.warn(`[ImgBB] Retry ${attempt + 1} for ${path.basename(imagePath)}`)
        await new Promise(r => setTimeout(r, 2000))
        continue
      }
      throw err
    }
  }
}

/**
 * Full pipeline: download → remove bg → convert → upload to ImgBB
 * Returns { finalPath, publicUrl, originalUrl, error }
 */
export async function processImage(imageUrl, id) {
  const imgbbKey = process.env.IMGBB_API_KEY

  // Step 1: Download
  const downloadedPath = await downloadImage(imageUrl, id)

  // Step 2: Remove background (birefnet-general model)
  const cleanedPath = await removeBackground(downloadedPath, id)

  // Step 3: Convert to 2000x2000 JPG
  const finalPath = await convertToAmazonFormat(cleanedPath, id)

  // Cleanup temp files
  if (cleanedPath !== downloadedPath) await fs.unlink(cleanedPath).catch(() => {})
  await fs.unlink(downloadedPath).catch(() => {})

  // Step 4: Upload to ImgBB
  let publicUrl = null
  if (imgbbKey && imgbbKey !== 'your_imgbb_api_key_here') {
    try {
      publicUrl = await uploadToImgBB(finalPath, imgbbKey)
    } catch (err) {
      console.warn(`[Image] ImgBB falhou para ${id}: ${err.message}`)
    }
  }

  return { finalPath, publicUrl, originalUrl: imageUrl }
}

export default { downloadImage, removeBackground, convertToAmazonFormat, uploadToImgBB, processImage }
