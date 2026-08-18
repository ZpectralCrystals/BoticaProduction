# Plan de trabajo: DB productiva para Supabase

Proyecto: BoticaElPueblo-RebrandLab  
Version: local / rebranding / v2  
Fecha: 2026-08-18  
Objetivo: dejar base lista para operar en nube Supabase con seguridad, migraciones, datos limpios y rollback.

## Regla base

Nada directo a produccion.

Orden obligatorio:

1. Backup.
2. Copia staging local.
3. Correcciones en staging.
4. Pruebas completas.
5. Ensayo Supabase staging.
6. Repetir si falla.
7. Corte productivo solo con checklist verde.

## Fase 0 - Preparacion y congelamiento

Objetivo: saber exactamente que base se toca y poder volver atras.

Tareas:

- Confirmar DB origen: `botica_db`.
- Confirmar repo origen: `BoticaElPueblo-RebrandLab`.
- Registrar commit actual.
- Congelar cambios de schema manuales.
- Crear carpeta de migracion.
- Crear bitacora.

Entregables:

- Backup full `.dump`.
- Schema baseline `.sql`.
- Data-only backup.
- Checksum.
- Registro de fecha/commit/DB.

Validacion:

- Dump existe.
- Dump pesa mas que cero.
- `pg_restore --list` lee dump.
- Restore local de prueba funciona.

Riesgo si se omite:

- No rollback.
- No auditoria.
- Migracion insegura.

Tiempo estimado: 0.5 dia.

## Fase 1 - Staging local limpio

Objetivo: crear DB copia para reparar sin tocar DB operativa.

Tareas:

- Crear DB `botica_db_staging`.
- Restaurar backup ahi.
- Apuntar backend temporal a staging.
- Ejecutar auditoria SQL inicial.
- Guardar resultado antes/despues.

Entregables:

- DB staging local.
- Informe `AUDITORIA_STAGING_PRE_FIX.md`.

Validacion:

- Login funciona.
- Panel carga.
- Inventario carga.
- Compra, venta, caja, kardex consultan sin error.

Tiempo estimado: 0.5 dia.

## Fase 2 - Limpieza de datos bloqueantes

Objetivo: quitar inconsistencias antes de nube.

Tareas:

- Resolver lote vencido activo:
  - Producto: Simvastatina 20 mg (Merck).
  - Lote: `MK-7741`.
  - Vencimiento: 2026-06-28.
  - Cantidad: 150.
  - Accion: marcar `VENCIDO`/`BLOQUEADO` o registrar baja.
- Resolver stock producto vs lotes:
  - Productos QA E2E IDs 59, 60, 61, 62.
  - Opcion A: eliminar datos QA completos si no son reales.
  - Opcion B: reconciliar lote/kardex/stock.
- Revisar ventas anuladas:
  - Confirmar si caja tiene reversa correcta.
  - Crear movimiento de reversa si falta.
- Limpiar tablas vacias legacy:
  - `kardex`.
  - `tipos_movimiento`.
  - Dropear solo si codigo no las usa.

Entregables:

- Migracion SQL `001_cleanup_datos_bloqueantes.sql`.
- Informe `AUDITORIA_STAGING_POST_CLEANUP.md`.

Validacion:

- 0 lotes vencidos activos con stock.
- 0 diferencias stock producto vs lotes.
- 0 datos QA en produccion, salvo marcados como prueba.
- 0 tablas legacy sin uso, o documentadas.

Tiempo estimado: 1 dia.

## Fase 3 - Correccion de modelo DB

Objetivo: cerrar problemas estructurales antes de cloud.

Tareas:

- Corregir FK duplicada:
  - Tabla: `bot_compras`.
  - Columna: `nusuario_id`.
  - Dejar una sola FK.
  - Politica recomendada: no borrar usuarios fisicamente; usar desactivacion logica.
- Crear indices FK de alto trafico:
  - `bot_ventas_det.nventa_id`.
  - `bot_ventas_det.nproducto_id`.
  - `bot_compras_det.ncompra_id`.
  - `bot_compras_det.nproducto_id`.
  - `bot_compras.nproveedor_id`.
  - `bot_ventas.nusuario_id`.
  - `bot_productos.nproveedor_id`.
- Definir fuente real de stock:
  - Stock real = lotes por almacen.
  - `bot_productos.nstock` = cache o vista calculada.
- Bloquear venta de vencidos:
  - Regla backend.
  - Regla DB si posible.
- Obligar ajuste con lote y almacen.

Entregables:

- Migracion SQL `002_modelo_inventario_indices.sql`.
- Script auditoria stock/lotes.
- Tests de compra/venta/ajuste.

Validacion:

- `EXPLAIN` mejora en joins clave.
- Ajuste no puede crear stock fantasma.
- Venta no puede consumir lote vencido.
- Compra crea lote + kardex + stock consistente.

Tiempo estimado: 2 dias.

## Fase 4 - Catalogos y precios canonicos

Objetivo: eliminar doble verdad.

Tareas:

- Poblar `bot_familias_producto` desde valores actuales.
- Poblar `bot_categorias_producto` desde valores actuales.
- Backfill `nfamilia_id` y `ncategoria_id` en `bot_productos`.
- Decidir modelo precio:
  - Opcion recomendada: `bot_producto_precios` como canonico.
  - Backfill desde `npreventa`, `npreventa_2`, `npreventa_3`.
  - Activar historial real en `bot_producto_precios_hist`.
- Revisar triggers legacy de precios.

Entregables:

- Migracion SQL `003_catalogos_precios.sql`.
- Diccionario de datos producto/precio.

Validacion:

- 100% productos activos con categoria/familia ID si aplica.
- Precio venta POS sale de fuente definida.
- Cambio precio genera historial.

Tiempo estimado: 1.5 dias.

## Fase 5 - Migraciones versionadas

Objetivo: pasar de cambios manuales a DB reproducible.

Tareas:

- Crear carpeta `supabase/migrations`.
- Crear baseline inicial del schema actual limpio.
- Registrar migraciones 001, 002, 003.
- Crear script `db:audit`.
- Crear script `db:restore-test`.
- Documentar proceso.

Entregables:

- `supabase/migrations/000_baseline.sql`.
- Migraciones limpias posteriores.
- `docs/reports/MIGRACION_DB_RUNBOOK.md`.

Validacion:

- DB vacia + migraciones = schema funcional.
- Seed minimo funciona.
- Backend arranca contra DB reconstruida.

Tiempo estimado: 1 dia.

## Fase 6 - Seguridad Supabase

Objetivo: evitar exposicion de datos sensibles.

Tareas:

- Decidir arquitectura:
  - Backend-only con Fastify.
  - Supabase client frontend.
  - Mixto.
- Si frontend usa Supabase:
  - Activar RLS tabla por tabla.
  - Crear policies por rol.
  - Probar anon/authenticated/admin/cajero/almacen.
- Si backend-only:
  - No exponer tablas al frontend.
  - Guardar service key solo en backend.
  - Rotar secretos.
  - Grants minimos.
- Definir auth:
  - Clerk actual.
  - Supabase Auth.
  - JWT propio.
- Proteger PII:
  - usuarios.
  - pacientes.
  - proveedores.
  - ventas.
  - compras.
  - caja.

Entregables:

- `004_security_rls.sql`.
- Matriz roles/permisos.
- Informe test seguridad.

Validacion:

- anon no lee tablas privadas.
- cajero no edita compras si no debe.
- almacen no ve caja si no debe.
- admin si opera todo.
- service_role no usado en frontend.

Tiempo estimado: 2 dias.

## Fase 7 - Supabase staging

Objetivo: ensayar migracion real sin riesgo.

Tareas:

- Crear proyecto Supabase staging.
- Restaurar dump limpio con `--no-owner --no-privileges`.
- Ejecutar migraciones.
- Configurar env backend staging.
- Probar flujos completos:
  - login.
  - compra.
  - lote.
  - kardex.
  - venta.
  - caja.
  - anulacion.
  - reportes.
  - inventario por almacen.
- Revisar latencia.
- Revisar errores backend.

Entregables:

- Supabase staging operativo.
- Informe `QA_SUPABASE_STAGING.md`.
- Lista de bugs si aparece.

Validacion:

- 0 errores criticos.
- 0 inconsistencias post-flujo.
- Backup restore repetible.
- Conexion backend estable.

Tiempo estimado: 1.5 dias.

## Fase 8 - Hardening operativo

Objetivo: operar nube sin sustos.

Estado 2026-08-18:

- Ejecutado en Supabase staging.
- Smoke read-only OK.
- Smoke escritura OK.
- Backup manual pre-write y post-fix OK.
- Auditoria final blockers 0.
- Bug creacion producto sin catalogo/precio canon corregido.
- Pendiente para F9: rotar password, preparar env productivo, definir corte backend.

Tareas:

- Configurar backups Supabase.
- Crear backup manual antes de corte.
- Crear monitoreo basico:
  - errores API.
  - consultas lentas.
  - espacio DB.
  - conexiones.
- Crear runbook:
  - backup.
  - restore.
  - rollback.
  - cambio env.
  - emergencia.
- Sanitizar dumps locales con PII si se comparten.

Entregables:

- `RUNBOOK_PRODUCCION_SUPABASE.md`.
- Checklist rollback.
- Checklist corte.

Validacion:

- Restore probado.
- Rollback probado.
- Credenciales guardadas fuera del repo.

Tiempo estimado: 1 dia.

## Fase 9 - Corte productivo

Objetivo: mover produccion con ventana controlada.

Estado 2026-08-18:

- Precorte tecnico preparado.
- `start.sh` ya soporta DB remota sin bootstrap legacy.
- Env template Supabase creado.
- Smoke API creado.
- Validacion backend 133/133 OK.
- Pendiente: confirmar password rotado y ejecutar corte con env real.

Secuencia:

1. Avisar ventana de mantenimiento.
2. Congelar uso sistema.
3. Backup final local.
4. Restore Supabase produccion.
5. Ejecutar auditoria post-restore.
6. Cambiar `DATABASE_URL` backend.
7. Levantar backend.
8. Ejecutar smoke test.
9. Abrir sistema.
10. Monitorear primera jornada.

Entregables:

- Produccion en Supabase.
- Informe de corte.
- Backup final guardado.

Validacion:

- Login OK.
- Inventario OK.
- Compra OK.
- Venta OK.
- Caja OK.
- Reportes OK.
- 0 errores criticos en logs.

Tiempo estimado: 0.5 dia para corte, 1 dia monitoreo.

## Cronograma recomendado

| Fase | Tiempo |
|---|---:|
| 0 Preparacion | 0.5 dia |
| 1 Staging local | 0.5 dia |
| 2 Limpieza datos | 1 dia |
| 3 Modelo DB | 2 dias |
| 4 Catalogos/precios | 1.5 dias |
| 5 Migraciones | 1 dia |
| 6 Seguridad | 2 dias |
| 7 Supabase staging | 1.5 dias |
| 8 Hardening | 1 dia |
| 9 Corte | 0.5 dia + monitoreo |

Total realista: 10 a 12 dias laborables.

## Prioridad de ejecucion

### Primero

- Backup.
- Staging local.
- Lote vencido.
- Stock/lotes.
- FK duplicada.

### Segundo

- Migraciones.
- Catalogos.
- Precios.
- Indices.

### Tercero

- RLS.
- Auth.
- Supabase staging.

### Ultimo

- Produccion.
- Monitoreo.
- Runbook final.

## Criterio de "listo para produccion"

DB lista solo si:

- Backup restaurable probado.
- 0 inconsistencias stock/lotes.
- 0 lotes vencidos activos vendibles.
- 0 orfandad core.
- Migraciones reconstruyen schema.
- RLS o backend-only seguro definido.
- Auth decidido.
- Supabase staging probado.
- Smoke test verde.
- Rollback documentado.

## Siguiente paso recomendado

Ejecutar Fase 0 y Fase 1.

No corregir nada todavia en `botica_db` directa. Primero crear staging local y trabajar ahi.
