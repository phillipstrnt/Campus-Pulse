const express = require('express')
const cors = require('cors')
require('dotenv').config()

const app = express()
const port = Number(process.env.PORT) || 10000
const allowedOrigin = process.env.CLIENT_ORIGIN

app.use(cors({ origin: allowedOrigin || true }))
app.use(express.json({ limit: '1mb' }))

app.get('/', (_request, response) => {
  response.json({ name: 'Campus Pulse API', status: 'online', health: '/healthz' })
})

app.get('/healthz', (_request, response) => {
  response.json({
    status: 'ok',
    service: 'campus-pulse-api',
    databaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  })
})

app.use((error, _request, response, _next) => {
  console.error(error)
  response.status(500).json({ error: 'Internal server error' })
})

app.listen(port, '0.0.0.0', () => {
  console.log(`Campus Pulse API listening on ${port}`)
})
