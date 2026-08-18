#!/bin/bash
# ──────────────────────────────────────────────────────────
# Backup automático de PostgreSQL para Botica El Pueblo
# Uso: ./scripts/backup-db.sh
# Cron recomendado: 0 2 * * * cd /path/to/BoticaElPueblo && ./scripts/backup-db.sh >> backups/backup.log 2>&1
# ──────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${PROJECT_ROOT}/backend-fastify/.env}"

if [ -f "${ENV_FILE}" ]; then
  set -a
  . "${ENV_FILE}"
  set +a
fi

DB_NAME="${BOTICA_DB_NAME:-${PGDATABASE:-botica_db}}"
DB_USER="${BOTICA_DB_USER:-${PGUSER:-${USER:-postgres}}}"
DB_HOST="${BOTICA_DB_HOST:-${PGHOST:-localhost}}"
DB_PORT="${BOTICA_DB_PORT:-${PGPORT:-5432}}"
DB_PASS="${BOTICA_DB_PASS:-${PGPASSWORD:-}}"
BACKUP_DIR="${BACKUP_DIR:-${BOTICA_BACKUP_DIR:-${PROJECT_ROOT}/backups/database}}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
VERIFY_BACKUP="${VERIFY_BACKUP:-true}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/botica_${TIMESTAMP}.sql.gz"
TEMP_FILE="${BACKUP_FILE}.tmp"
PG_DUMP_BIN="${PG_DUMP_BIN:-}"

if [ -z "${PG_DUMP_BIN}" ]; then
  for candidate in \
    /opt/homebrew/opt/libpq/bin/pg_dump \
    /opt/homebrew/opt/postgresql@18/bin/pg_dump \
    /opt/homebrew/opt/postgresql@17/bin/pg_dump \
    /opt/homebrew/opt/postgresql@16/bin/pg_dump \
    /opt/homebrew/opt/postgresql@15/bin/pg_dump
  do
    if [ -x "${candidate}" ]; then
      PG_DUMP_BIN="${candidate}"
      break
    fi
  done
fi

if [ -z "${PG_DUMP_BIN}" ]; then
  PG_DUMP_BIN="$(command -v pg_dump || true)"
fi

if [ -z "${PG_DUMP_BIN}" ]; then
  echo "ERROR: pg_dump no encontrado. Instala PostgreSQL client o configura PG_DUMP_BIN."
  exit 1
fi

export PGPASSWORD="${DB_PASS}"

log() {
  printf '[%s] [backup-db] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

mkdir -p "${BACKUP_DIR}"

cleanup() {
  rm -f "${TEMP_FILE}"
}
trap cleanup EXIT

log "Iniciando backup ${DB_NAME} -> ${BACKUP_FILE}"
log "Cliente PostgreSQL: $("${PG_DUMP_BIN}" --version)"

"${PG_DUMP_BIN}" \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --no-owner \
  --no-privileges \
  --format=plain \
  | gzip > "${TEMP_FILE}"

if [ "${VERIFY_BACKUP}" = "true" ]; then
  gzip -t "${TEMP_FILE}"
  if ! gzip -dc "${TEMP_FILE}" >/dev/null; then
    log "ERROR: el backup no pasó la verificación de lectura"
    exit 1
  fi
fi

mv "${TEMP_FILE}" "${BACKUP_FILE}"
trap - EXIT

FILESIZE="$(du -h "${BACKUP_FILE}" | cut -f1)"
log "Backup completado: ${BACKUP_FILE} (${FILESIZE})"

DELETED="$(find "${BACKUP_DIR}" -name 'botica_*.sql.gz' -type f -mtime +${RETENTION_DAYS} -delete -print | wc -l | tr -d ' ')"
if [ "${DELETED}" -gt 0 ]; then
  log "Rotación aplicada: ${DELETED} backup(s) eliminados con más de ${RETENTION_DAYS} días"
fi

log "Backup finalizado OK"
