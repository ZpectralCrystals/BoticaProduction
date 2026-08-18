#!/usr/bin/env bash
set -euo pipefail

API="${BOTICA_API_URL:-http://127.0.0.1:3001/api/v1}"
DNI="${BOTICA_TEST_DNI:-00000000}"
PASS="${BOTICA_TEST_PASS:-12345678}"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

printf '[smoke] API=%s\n' "$API"

curl -fsS "${API%/api/v1}/health/ready" >/dev/null
printf 'PASS health/ready\n'

curl -fsS \
  -H 'Content-Type: application/json' \
  -d "{\"dni\":\"$DNI\",\"clave\":\"$PASS\"}" \
  "$API/auth/login" > "$tmp"
printf 'PASS auth/login\n'

TOKEN="$(node -e "const fs=require('fs'); const d=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); if(!d.token) process.exit(1); process.stdout.write(d.token)" "$tmp")"

curl -fsS -H "Authorization: Bearer $TOKEN" "$API/auth/session" >/dev/null
printf 'PASS auth/session\n'

curl -fsS -H "Authorization: Bearer $TOKEN" "$API/inventario?limit=1" >/dev/null
printf 'PASS inventario\n'

curl -fsS -H "Authorization: Bearer $TOKEN" "$API/consistencia/resumen" >/dev/null
printf 'PASS consistencia/resumen\n'

printf '[smoke] OK\n'

