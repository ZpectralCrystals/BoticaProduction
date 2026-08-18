#!/bin/bash
# ──────────────────────────────────────────────
#  Botica El Pueblo — Iniciar sistema completo
#  Ejecutar: ./start.sh
# ──────────────────────────────────────────────

DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PORT="${BOTICA_BACKEND_PORT:-8081}"
FASTIFY_PORT="${BOTICA_FASTIFY_PORT:-3001}"
FRONTEND_PORT="${BOTICA_FRONTEND_PORT:-5174}"
ENABLE_LEGACY_PHP="${BOTICA_ENABLE_PHP_LEGACY:-0}"
VERBOSE_STARTUP="${BOTICA_VERBOSE_STARTUP:-0}"
DB_HOST="${BOTICA_DB_HOST:-localhost}"
DB_PORT="${BOTICA_DB_PORT:-5432}"
DB_NAME="${BOTICA_DB_NAME:-botica_db}"
DB_USER="${BOTICA_DB_USER:-${USER:-postgres}}"
DB_PASS="${BOTICA_DB_PASS:-}"
PG_BIN="${BOTICA_PG_BIN:-/opt/homebrew/opt/postgresql@15/bin}"
PG_DATA="${BOTICA_PG_DATA:-/opt/homebrew/var/postgresql@15}"
FASTIFY_DIR="$DIR/backend-fastify"
FASTIFY_ENV_FILE="${BOTICA_FASTIFY_ENV_FILE:-$FASTIFY_DIR/.env}"
SCHEMA_FILE="${BOTICA_SCHEMA_FILE:-$DIR/ops/baseline/schema_botica_actual.sql}"

# Cargar env temprano para permitir DB remota/Supabase desde backend-fastify/.env
if [ -f "$FASTIFY_ENV_FILE" ]; then
  set -a
  . "$FASTIFY_ENV_FILE"
  set +a
fi

DB_HOST="${BOTICA_DB_HOST:-${DB_HOST:-localhost}}"
DB_PORT="${BOTICA_DB_PORT:-${DB_PORT:-5432}}"
DB_NAME="${BOTICA_DB_NAME:-${DB_NAME:-botica_db}}"
DB_USER="${BOTICA_DB_USER:-${DB_USER:-${USER:-postgres}}}"
DB_PASS="${BOTICA_DB_PASS:-${DB_PASS:-}}"
DB_SSL="${BOTICA_DB_SSL:-${DB_SSL:-}}"
SKIP_DB_BOOTSTRAP="${BOTICA_SKIP_DB_BOOTSTRAP:-}"
APPLY_MIGRATIONS="${BOTICA_APPLY_MIGRATIONS:-}"
MIGRATIONS=(
  "002_nstock_constraint.sql"
  "003_bot_kardex.sql"
  "004_bot_lotes.sql"
  "005_fefo.sql"
  "006_deduplicate_entities.sql"
  "006_migrar_stock_a_lotes.sql"
  "007_unify_customers_and_patients.sql"
  "008_rename_sales_clinical_customer_link.sql"
  "009_deduplicate_services.sql"
  "010_locales_almacenes.sql"
  "011_compras_tipo_comprobante_factura.sql"
  "012_compras_almacen_destino.sql"
  "013_proveedores_ruc_unico_y_auditoria.sql"
  "014_usuarios_clerk_link.sql"
  "015_productos_precios_venta.sql"
  "016_productos_familias_categorias.sql"
  "017_productos_componentes.sql"
  "018_lotes_costo_y_producto_flags.sql"
  "019_producto_precios_y_historial.sql"
  "020_caja_movimientos_y_cxp.sql"
  "021_cierre_caja_persistente.sql"
  "022_productos_tipo_no_medicamento.sql"
  "023_correlativos_ventas_compras.sql"
  "024_ventas_pago_mixto_desglose.sql"
)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

cleanup() {
  echo ""
  echo -e "${YELLOW}Deteniendo servidores...${NC}"
  [ -n "$PID_FASTIFY" ] && kill "$PID_FASTIFY" 2>/dev/null
  [ -n "$PID_BACKEND" ] && kill "$PID_BACKEND" 2>/dev/null
  [ -n "$PID_FRONTEND" ] && kill "$PID_FRONTEND" 2>/dev/null
  wait 2>/dev/null
  echo -e "${GREEN}Servidores detenidos.${NC}"
  exit 0
}
trap cleanup SIGINT SIGTERM

pg_ready() {
  PGPASSWORD="$DB_PASS" PGSSLMODE="${PGSSLMODE:-$DB_SSL}" "$PG_BIN/pg_isready" -h "$DB_HOST" -p "$DB_PORT" -q 2>/dev/null
}

db_select_1() {
  PGPASSWORD="$DB_PASS" PGSSLMODE="${PGSSLMODE:-$DB_SSL}" "$PG_BIN/psql" \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -At \
    -c "SELECT 1" >/dev/null 2>&1
}

is_local_db_host() {
  [ "$DB_HOST" = "localhost" ] || [ "$DB_HOST" = "127.0.0.1" ] || [ "$DB_HOST" = "::1" ]
}

db_has_required_baseline() {
  local missing_count
  missing_count="$(
    PGPASSWORD="$DB_PASS" "$PG_BIN/psql" \
      -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -At \
      -c "SELECT COUNT(*) FROM (VALUES ('bot_productos'), ('bot_usuarios'), ('bot_compras'), ('bot_ventas')) AS req(table_name) WHERE NOT EXISTS (SELECT 1 FROM information_schema.tables t WHERE t.table_schema = 'public' AND t.table_name = req.table_name);" \
      2>/dev/null || echo "999"
  )"
  [ "$missing_count" = "0" ]
}

cleanup_stale_postgres_pid() {
  local pidfile="$PG_DATA/postmaster.pid"
  [ -f "$pidfile" ] || return 0

  local stale_pid socket_dir socket_file socket_lock
  stale_pid="$(sed -n '1p' "$pidfile" 2>/dev/null | tr -d '[:space:]')"
  socket_dir="$(sed -n '5p' "$pidfile" 2>/dev/null | tr -d '[:space:]')"
  [ -n "$socket_dir" ] || socket_dir="/tmp"

  if [ -n "$stale_pid" ] && kill -0 "$stale_pid" 2>/dev/null; then
    return 0
  fi

  # Si PostgreSQL ya responde por TCP, evitamos tocar archivos locales.
  if pg_ready; then
    return 0
  fi

  socket_file="$socket_dir/.s.PGSQL.$DB_PORT"
  socket_lock="$socket_file.lock"

  [ "$VERBOSE_STARTUP" = "1" ] && echo -e "${YELLOW}Limpiando residuos locales de PostgreSQL...${NC}"
  rm -f "$pidfile"
  rm -f "$socket_file" "$socket_lock"
}

# ── Verificar dependencias ──
echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo -e "${CYAN}   Botica El Pueblo — Inicio${NC}"
echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo ""

# PHP legacy (opcional)
if [ "$ENABLE_LEGACY_PHP" = "1" ] && ! command -v php &>/dev/null; then
  echo -e "${RED}ERROR: PHP no encontrado. Instalar con: brew install php o desactivar BOTICA_ENABLE_PHP_LEGACY.${NC}"
  exit 1
fi

# Node
if ! command -v node &>/dev/null; then
  echo -e "${RED}ERROR: Node.js no encontrado. Instalar con: brew install node${NC}"
  exit 1
fi

# PostgreSQL
if [ ! -x "$PG_BIN/pg_isready" ] || [ ! -x "$PG_BIN/psql" ] || [ ! -x "$PG_BIN/createdb" ]; then
  PSQL_PATH="$(command -v psql 2>/dev/null || true)"
  if [ -n "$PSQL_PATH" ]; then
    PG_BIN="$(dirname "$PSQL_PATH")"
  fi
fi

if [ ! -x "$PG_BIN/pg_isready" ] || [ ! -x "$PG_BIN/psql" ] || [ ! -x "$PG_BIN/createdb" ]; then
  echo -e "${RED}ERROR: No se encontraron binarios de PostgreSQL. Configura BOTICA_PG_BIN o instala psql/createdb/pg_isready.${NC}"
  exit 1
fi

cleanup_stale_postgres_pid

if [ -z "$SKIP_DB_BOOTSTRAP" ] && ! is_local_db_host; then
  SKIP_DB_BOOTSTRAP="1"
fi

if [ "$SKIP_DB_BOOTSTRAP" = "1" ]; then
  echo -e "${YELLOW}DB remota detectada. Saltando arranque local, createdb y migraciones legacy.${NC}"
  if ! db_select_1; then
    echo -e "${RED}ERROR: No se pudo conectar a DB remota.${NC}"
    echo -e "${YELLOW}Revisa BOTICA_DB_HOST/PORT/NAME/USER/PASS, BOTICA_DB_SSL y PGOPTIONS.${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ DB remota responde${NC}"
elif ! pg_ready; then
  echo -e "${YELLOW}PostgreSQL no parece estar corriendo. Intentando iniciar...${NC}"
  if command -v brew &>/dev/null; then
    brew services start postgresql@15 >/tmp/botica_pg_brew.log 2>&1 || true
  fi
  sleep 2

  if ! pg_ready; then
    echo -e "${YELLOW}brew services no logró levantar PostgreSQL. Intentando con pg_ctl...${NC}"
    "$PG_BIN/pg_ctl" -D "$PG_DATA" -l /tmp/botica_postgres.log start >/tmp/botica_pg_ctl.log 2>&1 || true
    sleep 3
  fi

  if ! pg_ready; then
    echo -e "${RED}ERROR: No se pudo iniciar PostgreSQL.${NC}"
    echo -e "${YELLOW}Revisa: /tmp/botica_pg_brew.log, /tmp/botica_pg_ctl.log y /tmp/botica_postgres.log${NC}"
    exit 1
  fi
fi
if [ "$SKIP_DB_BOOTSTRAP" != "1" ]; then
  echo -e "${GREEN}✓ PostgreSQL corriendo${NC}"
fi

# ── Verificar DB existe ──
if [ "$SKIP_DB_BOOTSTRAP" != "1" ] && ! PGPASSWORD="$DB_PASS" "$PG_BIN/psql" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" &>/dev/null; then
  echo -e "${YELLOW}Base de datos '$DB_NAME' no encontrada. Creando...${NC}"
  PGPASSWORD="$DB_PASS" "$PG_BIN/createdb" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
  if [ ! -f "$SCHEMA_FILE" ]; then
    echo -e "${RED}ERROR: Schema inicial no encontrado: $SCHEMA_FILE${NC}"
    echo -e "${YELLOW}Configura BOTICA_SCHEMA_FILE con el SQL baseline que crea bot_productos/bot_usuarios/bot_compras/bot_ventas.${NC}"
    exit 1
  fi
  echo -e "${YELLOW}Ejecutando schema inicial: $SCHEMA_FILE${NC}"
  PGPASSWORD="$DB_PASS" "$PG_BIN/psql" -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCHEMA_FILE"
  echo -e "${GREEN}✓ Base de datos creada${NC}"
elif [ "$SKIP_DB_BOOTSTRAP" != "1" ]; then
  echo -e "${GREEN}✓ Base de datos $DB_NAME existe${NC}"
fi

if [ "$SKIP_DB_BOOTSTRAP" != "1" ] && ! db_has_required_baseline; then
  echo -e "${RED}ERROR: La base '$DB_NAME' no contiene el baseline canónico requerido.${NC}"
  echo -e "${YELLOW}Faltan tablas base como bot_productos, bot_usuarios, bot_compras o bot_ventas.${NC}"
  echo -e "${YELLOW}Aplica un schema baseline válido o define BOTICA_SCHEMA_FILE antes de ejecutar start.sh.${NC}"
  exit 1
fi

apply_migration() {
  local file="$1"
  if [ ! -f "$file" ]; then
    echo -e "${RED}ERROR: Migración requerida no encontrada: $file${NC}"
    exit 1
  fi
  [ "$VERBOSE_STARTUP" = "1" ] && echo -e "${YELLOW}Aplicando migración $(basename "$file")...${NC}"
  if ! PGPASSWORD="$DB_PASS" "$PG_BIN/psql" -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$file" >/tmp/botica_migration.log 2>&1; then
    echo -e "${RED}ERROR: Falló migración $(basename "$file"). Revisa /tmp/botica_migration.log${NC}"
    exit 1
  fi
}

if [ "$SKIP_DB_BOOTSTRAP" = "1" ]; then
  echo -e "${GREEN}✓ Bootstrap DB saltado${NC}"
elif [ "$APPLY_MIGRATIONS" = "0" ]; then
  echo -e "${YELLOW}Migraciones locales saltadas por BOTICA_APPLY_MIGRATIONS=0${NC}"
else
  for migration in "${MIGRATIONS[@]}"; do
    apply_migration "$DIR/ops/migrations/$migration"
  done

  echo -e "${GREEN}✓ Base de datos al día${NC}"
fi

# ── Verificar dependencias frontend ──
if [ ! -d "$DIR/frontend/node_modules" ]; then
  echo -e "${YELLOW}Instalando dependencias frontend...${NC}"
  cd "$DIR/frontend" && npm install
fi
echo -e "${GREEN}✓ Dependencias frontend listas${NC}"

# ── Verificar dependencias backend Fastify ──
if [ -d "$FASTIFY_DIR" ] && [ ! -d "$FASTIFY_DIR/node_modules" ]; then
  echo -e "${YELLOW}Instalando dependencias backend-fastify...${NC}"
  cd "$FASTIFY_DIR" && npm install
fi

# ── Matar procesos previos en los puertos ──
[ "$ENABLE_LEGACY_PHP" = "1" ] && lsof -ti:$BACKEND_PORT 2>/dev/null | xargs kill -9 2>/dev/null
lsof -ti:$FASTIFY_PORT 2>/dev/null | xargs kill -9 2>/dev/null
lsof -ti:$FRONTEND_PORT 2>/dev/null | xargs kill -9 2>/dev/null
sleep 1

# ── Iniciar Backend PHP legacy si está habilitado ──
PHP_STATUS="deshabilitado"
if [ "$ENABLE_LEGACY_PHP" = "1" ]; then
  echo ""
  echo -e "${CYAN}Iniciando backend PHP legacy en puerto $BACKEND_PORT...${NC}"
  php -S 127.0.0.1:$BACKEND_PORT -t "$DIR/backend" > /tmp/botica_backend.log 2>&1 &
  PID_BACKEND=$!
  sleep 1

  if kill -0 "$PID_BACKEND" 2>/dev/null; then
    PHP_STATUS="activo"
    echo -e "${GREEN}✓ Backend PHP corriendo — http://127.0.0.1:$BACKEND_PORT${NC}"
  else
    echo -e "${RED}ERROR: Backend PHP no pudo iniciar. Ver /tmp/botica_backend.log${NC}"
    exit 1
  fi
fi

# ── Iniciar Backend Fastify si está configurado ──
FASTIFY_STATUS="no configurado"
if [ -d "$FASTIFY_DIR" ]; then
  echo -e "${CYAN}Iniciando backend Fastify en puerto $FASTIFY_PORT...${NC}"
  (
    cd "$FASTIFY_DIR" || exit 1
    set -a
    [ -f "$FASTIFY_ENV_FILE" ] && . "$FASTIFY_ENV_FILE"
    export PORT="$FASTIFY_PORT"
    export HOST="127.0.0.1"
    export CORS_ORIGIN="${BOTICA_CORS_ORIGIN:-http://localhost:$FRONTEND_PORT}"
    export BOTICA_DB_HOST="$DB_HOST"
    export BOTICA_DB_PORT="$DB_PORT"
    export BOTICA_DB_NAME="$DB_NAME"
    export BOTICA_DB_USER="$DB_USER"
    export BOTICA_DB_PASS="$DB_PASS"
    set +a
    npm run dev
  ) > /tmp/botica_fastify.log 2>&1 &
  PID_FASTIFY=$!
  sleep 5

  if kill -0 "$PID_FASTIFY" 2>/dev/null && curl -sf "http://127.0.0.1:$FASTIFY_PORT/health" >/dev/null 2>&1; then
    FASTIFY_STATUS="activo"
    echo -e "${GREEN}✓ Fastify corriendo — http://127.0.0.1:$FASTIFY_PORT${NC}"
  else
    FASTIFY_STATUS="falló"
    echo -e "${YELLOW}WARN: Fastify no quedó operativo. Revisa /tmp/botica_fastify.log${NC}"
  fi
fi

# ── Iniciar Frontend Vite ──
echo -e "${CYAN}Iniciando frontend Vite en puerto $FRONTEND_PORT...${NC}"
cd "$DIR/frontend" && npx vite --port $FRONTEND_PORT --host > /tmp/botica_frontend.log 2>&1 &
PID_FRONTEND=$!
sleep 3

if kill -0 "$PID_FRONTEND" 2>/dev/null; then
  echo -e "${GREEN}✓ Frontend corriendo — http://localhost:$FRONTEND_PORT${NC}"
else
  echo -e "${RED}ERROR: Frontend no pudo iniciar. Ver /tmp/botica_frontend.log${NC}"
  cleanup
  exit 1
fi

# ── Resumen ──
echo ""
echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  Sistema Botica El Pueblo iniciado${NC}"
echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo ""
echo -e "  ${CYAN}Frontend:${NC}  http://localhost:$FRONTEND_PORT"
if [ "$PHP_STATUS" = "activo" ]; then
  echo -e "  ${CYAN}Backend PHP:${NC}   http://127.0.0.1:$BACKEND_PORT"
else
  echo -e "  ${CYAN}Backend PHP:${NC}   $PHP_STATUS"
fi
if [ "$FASTIFY_STATUS" = "activo" ]; then
  echo -e "  ${CYAN}Backend Fastify:${NC} http://127.0.0.1:$FASTIFY_PORT"
  echo -e "  ${CYAN}Swagger:${NC}       http://127.0.0.1:$FASTIFY_PORT/documentation"
else
  echo -e "  ${CYAN}Backend Fastify:${NC} $FASTIFY_STATUS"
fi
echo -e "  ${CYAN}DB:${NC}        $DB_NAME ($DB_HOST:$DB_PORT)"
echo ""
echo -e "  ${YELLOW}Super usuario:${NC} DNI 00000000 / Clave 12345678"
echo ""
echo -e "  ${YELLOW}Presiona Ctrl+C para detener todo${NC}"
echo ""

# ── Mantener vivo ──
wait
