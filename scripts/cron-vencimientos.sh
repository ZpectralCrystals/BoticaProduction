#!/bin/bash
# ──────────────────────────────────────────────────────────
# Job de marcado de lotes vencidos
# Marca como VENCIDO los lotes cuya fecha de vencimiento ya pasó
# Cron recomendado: 0 6 * * * /path/to/scripts/cron-vencimientos.sh >> /var/log/botica-vencimientos.log 2>&1
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
DRY_RUN="${DRY_RUN:-false}"

log() {
  printf '[%s] [cron-vencimientos] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
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

log "Ejecutando marcado de lotes vencidos (dryRun=${DRY_RUN})"

RESPONSE="$(curl -sS -w '\n%{http_code}' \
  -X POST "${API_BASE}/consistencia/marcar-vencidos" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"dryRun\": ${DRY_RUN}}")"

HTTP_CODE="$(printf '%s' "${RESPONSE}" | tail -1)"
BODY="$(printf '%s' "${RESPONSE}" | sed '$d')"

if [ "${HTTP_CODE}" != "200" ]; then
  log "ERROR HTTP ${HTTP_CODE}: ${BODY}"
  exit 1
fi

TOTAL="$(extract_json_value "${BODY}" '.totalMarcados')"
if [ "${DRY_RUN}" = "true" ]; then
  log "Dry-run completado: ${TOTAL:-0} lote(s) requerirían ser marcados como VENCIDO"
else
  log "Marcado aplicado: ${TOTAL:-0} lote(s) actualizados a VENCIDO"
fi

log "Job finalizado OK"
