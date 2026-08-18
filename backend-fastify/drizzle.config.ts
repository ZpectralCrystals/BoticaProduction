import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.BOTICA_DB_HOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.BOTICA_DB_PORT || process.env.DB_PORT || 5432),
    database: process.env.BOTICA_DB_NAME || process.env.DB_NAME || 'botica_db',
    user: process.env.BOTICA_DB_USER || process.env.DB_USER || 'postgres',
    password: process.env.BOTICA_DB_PASS || process.env.DB_PASS || '',
  },
  verbose: true,
  strict: true,
})
