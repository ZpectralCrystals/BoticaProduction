# Documentación Botica El Pueblo

Índice oficial de documentación. Archivos de raíz limitados a `README.md`,
`AGENTS.md` y `CLAUDE.md` por compatibilidad con GitHub y herramientas.

## Estado vigente

- [`reports/CIERRE_FUNCIONAL_PROGRAMACION_20260818.md`](reports/CIERRE_FUNCIONAL_PROGRAMACION_20260818.md)
- [`reports/STATUS_VERCEL_CONFIG_20260818.md`](reports/STATUS_VERCEL_CONFIG_20260818.md)
- [`reports/STATUS_DB_PRODUCTIVA_SUPABASE_20260818_FASE_8.md`](reports/STATUS_DB_PRODUCTIVA_SUPABASE_20260818_FASE_8.md)
- [`manuales/MANUAL_USUARIO_BOTICA_EL_PUEBLO.md`](manuales/MANUAL_USUARIO_BOTICA_EL_PUEBLO.md)

## Carpetas

| Carpeta | Contenido |
|---|---|
| `architecture/` | Modelo, decisiones y relaciones técnicas |
| `audits/` | Auditorías de código, DB y flujos |
| `context/` | Contexto funcional y radiografías del sistema |
| `guides/` | Guías por módulo |
| `manuales/` | Manual de usuario e imágenes |
| `operations/` | Despliegue, backup, seguridad y operación |
| `rebrand/` | Informes del rediseño local |
| `reports/` | Estados, QA y cierres vigentes |
| `reports/phases/` | Historial de fases implementadas |

## Alcance actual

Programación cerrada para inventario, compras, ventas, FEFO, Kardex, caja,
anulaciones, CXP, almacenes, consistencia, usuarios y permisos.

Base productiva: Supabase Free. Despliegue: Vercel. Autenticación activa: JWT.

Fuera de fase: SUNAT, Clerk completo, migración total a Drizzle, monitoreo externo
y decisiones operativas del negocio. No son bloqueantes del cierre funcional.
