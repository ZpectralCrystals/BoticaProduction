#!/usr/bin/env bash

# Graphify Auto-Watch Service
# Muestra progreso en terminal y actualiza el grafo cada N segundos.

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${GRAPHIFY_PROJECT_DIR:-$SCRIPT_DIR}"
INTERVALO="${GRAPHIFY_INTERVAL:-60}"
LOG_FILE="${GRAPHIFY_LOG_FILE:-$PROJECT_DIR/graphify-watch.log}"
PID_FILE="${GRAPHIFY_PID_FILE:-$PROJECT_DIR/graphify-watch.pid}"

if [ -x "$PROJECT_DIR/.graphify-env/bin/graphify" ]; then
  GRAPHIFY_BIN="${GRAPHIFY_BIN:-$PROJECT_DIR/.graphify-env/bin/graphify}"
else
  GRAPHIFY_BIN="${GRAPHIFY_BIN:-$(command -v graphify || true)}"
fi

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

print_line() {
  printf '%s\n' '-----------------------------------'
}

print_header() {
  printf '%b\n' "${GREEN}🚀 Iniciando Graphify Watch Service${NC}"
  printf '%b\n' "${BOLD}Proyecto:${NC} $PROJECT_DIR"
  printf '%b\n' "${BOLD}Intervalo:${NC} cada $INTERVALO segundos"
  printf '%b\n' "${BOLD}Log:${NC} $LOG_FILE"
  print_line
}

show_help() {
  cat <<EOF
Graphify Auto-Watch Service

Uso:
  ./graphify-service.sh start     # corre en segundo plano y muestra eventos
  ./graphify-service.sh monitor   # corre en primer plano; parar con Ctrl+C
  ./graphify-service.sh stop
  ./graphify-service.sh status
  ./graphify-service.sh restart
  ./graphify-service.sh run-once
  ./graphify-service.sh logs
  ./graphify-service.sh follow

Variables:
  GRAPHIFY_INTERVAL=60
  GRAPHIFY_PROJECT_DIR="$PROJECT_DIR"
EOF
}

is_running() {
  [ -f "$PID_FILE" ] || return 1

  local pid
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

check_graphify() {
  if [ -z "$GRAPHIFY_BIN" ] || [ ! -x "$GRAPHIFY_BIN" ]; then
    printf '%b\n' "${RED}❌ graphify no encontrado.${NC}"
    printf '%b\n' "${YELLOW}Instala graphifyy o revisa PATH.${NC}"
    return 1
  fi

  if [ ! -d "$PROJECT_DIR" ]; then
    printf '%b\n' "${RED}❌ Proyecto no encontrado: $PROJECT_DIR${NC}"
    return 1
  fi
}

run_once() {
  check_graphify || return 1

  mkdir -p "$(dirname "$LOG_FILE")"

  local started_at output status now
  started_at="$(date '+%Y-%m-%d %H:%M:%S')"
  now="$(date '+%H:%M:%S')"

  {
    printf '[%s] Ejecutando graphify update...\n' "$started_at"
  } >> "$LOG_FILE"

  cd "$PROJECT_DIR" || return 1
  output="$("$GRAPHIFY_BIN" update "$PROJECT_DIR" 2>&1)"
  status=$?
  printf '%s\n' "$output" >> "$LOG_FILE"
  printf '[%s] exit=%s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$status" >> "$LOG_FILE"

  if [ "$status" -eq 0 ]; then
    if printf '%s\n' "$output" | grep -qi 'No code-graph topology changes detected'; then
      printf '%b\n' "${GREEN}[$now] ✅ Grafo sin cambios${NC}"
    else
      printf '%b\n' "${GREEN}[$now] ✅ Grafo actualizado${NC}"
    fi
    return 0
  fi

  printf '%b\n' "${RED}[$now] ❌ Error actualizando grafo${NC}"
  printf '%b\n' "${YELLOW}Ver log: tail -f \"$LOG_FILE\"${NC}"
  return "$status"
}

run_loop() {
  trap 'printf "\n"; printf "%b\n" "${YELLOW}Servicio detenido${NC}"; rm -f "$PID_FILE"; exit 0' INT TERM

  while true; do
    run_once
    sleep "$INTERVALO"
  done
}

start_service() {
  if is_running; then
    printf '%b\n' "${YELLOW}⚠️ Servicio ya activo (PID: $(cat "$PID_FILE"))${NC}"
    printf '%b\n' "${YELLOW}Usa: ./graphify-service.sh logs${NC}"
    return 0
  fi

  rm -f "$PID_FILE"
  print_header
  check_graphify || return 1

  run_loop &
  echo $! > "$PID_FILE"

  printf '%b\n' "${GREEN}✅ Servicio iniciado (PID: $(cat "$PID_FILE"))${NC}"
  printf '%b\n' "${YELLOW}💡 Para ver el progreso: tail -f \"$LOG_FILE\"${NC}"
}

monitor_service() {
  print_header
  check_graphify || return 1

  printf '%b\n' "${YELLOW}Modo monitor: Ctrl+C para detener.${NC}"
  run_loop
}

stop_service() {
  if ! is_running; then
    rm -f "$PID_FILE"
    printf '%b\n' "${YELLOW}⚠️ Servicio no está corriendo${NC}"
    return 0
  fi

  local pid
  pid="$(cat "$PID_FILE")"
  kill "$pid" 2>/dev/null || true
  rm -f "$PID_FILE"
  printf '%b\n' "${GREEN}✅ Servicio detenido${NC}"
}

status_service() {
  if is_running; then
    printf '%b\n' "${GREEN}✅ Servicio activo${NC}"
    printf 'PID: %s\n' "$(cat "$PID_FILE")"
  else
    printf '%b\n' "${YELLOW}⚠️ Servicio detenido${NC}"
  fi

  printf 'Proyecto: %s\n' "$PROJECT_DIR"
  printf 'Intervalo: cada %s segundos\n' "$INTERVALO"
  printf 'Log: %s\n' "$LOG_FILE"

  if [ -f "$LOG_FILE" ]; then
    print_line
    tail -5 "$LOG_FILE"
  fi
}

show_logs() {
  if [ -f "$LOG_FILE" ]; then
    tail -30 "$LOG_FILE"
  else
    printf '%b\n' "${YELLOW}No hay logs aún${NC}"
  fi
}

follow_logs() {
  touch "$LOG_FILE"
  tail -f "$LOG_FILE"
}

case "${1:-}" in
  start) start_service ;;
  monitor) monitor_service ;;
  stop) stop_service ;;
  status) status_service ;;
  restart) stop_service; sleep 1; start_service ;;
  run-once) run_once ;;
  logs) show_logs ;;
  follow) follow_logs ;;
  *) show_help ;;
esac
