import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import apiRoutes from './routes/api.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Serve processed images statically for preview
app.use('/images', express.static(path.resolve('output/images')))

// API routes
app.use('/api', apiRoutes)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`[Image Converter] Server running on http://localhost:${PORT}`)
})
