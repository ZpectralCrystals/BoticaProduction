# PROVEEDORES_VALIDACION_IMPLEMENTADA

## 1. Campos obligatorios

Desde esta fase, un proveedor solo puede crearse o editarse si tiene completos:

- RUC
- razón social
- teléfono
- persona de contacto

Campos recomendados, pero no obligatorios:

- dirección
- email

## 2. Validaciones backend

Archivo principal: `backend-fastify/src/routes/providers.routes.ts`

Se implementó validación dura en creación y edición:

- RUC obligatorio
- RUC normalizado a solo dígitos
- RUC de exactamente 11 dígitos
- razón social obligatoria
- teléfono obligatorio
- teléfono con mínimo 6 dígitos útiles
- contacto obligatorio
- email opcional, pero validado si se informa
- estado solo permitido: `ACTIVO` o `INACTIVO`
- RUC único

Mensajes de error principales:

- `RUC, razón social, teléfono y contacto son obligatorios`
- `El RUC debe tener exactamente 11 dígitos`
- `El teléfono debe tener al menos 6 dígitos`
- `El email del proveedor no es válido`
- `El estado del proveedor debe ser ACTIVO o INACTIVO`
- `Ya existe un proveedor registrado con ese RUC`

Además:

- la edición ya no permite dejar un proveedor incompleto
- la búsqueda pública para compras e inventario sigue devolviendo solo proveedores activos
- la pantalla de mantenimiento de proveedores puede solicitar activos e inactivos para administración

## 3. Validaciones frontend

Archivo principal: `frontend/src/pages/proveedores-page.tsx`

Se reforzó el formulario para que:

- RUC sea obligatorio
- razón social sea obligatoria
- teléfono sea obligatorio
- contacto sea obligatorio
- el submit se bloquee si falta alguno
- se muestren errores visuales claros antes de guardar
- el RUC se normalice a máximo 11 dígitos
- el estado del proveedor sea visible y editable como `ACTIVO` o `INACTIVO`

La UI de mantenimiento ahora:

- lista proveedores activos e inactivos
- marca proveedores incompletos históricos
- deja claro que los inactivos no deben usarse en compras nuevas

## 4. Cambios en BD

Migración agregada:

- `ops/migrations/013_proveedores_ruc_unico_y_auditoria.sql`

La migración:

- asegura valor por defecto `A` para `cestado`
- valida soporte operativo para `A` e `I`
- crea la vista `vw_bot_proveedores_invalidos`
- crea la vista `vw_bot_proveedores_ruc_duplicados`
- intenta crear el índice único `ux_bot_proveedores_ruc_normalizado`

Comportamiento importante:

- si hay duplicados históricos de RUC, la migración no crea el índice de manera silenciosa
- en ese caso emite advertencia y deja la vista `vw_bot_proveedores_ruc_duplicados` para auditoría y limpieza

Esto evita romper despliegues de forma opaca y deja trazable el motivo por el cual no se pudo endurecer la unicidad a nivel índice en ese entorno.

## 5. Cómo detectar proveedores inválidos ya existentes

Consulta de auditoría general:

```sql
SELECT *
FROM vw_bot_proveedores_invalidos
ORDER BY nid;
```

Consulta de RUC duplicados:

```sql
SELECT *
FROM vw_bot_proveedores_ruc_duplicados
ORDER BY ruc;
```

Consulta puntual sin depender de vistas:

```sql
SELECT
  nid,
  cruc,
  cnombre,
  ccontacto,
  ctelefono,
  cestado
FROM bot_proveedores
WHERE
  NULLIF(REGEXP_REPLACE(COALESCE(cruc, ''), '\D', '', 'g'), '') IS NULL
  OR LENGTH(REGEXP_REPLACE(COALESCE(cruc, ''), '\D', '', 'g')) <> 11
  OR NULLIF(BTRIM(COALESCE(cnombre, '')), '') IS NULL
  OR NULLIF(BTRIM(COALESCE(ccontacto, '')), '') IS NULL
  OR NULLIF(BTRIM(COALESCE(ctelefono, '')), '') IS NULL;
```

## 6. Estado del proveedor y borrado físico

El modelo operativo queda así:

- `ACTIVO`: proveedor disponible para operaciones nuevas
- `INACTIVO`: proveedor preservado para historial, auditoría y trazabilidad

No se implementó borrado físico en la API Fastify de proveedores.

Decisión de negocio:

- si un proveedor tiene historial de compras, debe preservarse
- la forma correcta de retirarlo de operación es marcarlo `INACTIVO`

Esto evita romper:

- compras históricas
- trazabilidad de abastecimiento
- auditoría de devoluciones
- reportes por proveedor

## 7. Compatibilidad con compras existentes

No se rompe el módulo de compras:

- compras sigue usando `nproveedor_id` como fuente de verdad
- compras nuevas solo deben trabajar con proveedores activos
- los proveedores inactivos siguen resolviendo historial y reportes

## 8. Pendiente futuro: validación SUNAT

La validación con SUNAT queda pendiente para una fase futura y no se implementa en esta etapa.

Pendientes futuros sugeridos:

- validar existencia real del RUC contra SUNAT
- validar razón social oficial contra SUNAT
- detectar condición de baja o suspensión
- marcar diferencias entre dato interno y dato tributario oficial

## 9. Resultado para la siguiente fase

Sí: el sistema ya quedó listo para aplicar validaciones más duras sobre proveedores sin afectar el flujo de compras.

Impacto esperado en compras:

- mejora la trazabilidad del proveedor origen
- reduce compras ambiguas
- deja mejor base para devoluciones a proveedor
- facilita una futura validación tributaria más estricta
