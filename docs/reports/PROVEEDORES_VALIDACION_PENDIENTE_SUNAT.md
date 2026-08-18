# PROVEEDORES - VALIDACION SUNAT PENDIENTE

Fecha: 2026-04-12

## Estado actual implementado

En esta fase el módulo de proveedores valida:

- RUC obligatorio
- razón social obligatoria
- teléfono obligatorio
- persona de contacto obligatoria
- RUC único
- edición sin permitir dejar el proveedor incompleto

Campos opcionales:

- dirección
- email

## Alcance que NO se implementa ahora

La validación contra SUNAT queda pendiente para una fase futura.

No se implementó en esta iteración:

- consulta a API SUNAT
- autocompletado de razón social desde padrón SUNAT
- validación de estado de contribuyente
- validación de condición de domicilio

## Motivo

El objetivo de esta fase es cerrar consistencia ERP mínima y operativa, sin agregar dependencias externas ni bloquear operación por disponibilidad de terceros.

## Fase futura recomendada

Cuando se aborde la integración SUNAT:

1. validar existencia del RUC en línea
2. precargar razón social oficial
3. registrar fecha y resultado de validación
4. permitir override manual sólo a usuarios administradores
