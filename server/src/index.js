import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import apiRoutes from './routes/api.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Serve built React frontend BEFORE API routes
const publicDir = path.resolve(__dirname, '../public')
app.use(express.static(publicDir))

// Serve processed images for preview
app.use('/images', express.static(path.resolve('output/images')))

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API routes
app.use('/api', apiRoutes)

// SPA catch-all: any non-API route serves index.html
app.get('*', (req, res) => {
  const indexPath = path.join(publicDir, 'index.html')
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).json({ error: 'Frontend not built. Run: npm run build' })
    }
  })
})

app.listen(PORT, () => {
  console.log(`[Acelerador de Listagem] Server running on http://localhost:${PORT}`)
})
