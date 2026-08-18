import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import closeWithGrace from 'close-with-grace'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import dbPlugin from './plugins/db.js'
import authPlugin from './plugins/auth.js'
import errorHandlerPlugin from './plugins/error-handler.js'
import appointmentsRoutes from './routes/appointments.routes.js'
import auditRoutes from './routes/audit.routes.js'
import authRoutes from './routes/auth.routes.js'
import debtorsRoutes from './routes/debtors.routes.js'
import doctorsRoutes from './routes/doctors.routes.js'
import historiesRoutes from './routes/histories.routes.js'
import miscInventoryRoutes from './routes/misc-inventory.routes.js'
import cajaRoutes from './routes/caja.routes.js'
import dashboardRoutes from './routes/dashboard.routes.js'
import inventoryRoutes from './routes/inventory.routes.js'
import patientsRoutes from './routes/patients.routes.js'
import prescriptionsRoutes from './routes/prescriptions.routes.js'
import profileRoutes from './routes/profile.routes.js'
import providersRoutes from './routes/providers.routes.js'
import purchasesRoutes from './routes/purchases.routes.js'
import rentalsRoutes from './routes/rentals.routes.js'
import reportsRoutes from './routes/reports.routes.js'
import salesRoutes from './routes/sales.routes.js'
import servicesRoutes from './routes/services.routes.js'
import transfersRoutes from './routes/transfers.routes.js'
import usersRoutes from './routes/users.routes.js'
import kardexRoutes from './routes/kardex.routes.js'
import localesRoutes from './routes/locales.routes.js'
import almacenesRoutes from './routes/almacenes.routes.js'
import lotesRoutes from './routes/lotes.routes.js'
import consistenciaRoutes from './routes/consistencia.routes.js'
import trasladosAlmacenRoutes from './routes/traslados-almacen.routes.js'
import systemRoutes from './routes/system.routes.js'
import ajustesRoutes from './routes/ajustes.routes.js'
import cxpRoutes from './routes/cxp.routes.js'
import { checkSchema, formatSchemaReport } from './lib/schema-check.js'
import drizzlePlugin from './plugins/drizzle.js'

const isProduction = process.env.NODE_ENV === 'production'

function vercelOrigin() {
  const host = process.env.VERCEL_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL
  return host ? `https://${host}` : ''
}

function resolveCorsOrigins() {
  const raw = process.env.CORS_ORIGIN || vercelOrigin()
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  if (isProduction && origins.length === 0) {
    throw new Error('CORS_ORIGIN es obligatoria en producción')
  }

  if (!isProduction && origins.length === 0) {
    return ['http://localhost:5173', 'http://localhost:5174']
  }

  return origins
}

const app = Fastify({
  trustProxy:
    process.env.TRUST_PROXY === 'true' ||
    process.env.TRUST_PROXY === '1' ||
    isProduction,
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport:
      process.env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
  },
})

let buildPromise: Promise<FastifyInstance> | null = null

async function registerPlugins() {
  const corsOrigins = resolveCorsOrigins()

  await app.register(cors, {
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  })

  await app.register(cookie)

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'botica-fastify-local-secret',
  })

  if (process.env.NODE_ENV !== 'production') {
    await app.register(swagger, {
      openapi: {
        info: {
          title: 'Botica El Pueblo API',
          description: 'Fastify API para migración del sistema Botica El Pueblo',
          version: '1.0.0',
        },
      },
    })
    await app.register(swaggerUi, {
      routePrefix: '/documentation',
    })
  }

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false,
  })

  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.ip,
    skipOnError: true,
    errorResponseBuilder: (_request, context: { after: string }) => ({
      error: 'TOO_MANY_REQUESTS',
      message: `Demasiadas solicitudes. Intente de nuevo en ${context.after}.`,
    }),
  })

  await app.register(dbPlugin)
  await app.register(drizzlePlugin)  // Drizzle ORM sobre pool pg existente
  await app.register(authPlugin)
  await app.register(errorHandlerPlugin)
}

async function registerRoutes() {
  const buildReadinessPayload = async () => {
    let dbOk = false
    let dbLatencyMs = 0
    let productCount = 0
    let errorMessage: string | null = null
    try {
      const start = Date.now()
      const r = await app.db.query('SELECT COUNT(*)::INT AS c FROM bot_productos WHERE cestado = $1', ['A'])
      dbLatencyMs = Date.now() - start
      dbOk = true
      productCount = Number(r.rows[0]?.c ?? 0)
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'DB_UNAVAILABLE'
      app.log.error({ error }, 'Health readiness check failed')
    }

    return {
      statusCode: dbOk ? 200 : 503,
      payload: {
        status: dbOk ? 'ok' : 'degraded',
        check: 'readiness',
        runtime: 'fastify',
        timestamp: new Date().toISOString(),
        uptimeSec: Math.round(process.uptime()),
        db: {
          connected: dbOk,
          latencyMs: dbLatencyMs,
          activeProducts: productCount,
          error: errorMessage,
        },
      },
    }
  }

  const livenessHandler = async (_request: unknown, reply: FastifyReply) => {
    return reply.code(200).send({
      status: 'ok',
      check: 'liveness',
      runtime: 'fastify',
      timestamp: new Date().toISOString(),
      uptimeSec: Math.round(process.uptime()),
    })
  }

  const readinessHandler = async (_request: unknown, reply: FastifyReply) => {
    const readiness = await buildReadinessPayload()
    return reply.code(readiness.statusCode).send(readiness.payload)
  }

  app.get('/health/live', livenessHandler)
  app.get('/health/ready', readinessHandler)
  app.get('/health', readinessHandler)
  app.get('/api/health/live', livenessHandler)
  app.get('/api/health/ready', readinessHandler)
  app.get('/api/health', readinessHandler)

  await app.register(
    async (instance) => {
      await instance.register(authRoutes, { prefix: '/auth' })
      await instance.register(appointmentsRoutes, { prefix: '/citas' })
      await instance.register(auditRoutes, { prefix: '/auditoria' })
      await instance.register(dashboardRoutes, { prefix: '/dashboard' })
      await instance.register(cajaRoutes, { prefix: '/caja' })
      await instance.register(debtorsRoutes, { prefix: '/deudores' })
      await instance.register(doctorsRoutes, { prefix: '/medicos' })
      await instance.register(historiesRoutes, { prefix: '/historial' })
      await instance.register(inventoryRoutes, { prefix: '/inventario' })
      await instance.register(miscInventoryRoutes, { prefix: '/inventario-var' })
      await instance.register(patientsRoutes, { prefix: '/pacientes' })
      await instance.register(prescriptionsRoutes, { prefix: '/recetas' })
      await instance.register(profileRoutes, { prefix: '/perfil' })
      await instance.register(providersRoutes, { prefix: '/proveedores' })
      await instance.register(purchasesRoutes, { prefix: '/compras' })
      await instance.register(rentalsRoutes, { prefix: '/alquileres' })
      await instance.register(reportsRoutes, { prefix: '/reportes' })
      await instance.register(salesRoutes, { prefix: '/ventas' })
      await instance.register(servicesRoutes, { prefix: '/servicios' })
      await instance.register(transfersRoutes, { prefix: '/transferencias' })
      await instance.register(usersRoutes, { prefix: '/usuarios' })
      await instance.register(kardexRoutes, { prefix: '/kardex' })
      await instance.register(lotesRoutes, { prefix: '/lotes' })
      await instance.register(localesRoutes, { prefix: '/locales' })
      await instance.register(almacenesRoutes, { prefix: '/almacenes' })
      await instance.register(consistenciaRoutes, { prefix: '/consistencia' })
      await instance.register(trasladosAlmacenRoutes, { prefix: '/traslados-almacen' })
      await instance.register(systemRoutes, { prefix: '/system' })
      await instance.register(ajustesRoutes, { prefix: '/ajustes' })
      await instance.register(cxpRoutes, { prefix: '/cuentas-por-pagar' })
    },
    { prefix: '/api/v1' },
  )
}

function validateRuntimeConfig() {
  const jwtSecret = process.env.JWT_SECRET

  if (isProduction) {
    if (!jwtSecret) {
      throw new Error('JWT_SECRET es obligatoria en producción')
    }
    if (jwtSecret.length < 32) {
      throw new Error(`JWT_SECRET es demasiado corta (${jwtSecret.length} caracteres; mínimo 32)`)
    }
    if (resolveCorsOrigins().length === 0) {
      throw new Error('CORS_ORIGIN es obligatoria en producción fuera de Vercel')
    }
  } else if (!jwtSecret) {
    app.log.warn(
      'JWT_SECRET no está seteada — usando secreto de desarrollo inseguro. ' +
      'NUNCA usar este modo en producción.',
    )
  }
}

export function buildApp(): Promise<FastifyInstance> {
  if (!buildPromise) {
    buildPromise = (async () => {
      validateRuntimeConfig()
      await registerPlugins()
      await registerRoutes()
      await app.ready()

      const schemaResult = await checkSchema(app.db)
      if (!schemaResult.ok) {
        throw new Error(
          `${formatSchemaReport(schemaResult)}\n` +
          'La base de datos está desalineada con el código. Ejecute las migraciones pendientes.',
        )
      }
      app.log.info(schemaResult.summary)
      return app
    })()
  }
  return buildPromise
}

async function start() {
  try {
    const instance = await buildApp()

    const port = Number(process.env.PORT || 3000)
    const host = process.env.HOST || '127.0.0.1'

    await instance.listen({ port, host })
    instance.log.info(`Server listening on http://${host}:${port}`)

    closeWithGrace({ delay: 5000 }, async ({ signal, err }) => {
      if (err) instance.log.error(err)
      instance.log.info(`${signal} received, closing server...`)
      await instance.close()
    })
  } catch (error) {
    app.log.error(error)
    process.exitCode = 1
  }
}

const isEntrypoint = Boolean(
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url),
)

if (isEntrypoint) {
  void start()
}
