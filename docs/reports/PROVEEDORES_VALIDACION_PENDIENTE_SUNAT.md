# PROVEEDORES - VALIDACION SUNAT PENDIENTE

Fecha: 2026-08-18

## Decision de alcance

SUNAT queda formalmente pospuesto. No bloquea el cierre funcional ni el despliegue
de inventario, compras, ventas, caja, usuarios o autenticacion.

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
5. definir proveedor/API, credenciales, limites y costos
6. agregar timeout, reintentos y operacion manual cuando SUNAT no responda
7. guardar auditoria sin almacenar secretos ni respuestas sensibles innecesarias
8. probar altas, ediciones, caidas externas y RUC invalido
