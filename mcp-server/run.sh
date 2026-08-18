#!/bin/bash

set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="${BOTICA_NODE_BIN:-/opt/homebrew/bin/node}"
NPM_BIN="${BOTICA_NPM_BIN:-/opt/homebrew/bin/npm}"

if [ ! -x "$NODE_BIN" ]; then
  NODE_BIN="$(command -v node 2>/dev/null || true)"
fi

if [ ! -x "$NPM_BIN" ]; then
  NPM_BIN="$(command -v npm 2>/dev/null || true)"
fi

if [ -z "${NODE_BIN:-}" ] || [ ! -x "$NODE_BIN" ]; then
  echo "ERROR: Node.js no encontrado. Define BOTICA_NODE_BIN o instala Node.js." >&2
  exit 127
fi

if [ -z "${NPM_BIN:-}" ] || [ ! -x "$NPM_BIN" ]; then
  echo "ERROR: npm no encontrado. Define BOTICA_NPM_BIN o instala npm." >&2
  exit 127
fi

if [ ! -d "$DIR/node_modules" ]; then
  "$NPM_BIN" install --prefix "$DIR" >&2
fi

if [ ! -f "$DIR/dist/index.js" ]; then
  "$NPM_BIN" run build --prefix "$DIR" >&2
fi

exec "$NODE_BIN" "$DIR/dist/index.js"
