# Matriz seguridad Supabase - Fase 6

Proyecto: BoticaElPueblo-RebrandLab  
Modelo elegido: backend-only  
Fecha: 2026-08-18

## Decision

Frontend no debe consultar Supabase directo.

Toda operacion pasa por Fastify:

- Auth app.
- Permisos app.
- Validaciones negocio.
- Auditoria app.
- Conexion DB server-side.

## Roles

| Rol | Uso | Acceso DB |
|---|---|---|
| anon | Publico/no login | Bloqueado |
| authenticated | Cliente Supabase directo | Bloqueado por defecto |
| service_role | Server-side only | Permitido solo backend/ops |
| postgres/owner | Admin DB | Solo ops |

## Reglas aplicadas

| Control | Estado |
|---|---|
| RLS en tablas publicas | ON 38/38 |
| Policies cliente | 0 |
| Grants anon/authenticated | 0 en local |
| Views | `security_invoker=true` |
| Execute publico funciones | Revocado |
| service key frontend | Prohibido |

## Implicacion

Como no hay policies, `anon` y `authenticated` no pueden leer/escribir tablas via API.

Esto es intencional en Fase 6 porque el sistema aun usa Fastify como backend principal.

## Futuro si se usa Supabase client

Crear policies por modulo:

- inventario read para roles internos.
- ventas insert para cajero.
- caja insert/update para cajero con caja propia.
- compras para compras/admin.
- auditoria solo admin.
- usuarios solo admin.
- pacientes/medicos con PII restringida.

Hasta tener esas policies, no usar Supabase client en frontend.

## Secretos

Nunca poner en frontend:

- `service_role`
- password postgres
- URL con password

Permitido frontend:

- publishable key solo cuando existan policies seguras.

## Checklist seguridad antes nube

- [x] RLS ON en tablas publicas.
- [x] Views security_invoker.
- [x] Execute publico funciones revocado.
- [x] Auditoria scripts actualizada.
- [ ] Revisar `.env`/build para confirmar no hay service key en frontend.
- [ ] En Supabase staging verificar roles reales `anon`, `authenticated`, `service_role`.
- [ ] Re-ejecutar audit script contra Supabase staging.
- [ ] Crear policies si frontend empieza a usar Supabase client.
