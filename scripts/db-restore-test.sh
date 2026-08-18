#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Uso: $0 /ruta/backup.dump [/ruta/post_restore.sql]" >&2
  exit 2
fi

DUMP_PATH="$1"
POST_RESTORE_SQL="${2:-}"
if [[ ! -f "$DUMP_PATH" ]]; then
  echo "Dump no existe: $DUMP_PATH" >&2
  exit 2
fi
if [[ -n "$POST_RESTORE_SQL" && ! -f "$POST_RESTORE_SQL" ]]; then
  echo "SQL post-restore no existe: $POST_RESTORE_SQL" >&2
  exit 2
fi

TS="$(date +%Y%m%d_%H%M%S)"
DB_NAME="botica_restore_test_${TS}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cleanup() {
  if [[ "${KEEP_RESTORE_DB:-0}" != "1" ]]; then
    dropdb --if-exists "$DB_NAME" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

createdb "$DB_NAME"
pg_restore --no-owner --no-privileges -d "$DB_NAME" "$DUMP_PATH"

if [[ -n "$POST_RESTORE_SQL" ]]; then
  psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$POST_RESTORE_SQL" >/dev/null
fi

"$SCRIPT_DIR/db-audit-supabase-ready.sh" "$DB_NAME"

echo "restore_test_db=$DB_NAME"
if [[ "${KEEP_RESTORE_DB:-0}" == "1" ]]; then
  echo "KEEP_RESTORE_DB=1 activo; DB queda creada."
else
  echo "DB temporal sera eliminada al salir."
fi
