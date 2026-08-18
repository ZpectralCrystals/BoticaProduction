# Módulo Clínico - Botica con Consultorio

## 1. Visión General

El **Módulo Clínico** integra el consultorio médico con el sistema POS de la botica, permitiendo:

- Gestión de pacientes con historia clínica
- Registro de consultas médicas
- Emisión de recetas electrónicas
- Despacho de medicamentos recetados desde el POS
- Trazabilidad completa médico-paciente-farmacia

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FLUJO CLÍNICO-POS                                   │
└─────────────────────────────────────────────────────────────────────────┘

   CONSULTORIO                    BOTICA (POS)
       │                               │
       │  1. CREAR HISTORIA CLÍNICA    │
       │     + Receta                  │
       ├──────────────────────────────►│
       │                               │
       │                               │  2. Buscar Receta
       │                               │     por código
       │◄──────────────────────────────┤
       │     3. Receta encontrada      │
       │                               │
       │                               │  4. Cargar items
       │                               │     en carrito
       │                               │
       │                               │  5. Validar stock FEFO
       │                               │     y despachar
       │◄──────────────────────────────┤
       │  6. Actualizar estado receta  │
       │     (PENDIENTE → COMPLETADO)  │
       │                               │
       │  7. Registrar en Kardex       │
       │     con vinculación receta    │
```

## 2. Estructura de Tablas

### 2.1 `pacientes`

```sql
┌─────────────────────────────────────────────────────────────────────────┐
│ PACIENTES                                                               │
├─────────────────────────────────────────────────────────────────────────┤
│ id                    SERIAL PRIMARY KEY                                │
│ codigo_historia       VARCHAR(50) UNIQUE    → HCL-00001               │
│ tipo_documento_id     INTEGER               → DNI, CE, Pasaporte        │
│ numero_documento      VARCHAR(20) UNIQUE                              │
│ apellido_paterno      VARCHAR(100) NOT NULL                             │
│ apellido_materno      VARCHAR(100)                                      │
│ nombres               VARCHAR(100) NOT NULL                             │
│ nombre_completo       GENERATED (apellidos + nombres)                 │
│ fecha_nacimiento      DATE                                              │
│ edad                  INTEGER GENERATED                                 │
│ sexo                  VARCHAR(1)          → M / F                       │
│ telefono, celular, email, direccion                                     │
│ grupo_sanguineo       VARCHAR(10)         → A+, O-, etc.                │
│ alergias              TEXT                                              │
│ condiciones_cronicas  TEXT              → Diabetes, Hipertensión      │
│ medicamentos_habituales TEXT                                            │
│ contacto_emergencia_*  Nombre, teléfono, parentesco                    │
│ estado                VARCHAR(20)         → ACTIVO, INACTIVO           │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 `historias_clinicas` (Consultas)

```sql
┌─────────────────────────────────────────────────────────────────────────┐
│ HISTORIAS CLÍNICAS (Consultas Médicas)                                  │
├─────────────────────────────────────────────────────────────────────────┤
│ id                    SERIAL PRIMARY KEY                                │
│ paciente_id           INTEGER → FK pacientes                            │
│ fecha_atencion        TIMESTAMP NOT NULL                               │
│ tipo_atencion         VARCHAR(50)         → CONSULTA, EMERGENCIA, CONTROL│
│ motivo_consulta       TEXT                                              │
│ enfermedad_actual     TEXT                                              │
│ tiempo_enfermedad    VARCHAR(100)                                       │
│ ───────────────────── SIGNOS VITALES ─────────────────────              │
│ temperatura           DECIMAL(4,2)        → °C                          │
│ presion_arterial      VARCHAR(20)         → 120/80                      │
│ frecuencia_cardiaca   INTEGER             → ppm                        │
│ frecuencia_respiratoria INTEGER           → rpm                        │
│ peso                  DECIMAL(5,2)        → kg                        │
│ talla                 DECIMAL(5,2)        → cm                          │
│ imc                   DECIMAL(4,2) GENERATED                          │
│ saturacion_o2         INTEGER             → %                           │
│ ───────────────────── EXAMEN ─────────────────────────────              │
│ examen_general      TEXT                                                │
│ examen_especifico     TEXT                                              │
│ ───────────────────── DIAGNÓSTICO ────────────────────────              │
│ diagnostico_principal TEXT                                                │
│ diagnosticos_secundarios TEXT                                           │
│ tratamiento           TEXT                                                │
│ indicaciones          TEXT                                                │
│ reposo_dias           INTEGER                                             │
│ proxima_cita          DATE                                                │
│ medico_id, medico_nombre UUID/VARCHAR                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 `historias_diagnosticos` (CIE-10)

```sql
┌─────────────────────────────────────────────────────────────────────────┐
│ HISTORIAS_DIAGNOSTICOS                                                  │
├─────────────────────────────────────────────────────────────────────────┤
│ id                    SERIAL PRIMARY KEY                                │
│ historia_id           INTEGER → FK historias_clinicas                 │
│ codigo_cie10          VARCHAR(10)         → A00, B01, etc.              │
│ descripcion           TEXT                                              │
│ tipo                  VARCHAR(20)         → PRESUNTIVO, DEFINITIVO      │
│ orden                 INTEGER                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.4 `recetas`

```sql
┌─────────────────────────────────────────────────────────────────────────┐
│ RECETAS MÉDICAS                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ id                    SERIAL PRIMARY KEY                                │
│ uuid                  UUID                                              │
│ historia_id           INTEGER → FK historias_clinicas (opcional)        │
│ paciente_id           INTEGER → FK pacientes (requerido)                │
│ codigo                VARCHAR(50) UNIQUE → REC-YYYYMMDD-XXXX              │
│ fecha_emision         TIMESTAMP NOT NULL                                │
│ fecha_vencimiento     DATE              → Válida 30 días por defecto    │
│ estado                VARCHAR(20):                                      │
│                       → ACTIVA     (pendiente de despacho)            │
│                       → PARCIAL    (algunos items despachados)          │
│                       → COMPLETADA (todos los items despachados)        │
│                       → VENCIDA      (pasó fecha límite)                │
│                       → ANULADA      (cancelada por médico)             │
│ total_items           INTEGER                                           │
│ total_despachado      INTEGER                                           │
│ indicaciones_generales TEXT                                             │
│ observaciones         TEXT                                              │
│ medico_id, medico_nombre, medico_colegiatura, medico_especialidad       │
│ sucursal_id           INTEGER → FK sucursales                             │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.5 `recetas_detalle`

```sql
┌─────────────────────────────────────────────────────────────────────────┐
│ RECETAS_DETALLE (Medicamentos Recetados)                                │
├─────────────────────────────────────────────────────────────────────────┤
│ id                    SERIAL PRIMARY KEY                                │
│ receta_id             INTEGER → FK recetas                              │
│ producto_id           INTEGER → FK productos                            │
│ cantidad_recetada     INTEGER NOT NULL                                  │
│ cantidad_despachada   INTEGER DEFAULT 0                                 │
│ unidad_medida         VARCHAR(20)         → Tabletas, Cápsulas, ml      │
│ ───────────────────── POSOLOGÍA ─────────────────────────               │
│ dosis                 VARCHAR(100)        → "1 tableta", "5ml"          │
│ frecuencia            VARCHAR(100)        → "Cada 8 horas"             │
│ duracion              VARCHAR(100)        → "7 días"                      │
│ horario               VARCHAR(100)        → "8am, 2pm, 8pm"             │
│ via_administracion    VARCHAR(100)        → Oral, Tópica, IV            │
│ indicaciones          TEXT              → "Antes de comer"              │
│ estado                VARCHAR(20):                                      │
│                       → PENDIENTE  (sin despachar)                      │
│                       → PARCIAL    (despachado parcial)                 │
│                       → COMPLETADO (despachado completo)              │
│                       → NO_DISPONIBLE (sin stock en farmacia)           │
│ venta_detalle_id      INTEGER → FK ventas_detalle (cuando se vende)     │
└─────────────────────────────────────────────────────────────────────────┘
```

## 3. Relaciones del Modelo

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    RELACIONES ENTIDADES                                 │
└─────────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐         ┌──────────────────┐         ┌──────────────┐
  │  PACIENTES   │◄───────►│ HISTORIAS_CLINICAS│◄───────►│   RECETAS    │
  └──────────────┘  1:N    └──────────────────┘  1:0..1  └──────────────┘
         │                                                           │
         │                    ┌─────────────────────┐                │
         │                    │ HISTORIAS_DIAGNOSTOS│                │
         │                    └─────────────────────┘                │
         │                           1:N                             │
         │                                                           │
         │                      ┌──────────────┐                     │
         └─────────────────────►│RECETAS_DETALLE│◄────────────────────┘
                                └──────────────┘           1:N
                                       │
                                       │ N:1
                                       ▼
                                ┌──────────────┐
                                │   PRODUCTOS  │
                                └──────────────┘
                                       │
                                       │ 1:N
                                       ▼
                                ┌──────────────┐
                                │  LOTES/FEFO  │
                                └──────────────┘
                                       │
                                       │ 1:N
                                       ▼
                                ┌──────────────┐
                                │  KARDEX      │
                                └──────────────┘

  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
  │   RECETAS    │◄────────│VENTAS_DETALLE│────────►│   VENTAS     │
  │              │   N:1   │              │   N:1   │              │
  └──────────────┘         └──────────────┘         └──────────────┘
         │
         │ Cuando se vende un item de receta:
         │ • Se actualiza cantidad_despachada
         │ • Se actualiza estado (PENDIENTE → PARCIAL/COMPLETADO)
         │ • Se registra venta_detalle_id
         │ • Se actualiza estado de receta general
         ▼
  ┌──────────────┐
  │  KARDEX (registra venta_detalle con receta_id)  │
  └──────────────┘
```

## 4. Flujos de Trabajo

### 4.1 Flujo Médico: Consulta → Receta

```
┌─────────────────────────────────────────────────────────────────────────┐
│ FLUJO 1: MÉDICO ATIENDE Y EMITE RECETA                                  │
└─────────────────────────────────────────────────────────────────────────┘

1. BUSCAR/CREAR PACIENTE
   ┌─────────────────────────────────────────────────────────────────────┐
   │ POST /clinical/pacientes/buscar?q=juan perez                       │
   │                                                                     │
   │ Si no existe:                                                       │
   │ POST /clinical/pacientes                                           │
   │ { apellido_paterno, apellido_materno, nombres, documento... }      │
   └─────────────────────────────────────────────────────────────────────┘

2. CREAR CONSULTA MÉDICA
   ┌─────────────────────────────────────────────────────────────────────┐
   │ POST /clinical/consultas                                           │
   │ {                                                                   │
   │   paciente_id: 123,                                                │
   │   motivo_consulta: "Dolor de cabeza",                              │
   │   signos_vitales: { temperatura, presion_arterial... },            │
   │   diagnostico_principal: "Cefalea tensional",                      │
   │   receta: {                                                        │
   │     medicamentos: [                                                │
   │       { producto_id: 1, cantidad: 20, dosis: "1 tableta",          │
   │         frecuencia: "Cada 8 horas", duracion: "5 días" }           │
   │     ],                                                             │
   │     indicaciones_generales: "Tomar con agua"                       │
   │   }                                                                │
   │ }                                                                   │
   │                                                                     │
   │ RESPONSE: { historia: {...}, receta: {...} }                       │
   └─────────────────────────────────────────────────────────────────────┘

3. IMPRIMIR RECETA
   Código de receta generado: REC-20240120-0001
```

### 4.2 Flujo POS: Cargar Receta → Venta

```
┌─────────────────────────────────────────────────────────────────────────┐
│ FLUJO 2: CAJERO/CÁTEDI DESPACHA RECETA EN EL POS                        │
└─────────────────────────────────────────────────────────────────────────┘

1. VERIFICAR RECETA POR CÓDIGO
   ┌─────────────────────────────────────────────────────────────────────┐
   │ GET /clinical/recetas/verificar?codigo=REC-20240120-0001           │
   │                                                                     │
   │ RESPONSE: {                                                        │
   │   receta_id: 456,                                                  │
   │   paciente_nombre: "Juan Pérez García",                            │
   │   receta_estado: "ACTIVA",                                         │
   │   esta_vencida: false,                                             │
   │   dias_para_vencer: 25,                                            │
   │   items_disponibles: 2,                                            │
   │   items_sin_stock: 0,                                              │
   │   puede_despacharse: true                                          │
   │ }                                                                   │
   └─────────────────────────────────────────────────────────────────────┘

2. OBTENER DETALLE CON STOCK PARA POS
   ┌─────────────────────────────────────────────────────────────────────┐
   │ GET /clinical/recetas/456/pos                                      │
   │                                                                     │
   │ RESPONSE: {                                                        │
   │   receta: { id, codigo, estado, medico_nombre },                   │
   │   paciente_id: 123,                                                │
   │   puede_despacharse: true,                                         │
   │   items: [                                                         │
   │     {                                                              │
   │       receta_detalle_id: 789,                                      │
   │       producto_id: 1,                                              │
   │       producto_codigo: "MED-001",                                  │
   │       producto_nombre: "Paracetamol 500mg",                        │
   │       cantidad_recetada: 20,                                       │
   │       cantidad_despachada: 0,                                      │
   │       cantidad_pendiente: 20,                                      │
   │       stock_disponible: 150,                                       │
   │       precio_venta: 0.50,                                          │
   │       disponibilidad: "DISPONIBLE",                              │
   │       dosis: "1 tableta", frecuencia: "Cada 8 horas"               │
   │     }                                                              │
   │   ]                                                                │
   │ }                                                                   │
   └─────────────────────────────────────────────────────────────────────┘

3. CARGAR EN CARRITO DEL POS
   El POS carga automáticamente:
   • Producto: Paracetamol 500mg
   • Cantidad: 20 (según receta)
   • Lote: FEFO automático
   • Precio: $0.50 x 20 = $10.00
   • Vinculado a: receta_detalle_id = 789

4. VENTA INCLUYE VINCULACIÓN
   ┌─────────────────────────────────────────────────────────────────────┐
   │ POST /ventas                                                       │
   │ {                                                                   │
   │   paciente_id: 123,  ← Importante: vincula venta a paciente        │
   │   items: [                                                         │
   │     {                                                              │
   │       producto_id: 1,                                              │
   │       cantidad: 20,                                                │
   │       receta_id: 456,        ← Vincula a receta                     │
   │       receta_detalle_id: 789  ← Vincula a item específico          │
   │     }                                                              │
   │   ]                                                                │
   │ }                                                                   │
   └─────────────────────────────────────────────────────────────────────┘

5. TRIGGER AUTO-ACTUALIZA RECETA
   INSERT en ventas_detalle → TRIGGER → UPDATE recetas_detalle:
   • cantidad_despachada: 0 → 20
   • estado: PENDIENTE → COMPLETADO
   • venta_detalle_id: NULL → 1234
   
   → TRIGGER → UPDATE recetas:
   • estado: ACTIVA → COMPLETADA (si todos los items completados)
   • total_despachado: 0 → 1
```

## 5. Vistas SQL para Consultas

### 5.1 Recetas Pendientes (Dashboard Farmacia)

```sql
SELECT * FROM vista_recetas_pendientes
WHERE sucursal_id = 1
ORDER BY fecha_emision DESC;

-- Resultado:
┌──────────┬─────────────────┬─────────┬───────────┬─────────────────┬──────────────┐
│ receta_id│ codigo          │ estado  │ paciente  │ items_pendientes│ dias_vencer  │
├──────────┼─────────────────┼─────────┼───────────┼─────────────────┼──────────────┤
│ 456      │ REC-20240120-001│ ACTIVA  │ Juan Pérez│ 2               │ 25           │
│ 455      │ REC-20240120-002│ PARCIAL │ María Lópe│ 1               │ 28           │
└──────────┴─────────────────┴─────────┴───────────┴─────────────────┴──────────────┘
```

### 5.2 Detalle de Receta con Stock (POS)

```sql
SELECT * FROM vista_receta_detalle_pos
WHERE receta_id = 456;

-- Resultado:
┌─────┬──────────┬─────────────────────┬─────────────┬───────────┬──────────┬───────────────┐
│ item│ producto │ cantidad_recetada   │ cant_pend   │ stock     │ precio   │ disponibilidad│
├─────┼──────────┼─────────────────────┼─────────────┼───────────┼──────────┼───────────────┤
│ 1   │ Paraceta │ 20                  │ 20          │ 150       │ 0.50     │ DISPONIBLE    │
│ 2   │ Ibuprofe │ 10                  │ 10          │ 45        │ 0.75     │ DISPONIBLE    │
└─────┴──────────┴─────────────────────┴─────────────┴───────────┴──────────┴───────────────┘
```

### 5.3 Ficha del Paciente

```sql
SELECT * FROM get_ficha_paciente(123);

-- Resultado:
┌─────┬───────────────┬───────────────────────┬─────┬─────────────┬──────────────────┐
│ id  │ codigo_historia│ nombre_completo      │ edad│ recetas_activas│ total_consultas │
├─────┼───────────────┼───────────────────────┼─────┼─────────────┼──────────────────┤
│ 123 │ HCL-00001     │ Pérez García Juan    │ 39  │ 2           │ 15               │
└─────┴───────────────┴───────────────────────┴─────┴─────────────┴──────────────────┘
```

## 6. API Endpoints

### 6.1 Pacientes

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/clinical/pacientes/buscar?q=...` | Buscar pacientes |
| `GET` | `/clinical/pacientes/:id` | Obtener paciente |
| `GET` | `/clinical/pacientes/:id/ficha` | Ficha completa |
| `POST` | `/clinical/pacientes` | Crear paciente |
| `PUT` | `/clinical/pacientes/:id` | Actualizar paciente |
| `GET` | `/clinical/pacientes/:id/historias` | Historias del paciente |
| `GET` | `/clinical/pacientes/:id/recetas` | Recetas del paciente |

### 6.2 Historias Clínicas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/clinical/historias/:id` | Obtener historia |
| `POST` | `/clinical/historias` | Crear historia |

### 6.3 Recetas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/clinical/recetas/pendientes` | Recetas pendientes (POS) |
| `GET` | `/clinical/recetas/verificar?codigo=...` | Verificar receta (POS) |
| `GET` | `/clinical/recetas/:id` | Obtener receta |
| `GET` | `/clinical/recetas/:id/pos` | Receta formateada para POS |
| `POST` | `/clinical/recetas` | Crear receta |

### 6.4 Consulta Integrada

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/clinical/consultas` | Consulta + Receta en uno |

## 7. Flujo de Datos POS Integration

```typescript
// 1. Buscar paciente o receta
const { data: pacientes } = await api.clinical.buscarPacientes('juan perez');

// 2. Obtener recetas del paciente
const { data: recetas } = await api.clinical.getRecetasPaciente(pacienteId);

// 3. Cargar receta en el POS
const { data: recetaPOS } = await api.clinical.getRecetaParaPOS(recetaId);

// 4. Agregar items al carrito
recetaPOS.items.forEach(item => {
  cart.addItem({
    producto_id: item.producto_id,
    cantidad: item.cantidad_pendiente,
    receta_id: recetaId,
    receta_detalle_id: item.receta_detalle_id,
    es_receta: true
  });
});

// 5. Procesar venta
const venta = await api.ventas.crear({
  paciente_id: pacienteId,  // Vincula venta a paciente
  items: cart.items,
  total: cart.total
});

// 6. La venta automáticamente actualiza la receta
```

## 8. Reglas de Negocio

| Regla | Implementación |
|-------|----------------|
| **Una receta puede vencer** | `fecha_vencimiento` por defecto 30 días |
| **Despacho parcial permitido** | `cantidad_despachada` puede ser < `cantidad_recetada` |
| **Venta siempre vinculada** | `ventas_detalle` incluye `receta_id` y `receta_detalle_id` |
| **Actualización automática** | Trigger actualiza estado de receta tras venta |
| **Auditoría completa** | `created_by`, `medico_id`, `venta_detalle_id` trazan todo |
| **Stock FEFO** | POS aplica FEFO automáticamente al despachar |

## 9. Archivos del Módulo

| Archivo | Descripción |
|---------|-------------|
| `supabase/clinical_module.sql` | Tablas, vistas, funciones, triggers |
| `src/services/clinical.service.ts` | Servicio backend |
| `src/routes/clinical.routes.ts` | API endpoints |
| `docs/guides/clinical_guia.md` | Esta documentación |

---

**Versión:** 1.0  
**Fecha:** Abril 2026  
**Sistema:** Botica El Pueblo ERP + Clínica
