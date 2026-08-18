#!/bin/bash
# ──────────────────────────────────────────────────────────
# Job de reconciliación de stock
# Verifica y opcionalmente corrige bot_productos.nstock vs SUM(bot_lotes)
# Cron recomendado (dry-run diario): 0 7 * * * DRY_RUN=true /path/to/scripts/cron-reconciliacion.sh
# Cron recomendado (apply semanal):  0 3 * * 0 DRY_RUN=false /path/to/scripts/cron-reconciliacion.sh
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

API_BASE="${API_BASE:-http://127.0.0.1:3000/api/v1}"
DRY_RUN="${DRY_RUN:-true}"

log() {
  printf '[%s] [cron-reconciliacion] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

extract_json_value() {
  local json="$1"
  local key="$2"

  if command -v jq >/dev/null 2>&1; then
    printf '%s' "${json}" | jq -r "${key}"
  else
    printf '%s' "${json}" | sed -n "s/.*\"${key#*.}\":\\([^,}]*\\).*/\\1/p" | tr -d '"'
  fi
}

get_token() {
  if [ -n "${BOTICA_ADMIN_TOKEN:-}" ]; then
    printf '%s' "${BOTICA_ADMIN_TOKEN}"
    return 0
  fi

  if [ -z "${BOTICA_JOB_DNI:-}" ] || [ -z "${BOTICA_JOB_CLAVE:-}" ]; then
    log "ERROR: defina BOTICA_ADMIN_TOKEN o BOTICA_JOB_DNI/BOTICA_JOB_CLAVE"
    return 1
  fi

  local login_response login_code login_body token
  login_response="$(curl -sS -w '\n%{http_code}' \
    -X POST "${API_BASE}/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"dni\":\"${BOTICA_JOB_DNI}\",\"clave\":\"${BOTICA_JOB_CLAVE}\"}")"

  login_code="$(printf '%s' "${login_response}" | tail -1)"
  login_body="$(printf '%s' "${login_response}" | sed '$d')"

  if [ "${login_code}" != "200" ]; then
    log "ERROR login HTTP ${login_code}: ${login_body}"
    return 1
  fi

  if command -v jq >/dev/null 2>&1; then
    token="$(printf '%s' "${login_body}" | jq -r '.token // empty')"
  else
    token="$(printf '%s' "${login_body}" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"
  fi

  if [ -z "${token}" ]; then
    log "ERROR: login exitoso pero no se obtuvo token"
    return 1
  fi

  printf '%s' "${token}"
}

TOKEN="$(get_token)"

log "Iniciando verificación de consistencia (dryRun=${DRY_RUN})"

RESUMEN="$(curl -sS \
  -H "Authorization: Bearer ${TOKEN}" \
  "${API_BASE}/consistencia/resumen")"

ESTADO="$(extract_json_value "${RESUMEN}" '.estadoGeneral')"
TOTAL="$(extract_json_value "${RESUMEN}" '.totalInconsistencias')"
log "Resumen actual: estado=${ESTADO:-DESCONOCIDO} inconsistencias=${TOTAL:-0}"

RESPONSE="$(curl -sS -w '\n%{http_code}' \
  -X POST "${API_BASE}/consistencia/reconciliar" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"dryRun\": ${DRY_RUN}}")"

HTTP_CODE="$(printf '%s' "${RESPONSE}" | tail -1)"
BODY="$(printf '%s' "${RESPONSE}" | sed '$d')"

if [ "${HTTP_CODE}" != "200" ]; then
  log "ERROR HTTP ${HTTP_CODE}: ${BODY}"
  exit 1
fi

CORREGIDOS="$(extract_json_value "${BODY}" '.totalCorregidos')"
if [ "${DRY_RUN}" = "true" ]; then
  log "Dry-run completado: ${CORREGIDOS:-0} producto(s) requerirían corrección"
else
  log "Reconciliación aplicada: ${CORREGIDOS:-0} producto(s) corregidos"
fi

log "Job finalizado OK"
