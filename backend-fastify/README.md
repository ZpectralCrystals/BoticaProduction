# Botica Backend - Fastify + Supabase

Backend API para sistema de farmacia y clínica con soporte completo para inventario FEFO, fraccionamiento y Kardex.

## Stack Tecnológico

- **Fastify 5** - Framework HTTP
- **Supabase** - PostgreSQL + Auth
- **Zod** - Validaciones de esquemas
- **TypeScript** - Tipado estático
- **JWT** - Autenticación
- **OpenAPI/Swagger** - Documentación

## Estructura de Carpetas

```
src/
├── plugins/
│   ├── supabase.ts           # Cliente Supabase
│   ├── auth.ts               # Autenticación JWT
│   └── error-handler.ts      # Manejo de errores
├── routes/
│   ├── ventas.routes.ts      # Endpoints de ventas
│   └── inventario.routes.ts  # Endpoints de inventario
├── services/
│   ├── ventas.service.ts     # Lógica de negocio ventas
│   └── inventario.service.ts # Lógica FEFO
├── schemas/
│   └── index.ts              # Schemas Zod
├── types/
│   └── database.ts           # Tipos de Supabase
└── server.ts                 # Entry point
```

## Instalación

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de Supabase

# Desarrollo
npm run dev

# Producción
npm run build
npm start
```

## Variables de Entorno

```env
NODE_ENV=development
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
JWT_SECRET=your-secret
CORS_ORIGIN=http://localhost:5173
```

## Endpoints Principales

### Ventas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/ventas` | Crear venta con FEFO |
| GET | `/api/v1/ventas` | Listar ventas |
| GET | `/api/v1/ventas/:id` | Obtener venta |
| POST | `/api/v1/ventas/:id/anular` | Anular venta |
| POST | `/api/v1/ventas/validar-stock` | Validar disponibilidad |

### Inventario

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/inventario` | Buscar productos |
| GET | `/api/v1/inventario/lotes/:productoId` | Lotes FEFO |
| GET | `/api/v1/inventario/productos/:id` | Detalle producto |
| GET | `/api/v1/inventario/validar/:loteId` | Validar stock lote |

## Flujo de Venta (FEFO)

```
POST /api/v1/ventas
├── 1. Validar datos de entrada (Zod)
├── 2. Para cada producto:
│   ├── Calcular unidades base (fraccionamiento)
│   └── Buscar lotes FEFO (fecha vencimiento ASC)
├── 3. Generar código VTA-YYYYMMDD-XXXX
├── 4. Llamar RPC crear_venta_completa (transacción)
│   ├── Insertar venta
│   ├── Insertar detalle por lote
│   ├── Descontar stock de lotes
│   └── Registrar kardex
└── 5. Retornar venta completa con items asignados
```

## Características Implementadas

### FEFO (First Expired First Out)
- Selección automática del lote más próximo a vencer
- Soporte para múltiples lotes por item si es necesario
- Validación de fechas de vencimiento

### Fraccionamiento
- Venta por unidad (tableta)
- Venta por caja/blister
- Cálculo automático de unidades base
- Precios diferenciados por unidad/caja

### Kardex
- Registro automático de cada movimiento
- Cantidades anterior/nueva
- Costos al momento de la transacción
- Precios de venta para cálculo de utilidad

### Transacciones
- Todas las operaciones son atómicas
- Rollback automático en caso de error
- Bloqueo de lotes durante la venta (FOR UPDATE)

## Documentación

Disponible en: `http://localhost:3000/documentation`

## Scripts SQL Requeridos

Ejecutar en Supabase SQL Editor:

```sql
-- Funciones RPC para transacciones
\i supabase/functions.sql
```

## Seguridad

- Autenticación JWT via Supabase Auth
- Row Level Security (RLS) en todas las tablas
- Validación de esquemas con Zod
- Sanitización de inputs

## Licencia

MIT
