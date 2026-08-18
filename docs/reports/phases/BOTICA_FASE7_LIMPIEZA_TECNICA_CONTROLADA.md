# BOTICA FASE 7 - Limpieza tecnica controlada

## 1. Resumen ejecutivo

Se realizo una limpieza tecnica controlada del estado actual del proyecto sin modificar reglas de negocio, migraciones, frontend funcional ni backend funcional.

La intervencion queda limitada a:

- revisar el mapa Graphify del proyecto;
- identificar artefactos generados/locales;
- ajustar `.gitignore` para excluir salidas locales de herramientas;
- documentar deuda tecnica detectada y pendientes seguros.

No se borraron archivos. No se tocaron FEFO, caja, compras, cuentas por pagar, productos, reportes ni layout.

## 2. Fuentes revisadas con Graphify

Antes de leer archivos fuente o buscar en el arbol, se reviso:

- `graphify-out/GRAPH_REPORT.md`

Luego se consulto Graphify para ubicar:

- archivos legacy/draft;
- referencias Supabase/PHP;
- archivos generados;
- configuracion `.gitignore`;
- scripts de arranque;
- docs obsoletos;
- rutas/imports potencialmente muertos.

Consultas usadas:

```bash
graphify query "legacy draft Supabase PHP generated graphify-out .gitignore start scripts imports unused rutas muertas" --budget 7000
graphify query ".gitignore graphify-out graphify generated mcp_run timestamp mjs start.sh mcp-server legacy Supabase PHP" --budget 9000
```

## 3. Archivos revisados

- `.gitignore`
- `git status --short`
- `docs/reports/PLAN_CLEANUP.md`
- `docs/reports/AUDITORIA_CLEANUP.md`
- `start.sh`
- `graphify-service.sh`
- `mcp-server/run.sh`
- `.codex/hooks.json`

## 4. Archivos modificados

- `.gitignore`
- `BOTICA_FASE7_LIMPIEZA_TECNICA_CONTROLADA.md`

## 5. Archivos generados/untracked identificados

Se identificaron artefactos locales o generados que no deben ensuciar el estado de Git:

- `graphify-out/`
- `.graphify_detect.json`
- `.graphify_python`
- `graphify-watch.log`
- `graphify-watch.pid`

Tambien existen archivos untracked que no se ignoraron automaticamente porque pueden ser configuracion o tooling util del proyecto:

- `AGENTS.md`
- `.codex/hooks.json`
- `graphify-service.sh`
- `mcp-server/run.sh`

Decision: solo se agregaron al ignore los patrones claramente generados o solicitados para esta fase.

## 6. Cambios aplicados en `.gitignore`

Se agregaron reglas para excluir salidas locales/generadas:

```gitignore
mcp_run_*.log
graphify-out/
.graphify_*
graphify-watch.pid
*.timestamp-*.mjs
```

`*.log` ya existia y sigue cubriendo archivos como `graphify-watch.log`.

## 7. Legacy, Supabase y PHP

Graphify y los reportes de cleanup existentes indican deuda tecnica documentada:

- rutas/servicios Fastify antiguos vinculados a arquitectura Supabase;
- referencias legacy PHP;
- documentos raiz historicos;
- scripts auxiliares locales.

No se eliminaron en esta fase por riesgo de borrar contexto o compatibilidad sin una tarea explicita de retiro. La recomendacion es tratarlos en una fase separada con validacion de rutas registradas, imports reales y cobertura de tests.

## 8. Scripts revisados

### `start.sh`

El script principal mantiene el legacy PHP desactivado por defecto y solo lo habilita con:

```bash
BOTICA_ENABLE_PHP_LEGACY=1
```

No se modifico.

### `graphify-service.sh`

Script local no trackeado para watcher Graphify. Genera `graphify-watch.log` y `graphify-watch.pid`.

Observacion: contiene ruta local con posible diferencia de mayusculas/minusculas (`BoticaELPueblo` vs `BoticaElPueblo`). No se corrigio porque esta fase no modifica tooling salvo ignore/documentacion.

### `mcp-server/run.sh`

Script helper del MCP server. No se ignoro ni modifico.

## 9. Validaciones ejecutadas

```bash
git status --short
git diff --check
graphify update .
```

No se ejecutaron suites backend/frontend porque no hubo cambios de codigo de aplicacion ni reglas de negocio.

## 10. Resultado

Limpieza aplicada sin tocar flujos cerrados:

- FEFO: sin cambios.
- Caja: sin cambios.
- Compras: sin cambios.
- CXP: sin cambios.
- Productos: sin cambios.
- Reportes: sin cambios.
- Layout: sin cambios.

Los artefactos generados de Graphify quedan ignorados para futuros estados de Git.

## 11. Riesgos encontrados

- Hay deuda legacy/Supabase/PHP documentada, pero retirarla requiere validacion dedicada.
- Hay muchos archivos modificados/untracked de fases previas. Esta fase no intenta normalizar ni revertir ese estado.
- `graphify-service.sh` parece script local util, pero no esta versionado y tiene ruta local posiblemente incorrecta.
- `.codex/hooks.json` esta untracked; decidir si debe versionarse o ignorarse requiere criterio de equipo.

## 12. Pendientes recomendados

- Crear fase especifica para retiro legacy PHP si ya no se usa.
- Crear fase especifica para depurar rutas/servicios Supabase huerfanos.
- Decidir si `.codex/` debe quedar versionado o ignorado.
- Revisar `start.sh` contra migraciones actuales si se usara como bootstrap oficial.
- Evaluar si `graphify-service.sh` debe versionarse como herramienta del proyecto o quedar fuera del repositorio.

## 13. Checklist final

- [x] Graphify revisado antes de busquedas o fuente.
- [x] Artefactos generados identificados.
- [x] `.gitignore` ajustado para Graphify/local tool output.
- [x] Legacy/Supabase/PHP documentados sin eliminacion.
- [x] Scripts revisados sin cambios.
- [x] Logica de negocio intacta.
- [x] Sin migraciones nuevas.
- [x] Reporte de Fase 7 creado.
