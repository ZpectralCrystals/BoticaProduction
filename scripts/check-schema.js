#!/usr/bin/env node
/**
 * check-schema.js — Wrapper raíz
 * Delega al script dentro de backend-fastify donde pg está instalado.
 * Uso: node check-schema.js [--json]
 */
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const scriptPath = path.join(__dirname, 'backend-fastify', 'check-schema.js')

const result = spawnSync('node', [scriptPath, ...process.argv.slice(2)], {
  cwd: path.join(__dirname, 'backend-fastify'),
  stdio: 'inherit',
  env: process.env,
})

process.exit(result.status ?? 1)
