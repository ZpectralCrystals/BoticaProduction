import { drizzle } from 'drizzle-orm/node-postgres'
import type { Pool } from 'pg'
import * as schema from './schema.js'

// ══════════════════════════════════════════════════════════════════════════════
// DRIZZLE CLIENT — Compatible con pg.Pool existente
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Crea una instancia de Drizzle usando el Pool de pg existente.
 * Esto permite migración gradual: el mismo pool se usa para SQL raw y Drizzle.
 * 
 * @example
 * // En un plugin o ruta:
 * const db = createDrizzle(fastify.db)
 * const users = await db.select().from(schema.usuarios).where(eq(schema.usuarios.cestado, 'A'))
 */
export function createDrizzle(pool: Pool) {
  return drizzle(pool, { schema })
}

// Re-export schema para uso directo
export * from './schema.js'

// Re-export operadores comunes de Drizzle
export { eq, ne, gt, gte, lt, lte, and, or, isNull, isNotNull, inArray, notInArray, like, ilike, sql, asc, desc, count } from 'drizzle-orm'
