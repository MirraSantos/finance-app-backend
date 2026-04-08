import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'

import authRoutes from './routes/auth.routes'
import transactionRoutes from './routes/transaction.routes'
import categoryRoutes from './routes/category.routes'
import budgetRoutes from './routes/budget.routes'
import goalRoutes from './routes/goal.routes'
import reportRoutes from './routes/report.routes'
import { errorHandler } from './middleware/errorHandler'

const app = express()
const PORT = process.env.PORT || 3001

// Security & utilities
app.use(helmet())
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
app.use(cookieParser())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API Routes
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/transactions', transactionRoutes)
app.use('/api/v1/categories', categoryRoutes)
app.use('/api/v1/budgets', budgetRoutes)
app.use('/api/v1/goals', goalRoutes)
app.use('/api/v1/reports', reportRoutes)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` })
})

// Global error handler (must be last)
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`)
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🔗 API: http://localhost:${PORT}/api/v1\n`)
})

export default app
