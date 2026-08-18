import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '../db/schema.js'

// ══════════════════════════════════════════════════════════════════════════════
// DRIZZLE PLUGIN — Integración con Fastify
// ══════════════════════════════════════════════════════════════════════════════

export type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>

declare module 'fastify' {
  interface FastifyInstance {
    drizzle: DrizzleDB
  }
}

const drizzlePlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Usa el pool de pg existente (del plugin db.ts)
  const db = drizzle(fastify.db, { schema })
  
  fastify.decorate('drizzle', db)
  
  fastify.log.info('Drizzle ORM inicializado sobre pool pg existente')
}

export default fp(drizzlePlugin, { 
  name: 'drizzle', 
  dependencies: ['db']  // Requiere que db.ts esté registrado primero
})
