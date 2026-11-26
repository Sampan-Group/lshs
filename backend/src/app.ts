import 'dotenv/config'
import express, {
  type Application,
  type ErrorRequestHandler,
  type RequestHandler,
} from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import authRoutes from './modules/auth/auth.routes.js'
import staffRoutes from './modules/auth/staff.routes.js'
import leadRoutes from './modules/leads/lead.routes.js'
import employeeRoutes from './modules/employees/employee.routes.js'
import paymentRoutes from './modules/payments/payment.routes.js'
import { env } from './config/env.js'
import { prisma } from './lib/prisma.js'
import { requireAuth, requireRole } from './modules/auth/auth.middleware.js'

const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Not found',
  })
}

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err)

  if (err?.code === 'P2022' || err?.code === 'P2021') {
    res.status(500).json({
      success: false,
      message:
        'Database schema is out of date. Run `npx prisma migrate deploy` and restart the server.',
    })
    return
  }

  res.status(500).json({
    success: false,
    message: 'Internal server error',
  })
}

const app: Application = express()
const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:3000'

app.use(
  cors({
    origin: (origin, callback) => {
      const localDevOrigin = process.env.NODE_ENV !== 'production'
        && !!origin
        && /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(origin)
      if (!origin || origin === frontendOrigin || localDevOrigin) {
        callback(null, true)
      } else {
        callback(new Error('CORS origin is not allowed'))
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  })
)

app.use(cookieParser())

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

app.get('/health', (_req, res) =>
  res.json({
    success: true,
    message: 'LSHS CRM OK',
  })
)

app.use('/api/auth', authRoutes)
app.use('/api/staff', staffRoutes)
app.use('/api/leads', requireAuth, requireRole('ADMIN', 'MANAGER', 'SALES_PERSON'), leadRoutes)
app.use('/api/employees', requireAuth, requireRole('ADMIN', 'MANAGER'), employeeRoutes)
app.use('/api/payments', paymentRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

const start = async () => {
  try {
    await prisma.$connect()
    console.log('✓ Database connected')

    app.listen(env.port, () => {
      console.log(`🚀 LSHS CRM running on http://localhost:${env.port}`)
      console.log(
        `   CORS origin: ${
          frontendOrigin
        }`
      )
    })
  } catch (err) {
    console.error('Failed to start server:', err)
    process.exit(1)
  }
}

// Vercel invokes the exported Express app for each request. Local development
// starts the HTTP listener here instead.
if (!process.env.VERCEL) start()

export default app
