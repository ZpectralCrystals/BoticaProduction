# Auditoria DB para migracion a Supabase

Proyecto: BoticaElPueblo-RebrandLab  
Base local auditada: botica_db  
Fecha: 2026-08-17  
Auditor: Codex  
Alcance: estructura, seguridad, integridad, datos operativos y preparacion para Supabase.

## Veredicto ejecutivo

La base esta funcional para pruebas locales, pero no esta lista para subir a Supabase como produccion sin una fase de limpieza y hardening.

Riesgo principal:

1. Seguridad cloud: no hay RLS ni policies en tablas publicas.
2. Inventario: hay diferencias entre stock de producto y suma de lotes activos en productos QA.
3. Lotes: existe stock activo vencido.
4. Migraciones: no hay tabla/flujo canonico de migraciones versionadas.
5. Modelo parcialmente legado: tablas nuevas vacias conviven con columnas antiguas usadas en produccion.

No se modifico la base de datos durante esta auditoria.

## Estado actual observado

PostgreSQL local:

- Version: PostgreSQL 15.18 Homebrew, arm64.
- Usuario local propietario: gg.
- Extensions activas: pgcrypto, plpgsql.
- Tablas publicas principales: 38.
- Vistas publicas: vw_bot_lotes_fefo, vw_bot_proveedores_invalidos, vw_bot_proveedores_ruc_duplicados, vw_stock_por_almacen.
- Constraints: 223 CHECK, 58 FOREIGN KEY, 36 PRIMARY KEY, 11 UNIQUE.
- Indices: 109.
- Triggers propios: 5.
- Policies RLS: 0.
- Tablas con RLS habilitado: 0.

Conteos principales:

| Tabla | Filas |
|---|---:|
| bot_productos | 62 |
| bot_lotes | 74 |
| bot_kardex | 113 |
| bot_compras | 59 |
| bot_compras_det | 66 |
| bot_ventas | 22 |
| bot_ventas_det | 24 |
| bot_caja_movimientos | 44 |
| bot_usuarios | 6 |
| bot_proveedores | 15 |
| bot_almacenes | 7 |
| bot_locales | 2 |
| bot_auditoria | 132 |

Tablas vacias relevantes:

- bot_categorias_producto
- bot_familias_producto
- bot_componentes_producto
- bot_producto_componentes
- bot_producto_precios
- bot_producto_precios_hist
- bot_inventario_var
- bot_recetas
- bot_recetas_det
- bot_transferencias
- bot_transferencias_det
- kardex
- tipos_movimiento

## Hallazgos criticos

### P0 - Supabase: RLS inexistente

Todas las tablas publicas tienen RLS deshabilitado y no existen policies.

Esto es bloqueante si se usara Supabase client desde frontend o si se exponen tablas via PostgREST. En Supabase, una tabla en schema expuesto sin RLS puede quedar accesible segun grants/policies y rol usado. La decision debe ser explicita:

- Opcion A: frontend nunca toca DB directo; solo backend Fastify usa conexion privada.
- Opcion B: frontend usa Supabase client; entonces RLS debe estar activado y probado tabla por tabla.

Recomendacion: preparar Supabase con RLS activado para tablas sensibles aunque se mantenga backend propio. Es defensa minima para nube.

Tablas sensibles:

- bot_usuarios
- bot_productos
- bot_lotes
- bot_kardex
- bot_compras
- bot_compras_det
- bot_ventas
- bot_ventas_det
- bot_caja
- bot_caja_movimientos
- bot_auditoria
- bot_pacientes
- bot_medicos
- bot_proveedores

Accion recomendada antes de migrar:

1. Definir roles funcionales: admin, cajero, almacen, compras, auditor.
2. Crear policies por modulo.
3. Denegar acceso anonimo salvo endpoints publicos reales.
4. Probar con usuario real sin service_role.

### P0 - Stock de producto no cuadra con lotes activos

Hay 4 productos donde `bot_productos.nstock` no coincide con la suma de `bot_lotes.ncantidad_actual` activos.

| Producto | Nombre | Stock producto | Stock lotes activos | Diferencia |
|---:|---|---:|---:|---:|
| 59 | Producto QA Flujo Completo E2E-20260811223124 | 7 | 6 | 1 |
| 60 | Producto QA Flujo Completo E2E-20260811223208 | 7 | 6 | 1 |
| 61 | Producto QA Flujo Completo E2E-20260811223248 | 7 | 6 | 1 |
| 62 | Producto QA Flujo Completo E2E-20260811223349 | 7 | 6 | 1 |

Interpretacion tecnica:

Los productos QA parecen venir de pruebas end-to-end. Probable causa: ajustes de kardex modifican el stock global del producto, pero no actualizan/crean lote. En una botica con FEFO y vencimientos, el stock real debe vivir por lote y almacen; el stock global solo debe ser derivado o sincronizado de manera transaccional.

Riesgo:

- Venta con stock que no existe en lotes.
- Kardex diferente al inventario fisico.
- Migracion cloud arrastra inconsistencia.

Accion recomendada:

1. Antes de Supabase, decidir si se eliminan datos QA o se reconcilian.
2. Ajustes de inventario deben exigir lote y almacen.
3. `bot_productos.nstock` debe ser cache derivado de lotes, no fuente principal.
4. Agregar constraint/proceso de auditoria que detecte diferencias.

### P0 - Lote vencido sigue activo con stock

Existe un lote vencido activo con cantidad disponible.

| Lote ID | Producto | Codigo | Lote | Vencimiento | Cantidad | Estado |
|---:|---|---|---|---|---:|---|
| 57 | Simvastatina 20 mg (Merck) | CAR-057 | MK-7741 | 2026-06-28 | 150 | ACTIVO |

Fecha de auditoria: 2026-08-17. El lote ya vencio y conserva stock activo.

Riesgo:

- Venta accidental de producto vencido.
- FEFO puede mostrarlo si la vista no filtra correctamente.
- Problema operativo y regulatorio.

Accion recomendada:

1. Marcar lote como VENCIDO o BLOQUEADO.
2. Crear flujo de baja por vencimiento.
3. Bloquear venta de lotes vencidos por constraint/regla transaccional, no solo UI.
4. Crear tarea diaria de vencimientos.

### P0 - No hay control formal de migraciones

No se encontro tabla tipo `schema_migrations` ni historial canonico de migraciones aplicadas.

Riesgo:

- Supabase no sabra que version exacta del schema esta corriendo.
- Cambios manuales pueden perderse.
- Dificil auditar staging vs produccion.

Accion recomendada:

1. Crear baseline SQL actual.
2. Usar `supabase/migrations` o migraciones Drizzle como fuente canonica.
3. Todo cambio DB futuro debe entrar como migracion versionada.
4. Probar restore desde cero antes de tocar nube productiva.

## Hallazgos altos

### P1 - FK duplicada e inconsistente en compras/usuario

`bot_compras.nusuario_id` tiene dos llaves foraneas hacia `bot_usuarios(nid)` con acciones distintas:

- `bot_compras_nusuario_id_fkey`: ON DELETE NO ACTION.
- `fk_bot_compras_usuario`: ON DELETE SET NULL.

Esto debe limpiarse. Una misma relacion no debe tener dos politicas de borrado contradictorias.

Recomendacion:

- Mantener una sola FK.
- Para historico de compras, preferible `ON DELETE SET NULL` o prohibir borrado fisico de usuarios y usar desactivacion logica.

### P1 - Indices faltantes en columnas FK de alto trafico

Se detectaron varias columnas FK sin indice dedicado. PostgreSQL no crea indices automaticamente para foreign keys. Esto puede afectar deletes, updates y joins.

Prioridad alta:

- bot_ventas_det.nventa_id
- bot_ventas_det.nproducto_id
- bot_compras_det.ncompra_id
- bot_compras_det.nproducto_id
- bot_compras.nproveedor_id
- bot_ventas.nusuario_id
- bot_productos.nproveedor_id
- bot_caja_movimientos relacionados a caja/usuario si aplica
- bot_lotes producto/almacen si alguna columna no esta cubierta por indices compuestos utiles

Accion recomendada:

Crear indices para FKs que participen en joins frecuentes y operaciones de cascada/validacion. Medir con `EXPLAIN ANALYZE` en consultas reales.

### P1 - Precios: tabla canonica vacia y columnas legacy activas

`bot_producto_precios` y `bot_producto_precios_hist` estan vacias, pero productos tienen precios en columnas como `npreventa`, `npreventa_2`, `npreventa_3`.

Ademas existen triggers de sincronizacion legacy:

- `trg_bot_producto_precios_hist`
- `trg_bot_producto_precios_tmodifi`
- `trg_sync_producto_precios_legacy`

Riesgo:

- Dos fuentes de verdad para precios.
- Historial de precios incompleto.
- Dificil mantener auditoria en cloud.

Accion recomendada:

1. Elegir modelo canonico.
2. Si la tabla nueva gana, backfill desde columnas actuales.
3. Si las columnas legacy se mantienen, eliminar tabla/triggers no usados.
4. Documentar regla de precio usado en venta.

### P1 - Catalogos producto vacios

Todas las filas de productos tienen `nfamilia_id`/`ncategoria_id` sin poblar. Las tablas `bot_familias_producto` y `bot_categorias_producto` estan vacias.

Riesgo:

- Filtros/reportes por familia/categoria dependen de texto libre.
- Menos control de duplicados.
- Migracion arrastra catalogos incompletos.

Accion recomendada:

1. Poblar catalogos desde valores actuales de `cfamilia`/`ccategoria`.
2. Backfill de IDs en `bot_productos`.
3. Mantener texto libre solo si es necesario para compatibilidad.

### P1 - Usuarios y autenticacion no cerrados para nube

Hay 2 usuarios activos sin `clerk_id`. Si se migrara a Supabase Auth, falta una estrategia clara.

Riesgo:

- Usuarios locales y auth cloud quedan desalineados.
- Passwords locales pueden quedar expuestos si frontend/API consulta `bot_usuarios`.

Accion recomendada:

1. Decidir: Clerk, Supabase Auth o JWT propio.
2. Si se usa Supabase Auth, crear relacion `bot_usuarios.auth_user_id uuid references auth.users(id)`.
3. No usar `cclave` como auth principal en cloud.
4. Limitar acceso a datos de usuario via RLS/backend.

### P1 - Tablas legacy/vacias no decididas

Tablas `kardex` y `tipos_movimiento` existen vacias fuera del prefijo `bot_`.

Riesgo:

- Ruido de schema.
- Confusion con `bot_kardex`.
- Migracion innecesaria.

Accion recomendada:

- Si no son usadas por codigo actual, dropearlas en migracion limpia posterior a backup.
- Si se preservan, documentar razon.

### P1 - Timestamps y zona horaria

Para nube conviene estandarizar columnas temporales a `timestamptz` donde representen instantes reales.

Riesgo:

- Desfase entre America/Lima, servidor Supabase y clientes.
- Reportes diarios/caja pueden cerrar en fecha incorrecta.

Accion recomendada:

- Auditar columnas `t*` y `d*`.
- Usar `timestamptz` para eventos.
- Usar `date` solo para fechas de negocio sin hora, como vencimiento.

## Hallazgos medios

### P2 - Nombres tecnicos heredados

El schema usa prefijos tipo `n`, `c`, `t`, `l` en columnas. No es bloqueante, pero baja legibilidad para nuevos devs.

Recomendacion:

- No renombrar todo antes de migrar si hay poco tiempo.
- Documentar diccionario de datos.
- Renombrar gradualmente solo si se controla impacto en backend/frontend.

### P2 - Auditoria y PII

La base contiene datos sensibles: DNI/RUC, nombres, telefonos, emails, direcciones, usuarios y claves/hash.

Recomendacion:

- Clasificar PII por tabla.
- Definir retencion de auditoria.
- Evitar dumps productivos sin cifrado.
- Crear backup cifrado antes de subir a nube.

### P2 - Estadisticas y mantenimiento

Despues de restaurar en Supabase:

- Ejecutar `ANALYZE`.
- Revisar planes de consulta.
- Agregar indices solo donde el plan lo justifique.

## Integridad: lo que esta bien

No se encontraron problemas en estos controles:

| Control | Resultado |
|---|---:|
| Compras credito sin CXP | 0 |
| Compras sin detalle | 0 |
| Compras con total distinto a detalle | 0 |
| CXP con saldo incorrecto | 0 |
| Kardex con stock negativo | 0 |
| Lotes activos sin almacen | 0 |
| Lotes con cantidad negativa | 0 |
| Productos con stock negativo | 0 |
| Ventas sin detalle | 0 |
| Ventas con total distinto a detalle | 0 |
| Detalles compra huerfanos | 0 |
| Detalles venta huerfanos | 0 |
| Lotes sin producto | 0 |
| Kardex sin producto | 0 |
| Movimientos caja sin caja | 0 |
| CXP sin compra | 0 |
| Productos activos duplicados por nombre | 0 |
| Proveedores con RUC invalido | 0 |
| Productos activos sin proveedor | 0 |
| Precios venta cero | 0 |

Esto indica que los flujos principales de compra, venta, CXP, caja e inventario tienen buena base de integridad. El problema no es caos total; el problema es preparacion cloud, seguridad y consistencia fina de inventario/lotes.

## Plan recomendado antes de migrar a Supabase

### Fase 1 - Congelar y respaldar

1. Congelar cambios funcionales de DB.
2. Crear dump completo local.
3. Crear dump schema-only.
4. Crear dump data-only.
5. Guardar checksum.
6. Documentar fecha, commit y base.

Comandos sugeridos:

```bash
mkdir -p backups/supabase-migration
pg_dump -d botica_db -Fc --no-owner --no-privileges \
  -f backups/supabase-migration/botica_db_local_$(date +%Y%m%d_%H%M).dump

pg_dump -d botica_db --schema-only --no-owner --no-privileges \
  > backups/supabase-migration/schema_baseline_$(date +%Y%m%d_%H%M).sql
```

### Fase 2 - Limpieza de datos

1. Resolver lote vencido activo.
2. Eliminar o reconciliar productos QA E2E.
3. Cuadrar stock producto vs lotes.
4. Decidir tablas legacy vacias.
5. Limpiar FK duplicada.

### Fase 3 - Baseline de migraciones

1. Crear carpeta `supabase/migrations` o consolidar Drizzle.
2. Versionar schema inicial.
3. Crear tabla de control si se usa migrador propio.
4. Probar restore en una DB local vacia.

### Fase 4 - Seguridad cloud

1. Definir estrategia de auth.
2. Crear roles/policies.
3. Activar RLS en tablas expuestas.
4. Testear con usuarios admin/cajero/almacen.
5. Verificar que anon no vea datos privados.

### Fase 5 - Modelo canonico

1. Catalogos familia/categoria.
2. Precios canonicos.
3. Stock por lote/almacen como fuente real.
4. `bot_productos.nstock` como cache o vista calculada.

### Fase 6 - Ensayo Supabase staging

1. Crear proyecto Supabase staging.
2. Restaurar con `--no-owner --no-privileges`.
3. Ejecutar smoke tests.
4. Probar compra -> lote -> kardex -> venta -> caja -> reportes.
5. Medir consultas lentas.

### Fase 7 - Corte controlado

1. Backup final local.
2. Restaurar en Supabase.
3. Correr auditoria post-restore.
4. Cambiar backend a connection string cloud.
5. Mantener rollback local listo.

## Checklist bloqueante antes de nube

- [ ] Backup completo creado y verificado.
- [ ] Restore probado en DB vacia.
- [ ] RLS/policies definidos o acceso directo Supabase bloqueado.
- [ ] Lote vencido activo resuelto.
- [ ] Stock producto vs lotes reconciliado.
- [ ] Productos QA/test retirados o marcados como datos de prueba.
- [ ] FK duplicada `bot_compras.nusuario_id` corregida.
- [ ] Migraciones versionadas creadas.
- [ ] Modelo de auth decidido.
- [ ] Tablas legacy decididas.
- [ ] Indices FK de alto trafico revisados.

## Fuentes Supabase revisadas

- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase roles: https://supabase.com/docs/guides/database/postgres/roles
- Supabase Postgres migration: https://supabase.com/docs/guides/platform/migrating-to-supabase/postgres
- Supabase database overview: https://supabase.com/docs/guides/database/overview

## Conclusion

Mi recomendacion profesional: no migrar todavia a produccion Supabase. Primero hacer una migracion staging.

La base esta bastante sana en integridad transaccional: compras, ventas, CXP, caja y orfandad estan bien. Pero para nube falta seguridad RLS, limpieza de datos QA, control de migraciones y correccion del modelo inventario/lote.

Prioridad inmediata:

1. Backup verificado.
2. Corregir vencidos y stock/lotes.
3. Baseline de migraciones.
4. RLS/policies o backend-only estricto.
5. Ensayo Supabase staging.
