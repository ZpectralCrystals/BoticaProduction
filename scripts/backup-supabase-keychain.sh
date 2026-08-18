#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
KEYCHAIN_SERVICE="${BOTICA_KEYCHAIN_SERVICE:-com.boticaelpueblo.supabase.db}"
KEYCHAIN_ACCOUNT="${BOTICA_KEYCHAIN_ACCOUNT:-$(id -un)}"

DB_PASS="$(security find-generic-password \
  -a "${KEYCHAIN_ACCOUNT}" \
  -s "${KEYCHAIN_SERVICE}" \
  -w)"

export BOTICA_DB_HOST="aws-0-ca-central-1.pooler.supabase.com"
export BOTICA_DB_PORT="5432"
export BOTICA_DB_NAME="postgres"
export BOTICA_DB_USER="postgres.hzekajqbtzzigvlmrdaa"
export BOTICA_DB_PASS="${DB_PASS}"
export BOTICA_DB_SSL="true"
export BOTICA_BACKUP_DIR="${BOTICA_BACKUP_DIR:-${PROJECT_ROOT}/backups/database}"
export RETENTION_DAYS="${RETENTION_DAYS:-30}"
export VERIFY_BACKUP="true"

exec "${SCRIPT_DIR}/backup-db.sh"
