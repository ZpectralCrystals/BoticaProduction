# Status DB productiva Supabase - Fase 0 y 1

Proyecto: BoticaElPueblo-RebrandLab  
Fecha operativa: 2026-08-17 23:17 America/Lima  
Objetivo: preparar camino seguro para arreglar DB antes de Supabase.

## Resultado

Fase 0: completada.  
Fase 1: completada.

No se modifico `botica_db`.

## Backup creado

Carpeta:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/supabase-migration/20260817_231749`

Archivos:

- `botica_db_local_20260817_231749.dump`
- `schema_baseline_20260817_231749.sql`
- `data_only_20260817_231749.sql`
- `restore_list_20260817_231749.txt`
- `SHA256SUMS.txt`
- `db_identity.txt`
- `staging_db.txt`

Tamano total: 480K.

## Nota git

Esta copia local `BoticaElPueblo-RebrandLab` no es repo git activo.

Registro guardado:

`NO_GIT_REPO`

## Staging local creado

DB staging:

`botica_db_staging_20260817_231749`

Restauracion:

- Dump restaurado OK.
- 38 tablas publicas restauradas.

## Auditoria staging pre-fix

Archivo:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/supabase-migration/20260817_231749/audit_staging_pre_fix.txt`

Hallazgos:

| Check | Resultado |
|---|---:|
| RLS enabled tables | 0 |
| RLS disabled tables | 38 |
| Policies | 0 |
| Lotes activos vencidos con stock | 1 |
| Productos stock vs lotes mismatch | 4 |
| Compras credito sin CXP | 0 |
| Ventas sin detalle | 0 |
| Compras sin detalle | 0 |

Lote vencido activo:

- Producto: Simvastatina 20 mg (Merck)
- Codigo: CAR-057
- Lote: MK-7741
- Vencimiento: 2026-06-28
- Stock: 150
- Estado: ACTIVO

Stock mismatch:

- MED-059: nstock 7, lotes 6, diff 1
- MED-060: nstock 7, lotes 6, diff 1
- MED-061: nstock 7, lotes 6, diff 1
- MED-062: nstock 7, lotes 6, diff 1

## Siguiente paso

Fase 2: limpiar datos bloqueantes en staging.

Acciones propuestas:

1. Marcar lote vencido `MK-7741` como `VENCIDO`.
2. Reconciliar productos QA `MED-059` a `MED-062`.
3. Crear migracion SQL reproducible.
4. Ejecutar auditoria post-fix.

Confirmacion requerida antes de aplicar Fase 2.
