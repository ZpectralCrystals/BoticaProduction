# Modelo de Base de Datos — Botica El Pueblo

**Base de datos:** `botica_db` (PostgreSQL 15)
**Tablas:** 22 | **Columnas:** 214

---

## bot_usuarios
> Usuarios del sistema con autenticación y flags de permisos.

| Columna | Tipo | Null | Default |
|---------|------|------|---------|
| nid | SERIAL PK | NO | auto |
| cnrodni | CHAR(8) | NO | |
| cnombre | VARCHAR(200) | NO | |
| cclave | VARCHAR(255) | NO | |
| crol | VARCHAR(20) | NO | 'caja' |
| cestado | CHAR(1) | NO | 'A' |
| tcreado | TIMESTAMP | SI | now() |
| tmodifi | TIMESTAMP | SI | now() |
| lsuper | BOOLEAN | SI | false |
| ladmin | BOOLEAN | SI | false |
| ctelefono | VARCHAR(20) | SI | '' |
| cdireccion | VARCHAR(300) | SI | '' |
| cemail | VARCHAR(200) | SI | '' |

- `cestado`: A=Activo, I=Inactivo
- `lsuper`: Superusuario (acceso total, no eliminable)
- `ladmin`: Puede gestionar usuarios

---

## bot_permisos
> Permisos granulares por usuario. Define qué secciones puede ver cada uno.

| Columna | Tipo | Null | Default |
|---------|------|------|---------|
| nid | SERIAL PK | NO | auto |
| nusuario_id | INTEGER FK → bot_usuarios | NO | |
| cseccion | VARCHAR(50) | NO | |

- **UNIQUE**(nusuario_id, cseccion)
- Secciones válidas: `dashboard`, `inventario`, `ventas`, `caja`, `compras`, `proveedores`, `pacientes`, `procedimientos`, `medicos`, `reportes`, `transferencias`, `alquileres`, `deudores`, `inventario-var`, `auditoria`, `usuarios`

---

## bot_productos
> Catálogo de productos farmacéuticos e insumos.

| Columna | Tipo | Null | Default |
|---------|------|------|---------|
| nid | SERIAL PK | NO | auto |
| ccodigo | VARCHAR(20) | NO | |
| cnombre | VARCHAR(200) | NO | |
| cgenerico | VARCHAR(200) | SI | |
| ccategoria | VARCHAR(50) | NO | 'Medicamentos' |
| cfamilia | VARCHAR(100) | SI | |
| cpresenta | VARCHAR(100) | SI | |
| claborat | VARCHAR(100) | SI | |
| nprecompra | NUMERIC | SI | 0 |
| npreventa | NUMERIC | SI | 0 |
| nstock | INTEGER | SI | 0 |
| nstockmin | INTEGER | SI | 0 |
| cubicacion | VARCHAR(50) | SI | |
| cproveedor | VARCHAR(200) | SI | |
| crotacion | VARCHAR(10) | SI | 'Media' |
| tvencimien | DATE | SI | |
| creceta | CHAR(1) | SI | 'N' |
| cestado | CHAR(1) | NO | 'A' |
| tcreado | TIMESTAMP | SI | now() |
| tmodifi | TIMESTAMP | SI | now() |

- `crotacion`: Alta, Media, Baja
- `creceta`: S=Requiere receta, N=Venta libre

---

## bot_ventas
> Registro de ventas con total, método de pago y área.

| Columna | Tipo | Null | Default |
|---------|------|------|---------|
| nid | SERIAL PK | NO | auto |
| ccodigo | VARCHAR(20) | NO | |
| cnrodni_cli | VARCHAR(11) | SI | |
| ccliente | VARCHAR(200) | SI | 'Consumidor final' |
| cmetpago | VARCHAR(20) | NO | 'Efectivo' |
| carea | VARCHAR(50) | SI | 'Botica' |
| ccaja | VARCHAR(50) | SI | 'Caja principal' |
| nsubtotal | NUMERIC | SI | 0 |
| nigv | NUMERIC | SI | 0 |
| ntotal | NUMERIC | SI | 0 |
| cnotas | TEXT | SI | |
| cestado | CHAR(1) | NO | 'A' |
| nusuario_id | INTEGER | SI | |
| tcreado | TIMESTAMP | SI | now() |

- `cmetpago`: Efectivo, Yape, Mixto
- `cestado`: A=Activa, F=Facturada, C=Cancelada

---

## bot_ventas_det
> Detalle de cada venta (productos y/o servicios).

| Columna | Tipo | Null | Default |
|---------|------|------|---------|
| nid | SERIAL PK | NO | auto |
| nventa_id | INTEGER FK → bot_ventas | NO | |
| nproducto_id | INTEGER FK → bot_productos | SI | |
| ncantidad | INTEGER | NO | 1 |
| npreunit | NUMERIC | NO | |
| nsubtotal | NUMERIC | NO | |
| ctipo | VARCHAR(20) | SI | 'Producto' |
| nservicio_id | INTEGER FK → bot_servicios | SI | |
| cdescripcion | VARCHAR(200) | SI | |

- `ctipo`: Producto o Servicio

---

## bot_caja
> Control de apertura y cierre de caja.

| Columna | Tipo | Null | Default |
|---------|------|------|---------|
| nid | SERIAL PK | NO | auto |
| ccaja | VARCHAR(50) | NO | 'Caja principal' |
| napertura | NUMERIC | SI | 0 |
| ncierre | NUMERIC | SI | |
| nusuario_id | INTEGER | SI | |
| cestado | CHAR(1) | NO | 'A' |
| tapertura | TIMESTAMP | SI | now() |
| tcierre | TIMESTAMP | SI | |

- `cestado`: A=Abierta, C=Cerrada

---

## bot_proveedores
> Directorio de proveedores.

| Columna | Tipo | Null | Default |
|---------|------|------|---------|
| nid | SERIAL PK | NO | auto |
| cruc | VARCHAR(11) | SI | |
| cnombre | VARCHAR(200) | NO | |
| ccontacto | VARCHAR(200) | SI | |
| ctelefono | VARCHAR(20) | SI | |
| cemail | VARCHAR(100) | SI | |
| cdireccion | TEXT | SI | |
| cnotas | TEXT | SI | |
| cestado | CHAR(1) | NO | 'A' |
| tcreado | TIMESTAMP | SI | now() |

---

## bot_compras
> Registro de compras a proveedores.

| Columna | Tipo | Null | Default |
|---------|------|------|---------|
| nid | SERIAL PK | NO | auto |
| ccodigo | VARCHAR(20) | NO | |
| nproveedor_id | INTEGER FK → bot_proveedores | SI | |
| cproveedor | VARCHAR(200) | SI | |
| cdocumento | VARCHAR(50) | SI | |
| ntotal | NUMERIC | SI | 0 |
| cnotas | TEXT | SI | |
| cestado | CHAR(1) | NO | 'A' |
| nusuario_id | INTEGER | SI | |
| tcreado | TIMESTAMP | SI | now() |

---

## bot_compras_det
> Detalle de cada compra (productos adquiridos).

| Columna | Tipo | Null | Default |
|---------|------|------|---------|
| nid | SERIAL PK | NO | auto |
| ncompra_id | INTEGER FK → bot_compras | NO | |
| nproducto_id | INTEGER FK → bot_productos | NO | |
| ncantidad | INTEGER | NO | |
| npreunit | NUMERIC | NO | |
| nsubtotal | NUMERIC | NO | |

---

## bot_pacientes
> Padrón de pacientes.

| Columna | Tipo | Null | Default |
|---------|------|------|---------|
| nid | SERIAL PK | NO | auto |
| cnombre | VARCHAR(200) | NO | |
| cnrodni | VARCHAR(8) | SI | |
| ctelefono | VARCHAR(20) | SI | |
| nedad | INTEGER | SI | |
| cnotas | TEXT | SI | |
| cestado | CHAR(1) | NO | 'A' |
| tultvisita | TIMESTAMP | SI | |
| tcreado | TIMESTAMP | SI | now() |

---

## bot_citas
> Agenda de citas y procedimientos médicos.

| Columna | Tipo | Null | Default |
|---------|------|------|---------|
| nid | SERIAL PK | NO | auto |
| npaciente_id | INTEGER FK → bot_pacientes | SI | |
| cpaciente | VARCHAR(200) | NO | |
| cdoctor | VARCHAR(200) | NO | |
| cespeciali | VARCHAR(200) | SI | |
| csala | VARCHAR(50) | SI | |
| tinicio | TIMESTAMP | NO | |
| cestado | VARCHAR(20) | NO | 'Confirmada' |
| tcreado | TIMESTAMP | SI | now() |
| nmedico_id | INTEGER FK → bot_medicos | SI | |

- `cestado`: Confirmada, En espera, Atendida

---

## bot_medicos
> Registro de médicos.

| Columna | Tipo | Null | Default |
|---------|------|------|---------|
| nid | SERIAL PK | NO | auto |
| cnombre | VARCHAR(200) | NO | |
| ccmp | VARCHAR(20) | SI | |
| cespeciali | VARCHAR(100) | SI | |
| ctelefono | VARCHAR(20) | SI | |
| cemail | VARCHAR(100) | SI | |
| cnotas | TEXT | SI | |
| cestado | CHAR(1) | NO | 'A' |
| tcreado | TIMESTAMP | SI | now() |

---

## bot_servicios
> Catálogo de servicios médicos (consultas, ecografías, etc).

| Columna | Tipo | Null | Default |
|---------|------|------|---------|
| nid | SERIAL PK | NO | auto |
| cnombre | VARCHAR(200) | NO | |
| ccategoria | VARCHAR(50) | SI | 'Consulta' |
| nprecio | NUMERIC | SI | 0 |
| cdescripcion | TEXT | SI | |
| cestado | CHAR(1) | NO | 'A' |
| tcreado | TIMESTAMP | SI | now() |

---

## bot_historial
> Historial clínico de pacientes.

| Columna | Tipo | Null | Default |
|---------|------|------|---------|
| nid | SERIAL PK | NO | auto |
| npaciente_id | INTEGER FK → bot_pacientes | NO | |
| nmedico_id | INTEGER FK → bot_medicos | SI | |
| cdoctor | VARCHAR(200) | SI | |
| cfecha | DATE | SI | CURRENT_DATE |
| cdiagnostico | TEXT | SI | |
| ctratamiento | TEXT | SI | |
| cobservacion | TEXT | SI | |
| csignos | TEXT | SI | |
| tcreado | TIMESTAMP | SI | now() |

---

## bot_recetas
> Recetas médicas.

| Columna | Tipo | Null | Default |
|---------|------|------|---------|
| nid | SERIAL PK | NO | auto |
| npaciente_id | INTEGER FK → bot_pacientes | NO | |
| nmedico_id | INTEGER FK → bot_medicos | SI | |
| ccodigo | VARCHAR(20) | SI | |
| tcreado | TIMESTAMP | SI | now() |

---

## bot_recetas_det
> Detalle de medicamentos en cada receta.

| Columna | Tipo | Null | Default |
|---------|------|------|---------|
| nid | SERIAL PK | NO | auto |
| nreceta_id | INTEGER FK → bot_recetas | NO | |
| cmedicamento | VARCHAR(200) | NO | |
| cdosis | VARCHAR(200) | SI | |
| cfrequencia | VARCHAR(200) | SI | |
| cduracion | VARCHAR(100) | SI | |

---

## bot_transferencias
> Movimientos de stock entre tiendas/almacenes/donaciones.

| Columna | Tipo | Null | Default |
|---------|------|------|---------|
| nid | SERIAL PK | NO | auto |
| ccodigo | VARCHAR(20) | NO | |
| ctipo | VARCHAR(30) | NO | |
| corigen | VARCHAR(100) | SI | |
| cdestino | VARCHAR(100) | SI | |
| cmotivo | TEXT | SI | |
| nusuario_id | INTEGER | SI | |
| cestado | CHAR(1) | NO | 'A' |
| tcreado | TIMESTAMP | SI | now() |

---

## bot_transferencias_det
> Detalle de productos transferidos.

| Columna | Tipo | Null | Default |
|---------|------|------|---------|
| nid | SERIAL PK | NO | auto |
| ntransf_id | INTEGER FK → bot_transferencias | NO | |
| nproducto_id | INTEGER FK → bot_productos | NO | |
| ncantidad | INTEGER | NO | |
| cnotas | TEXT | SI | |

---

## bot_inventario_var
> Inventario variado: activos diversos (camillas, equipos, etc).

| Columna | Tipo | Null | Default |
|---------|------|------|---------|
| nid | SERIAL PK | NO | auto |
| cnombre | VARCHAR(200) | NO | |
| ccategoria | VARCHAR(50) | SI | 'General' |
| cdescripcion | TEXT | SI | |
| ncantidad | INTEGER | SI | 1 |
| nvalor | NUMERIC | SI | 0 |
| cubicacion | VARCHAR(100) | SI | |
| cestado | CHAR(1) | NO | 'A' |
| tcreado | TIMESTAMP | SI | now() |

---

## bot_alquileres
> Alquileres de consultorios y espacios.

| Columna | Tipo | Null | Default |
|---------|------|------|---------|
| nid | SERIAL PK | NO | auto |
| cconcepto | VARCHAR(200) | NO | |
| carrendatario | VARCHAR(200) | SI | |
| cdni | VARCHAR(11) | SI | |
| ctelefono | VARCHAR(20) | SI | |
| nperiodo_monto | NUMERIC | SI | 0 |
| cperiodo | VARCHAR(20) | SI | 'Mensual' |
| finicio | DATE | SI | |
| ffin | DATE | SI | |
| cnotas | TEXT | SI | |
| cestado | CHAR(1) | NO | 'A' |
| tcreado | TIMESTAMP | SI | now() |

---

## bot_deudores
> Cuentas por cobrar y control de abonos.

| Columna | Tipo | Null | Default |
|---------|------|------|---------|
| nid | SERIAL PK | NO | auto |
| cnombre | VARCHAR(200) | NO | |
| cdni | VARCHAR(11) | SI | |
| ctelefono | VARCHAR(20) | SI | |
| cconcepto | TEXT | SI | |
| nmonto | NUMERIC | SI | 0 |
| nabonado | NUMERIC | SI | 0 |
| cestado | CHAR(1) | NO | 'P' |
| ffecha | DATE | SI | CURRENT_DATE |
| cnotas | TEXT | SI | |
| tcreado | TIMESTAMP | SI | now() |

- `cestado`: P=Pendiente, A=Abonando, C=Cancelado

---

## bot_auditoria
> Registro de trazabilidad de acciones del sistema.

| Columna | Tipo | Null | Default |
|---------|------|------|---------|
| nid | SERIAL PK | NO | auto |
| nusuario_id | INTEGER | SI | |
| cusuario | VARCHAR(200) | SI | |
| caccion | VARCHAR(50) | NO | |
| ctabla | VARCHAR(50) | SI | |
| nregistro_id | INTEGER | SI | |
| cdetalle | TEXT | SI | |
| cip | VARCHAR(50) | SI | |
| tcreado | TIMESTAMP | SI | now() |

---

## Relaciones principales

```
bot_permisos.nusuario_id       → bot_usuarios.nid
bot_ventas_det.nventa_id       → bot_ventas.nid
bot_ventas_det.nproducto_id    → bot_productos.nid
bot_ventas_det.nservicio_id    → bot_servicios.nid
bot_compras.nproveedor_id      → bot_proveedores.nid
bot_compras_det.ncompra_id     → bot_compras.nid
bot_compras_det.nproducto_id   → bot_productos.nid
bot_citas.npaciente_id         → bot_pacientes.nid
bot_citas.nmedico_id           → bot_medicos.nid
bot_historial.npaciente_id     → bot_pacientes.nid
bot_historial.nmedico_id       → bot_medicos.nid
bot_recetas.npaciente_id       → bot_pacientes.nid
bot_recetas.nmedico_id         → bot_medicos.nid
bot_recetas_det.nreceta_id     → bot_recetas.nid
bot_transferencias_det.ntransf_id    → bot_transferencias.nid
bot_transferencias_det.nproducto_id  → bot_productos.nid
```

---

*Generado el 2026-04-09 — Botica El Pueblo ERP*
