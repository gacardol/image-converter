import sharp from 'sharp'
import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const OUTPUT_DIR = path.resolve('output/images')
const TARGET_SIZE = 2000
const PRODUCT_FILL = 0.85 // Product fills 85% of canvas

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

  if (!response.ok) throw new Error(`HTTP ${response.status}`)

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
 * Remove background using rembg as Python library
 * Returns path to transparent PNG
 */
export async function removeBackground(inputPath, id) {
  await ensureDir()
  const noBgPath = path.join(OUTPUT_DIR, `${id}_nobg.png`)

  const pythonScript = `
import sys
from rembg import remove

input_path = sys.argv[1]
output_path = sys.argv[2]

with open(input_path, 'rb') as f:
    input_data = f.read()

output_data = remove(input_data)

with open(output_path, 'wb') as f:
    f.write(output_data)

print('OK')
`

  try {
    const scriptPath = path.join(OUTPUT_DIR, `${id}_rembg.py`)
    await fs.writeFile(scriptPath, pythonScript)

    await execAsync(`py "${scriptPath}" "${inputPath}" "${noBgPath}"`, {
      timeout: 120000,
    })

    await fs.unlink(scriptPath).catch(() => {})
    await fs.access(noBgPath)
    return noBgPath
  } catch (err) {
    console.warn(`[Image] rembg falhou: ${err.message}`)
    return null // Signal that bg removal failed
  }
}

/**
 * Create final Amazon image:
 * - 2000x2000 pure white canvas
 * - Product resized to 85% of canvas, centered
 * - JPEG quality 95
 */
export async function createAmazonImage(inputPath, id, hasBgRemoved) {
  await ensureDir()
  const finalPath = path.join(OUTPUT_DIR, `${id}_final.jpg`)

  // Calculate product size (85% of canvas)
  const productMaxSize = Math.round(TARGET_SIZE * PRODUCT_FILL) // 1700px

  if (hasBgRemoved) {
    // Input is transparent PNG from rembg
    // Resize product to fit within 1700x1700, then composite on white canvas
    const productBuffer = await sharp(inputPath)
      .resize(productMaxSize, productMaxSize, {
        fit: 'inside', // Maintain aspect ratio, fit within box
        withoutEnlargement: false,
      })
      .png()
      .toBuffer()

    // Get resized product dimensions for centering
    const productMeta = await sharp(productBuffer).metadata()
    const offsetX = Math.round((TARGET_SIZE - productMeta.width) / 2)
    const offsetY = Math.round((TARGET_SIZE - productMeta.height) / 2)

    // Create white canvas and composite product centered
    await sharp({
      create: {
        width: TARGET_SIZE,
        height: TARGET_SIZE,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite([{
        input: productBuffer,
        top: offsetY,
        left: offsetX,
      }])
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 95 })
      .toFile(finalPath)
  } else {
    // Fallback: no bg removal, just resize with white padding
    await sharp(inputPath)
      .resize(productMaxSize, productMaxSize, {
        fit: 'inside',
        withoutEnlargement: false,
      })
      .toBuffer()
      .then(async (resizedBuffer) => {
        const meta = await sharp(resizedBuffer).metadata()
        const offsetX = Math.round((TARGET_SIZE - meta.width) / 2)
        const offsetY = Math.round((TARGET_SIZE - meta.height) / 2)

        await sharp({
          create: {
            width: TARGET_SIZE,
            height: TARGET_SIZE,
            channels: 3,
            background: { r: 255, g: 255, b: 255 },
          },
        })
          .composite([{
            input: resizedBuffer,
            top: offsetY,
            left: offsetX,
          }])
          .flatten({ background: { r: 255, g: 255, b: 255 } })
          .jpeg({ quality: 95 })
          .toFile(finalPath)
      })
  }

  return finalPath
}

/**
 * Upload to ImgBB (free, no expiration)
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
      if (!data.success) throw new Error(data.error?.message || 'Upload failed')
      return data.data.display_url
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 2000))
        continue
      }
      throw err
    }
  }
}

/**
 * Full pipeline: download → rembg → white canvas 2000x2000 → ImgBB
 */
export async function processImage(imageUrl, id) {
  const imgbbKey = process.env.IMGBB_API_KEY

  // Step 1: Download
  const downloadedPath = await downloadImage(imageUrl, id)

  // Step 2: Remove background
  const noBgPath = await removeBackground(downloadedPath, id)
  const bgRemoved = noBgPath !== null

  // Step 3: Create Amazon image (white canvas, product centered at 85%)
  const inputForFinal = bgRemoved ? noBgPath : downloadedPath
  const finalPath = await createAmazonImage(inputForFinal, id, bgRemoved)

  // Cleanup temp files
  if (bgRemoved && noBgPath) await fs.unlink(noBgPath).catch(() => {})
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

  return { finalPath, publicUrl, originalUrl: imageUrl, bgRemoved }
}

export default { downloadImage, removeBackground, createAmazonImage, uploadToImgBB, processImage }
