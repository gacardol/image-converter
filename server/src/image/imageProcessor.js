import sharp from 'sharp'
import fs from 'fs/promises'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const OUTPUT_DIR = path.resolve('output/images')
const TARGET_SIZE = 1600

/**
 * Ensure output directory exists
 */
async function ensureDir() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true })
}

/**
 * Download image from any URL
 * @param {string} imageUrl - Source image URL (meli, shopee, anywhere)
 * @param {string} id - Unique ID for filename
 * @returns {Promise<string>} Path to downloaded file
 */
export async function downloadImage(imageUrl, id) {
  await ensureDir()

  const response = await fetch(imageUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ao baixar ${imageUrl}`)
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
 * Remove background using rembg and apply white background
 * Falls back to just white-bg conversion if rembg not available
 * @param {string} inputPath - Path to source image
 * @param {string} id - Unique ID for filename
 * @returns {Promise<string>} Path to image with white background
 */
export async function removeBackground(inputPath, id) {
  await ensureDir()
  const noBgPath = path.join(OUTPUT_DIR, `${id}_nobg.png`)

  try {
    await execFileAsync('py', ['-m', 'rembg', 'i', inputPath, noBgPath], {
      timeout: 60000,
    })
    // Clean up will happen in convertToAmazonFormat
    return noBgPath
  } catch (err) {
    console.warn(`[Image] rembg indisponível: ${err.message}. Prosseguindo sem remoção de fundo.`)
    return inputPath // fallback: use original
  }
}

/**
 * Convert image to Amazon format: 1600x1600 JPG, white background, quality 92
 * @param {string} inputPath - Path to image (after bg removal or original)
 * @param {string} id - Unique ID for filename
 * @returns {Promise<string>} Path to final Amazon-ready image
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
    .jpeg({ quality: 92 })
    .toFile(finalPath)

  return finalPath
}

/**
 * Upload image to ImgBB and return public URL
 * @param {string} imagePath - Path to image file
 * @param {string} apiKey - ImgBB API key
 * @returns {Promise<string>} Public URL of uploaded image
 */
export async function uploadToImgBB(imagePath, apiKey) {
  const imageBuffer = await fs.readFile(imagePath)
  const base64 = imageBuffer.toString('base64')

  const formData = new URLSearchParams()
  formData.append('key', apiKey)
  formData.append('image', base64)

  const response = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`ImgBB upload failed: HTTP ${response.status} - ${text}`)
  }

  const data = await response.json()
  if (!data.success) {
    throw new Error(`ImgBB error: ${data.error?.message || 'unknown'}`)
  }

  // Use display_url for the public link
  return data.data.display_url
}

/**
 * Full pipeline: download → remove bg → convert → upload
 * @param {string} imageUrl - Source URL
 * @param {string} id - Unique ID
 * @returns {Promise<{finalPath: string, publicUrl: string|null, originalUrl: string}>}
 */
export async function processImage(imageUrl, id) {
  const imgbbKey = process.env.IMGBB_API_KEY

  // Step 1: Download
  const downloadedPath = await downloadImage(imageUrl, id)

  // Step 2: Remove background
  const noBgPath = await removeBackground(downloadedPath, id)

  // Step 3: Convert to Amazon format
  const finalPath = await convertToAmazonFormat(noBgPath, id)

  // Cleanup temp files
  if (noBgPath !== downloadedPath) {
    await fs.unlink(noBgPath).catch(() => {})
  }
  await fs.unlink(downloadedPath).catch(() => {})

  // Step 4: Upload to ImgBB (if key available)
  let publicUrl = null
  if (imgbbKey && imgbbKey !== 'your_imgbb_api_key_here') {
    try {
      publicUrl = await uploadToImgBB(finalPath, imgbbKey)
    } catch (err) {
      console.warn(`[Image] ImgBB upload falhou para ${id}: ${err.message}`)
    }
  }

  return { finalPath, publicUrl, originalUrl: imageUrl }
}

export default { downloadImage, removeBackground, convertToAmazonFormat, uploadToImgBB, processImage }
