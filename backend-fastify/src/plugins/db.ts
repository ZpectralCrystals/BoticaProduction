import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import pg from 'pg'

const { Pool } = pg

declare module 'fastify' {
  interface FastifyInstance {
    db: pg.Pool
  }
}

const dbPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    ''
  const sslMode = String(
    process.env.BOTICA_DB_SSL ||
      process.env.DB_SSL ||
      process.env.PGSSLMODE ||
      '',
  ).toLowerCase()
  const useSsl = ['1', 'true', 'require', 'prefer', 'verify-ca', 'verify-full'].includes(sslMode)
  const rejectUnauthorized = !['0', 'false', 'no'].includes(
    String(
      process.env.BOTICA_DB_SSL_REJECT_UNAUTHORIZED ||
        process.env.DB_SSL_REJECT_UNAUTHORIZED ||
        'true',
    ).toLowerCase(),
  )

  const pool = new Pool({
    ...(connectionString
      ? { connectionString }
      : {
          host: process.env.BOTICA_DB_HOST || process.env.DB_HOST || 'localhost',
          port: Number(process.env.BOTICA_DB_PORT || process.env.DB_PORT || 5432),
          database: process.env.BOTICA_DB_NAME || process.env.DB_NAME || 'botica_db',
          user: process.env.BOTICA_DB_USER || process.env.DB_USER || process.env.USER || 'postgres',
          password:
            process.env.BOTICA_DB_PASS ||
            process.env.BOTICA_DB_PASSWORD ||
            process.env.DB_PASS ||
            process.env.DB_PASSWORD ||
            '',
        }),
    ...(useSsl ? { ssl: { rejectUnauthorized } } : {}),
  })

  await pool.query('SELECT 1')
  fastify.decorate('db', pool)

  fastify.addHook('onClose', async () => {
    await pool.end()
  })
}

export default fp(dbPlugin, { name: 'db' })
