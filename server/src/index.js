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

// Serve processed images statically for preview
app.use('/images', express.static(path.resolve('output/images')))

// API routes
app.use('/api', apiRoutes)

// Serve built React frontend (production)
const publicDir = path.resolve(__dirname, '../public')
app.use(express.static(publicDir))

// SPA fallback: serve index.html for any non-API route
app.get('*', (req, res) => {
  const indexPath = path.join(publicDir, 'index.html')
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).json({ status: 'ok', message: 'API running. Build frontend with: npm run build' })
    }
  })
})

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`[Acelerador de Listagem] Server running on http://localhost:${PORT}`)
})
