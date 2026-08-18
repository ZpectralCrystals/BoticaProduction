# Módulo de Ajustes de Inventario

## 1. Descripción del módulo
El módulo de ajustes de inventario permite modificar el stock de productos en el sistema ERP de manera controlada y auditable. Los ajustes pueden ser necesarios por diversas razones, como conteos físicos, mermas, robos, vencimientos, roturas o correcciones operativas.

## 2. Problema que resuelve
El módulo de ajustes reemplaza el flujo incorrecto de "Reponer", que permitía modificar el stock sin trazabilidad ni auditoría, rompiendo la integridad del sistema.

## 3. Endpoint implementado
**POST /api/v1/inventario/ajustes**

### Payload:
```json
{
  "productoId": 12,
  "almacenId": 3,
  "loteId": 44,
  "cantidad": -5,
  "motivo": "MERMA",
  "detalle": "Blister roto detectado en conteo"
}
```

## 4. Validaciones backend
- **Rol:** Solo administradores y supervisores pueden realizar ajustes.
- **Producto, Lote, Almacén:** Deben existir y estar correctamente relacionados.
- **Stock:** No permite stock negativo en lotes.
- **Motivo:** Debe ser uno de los motivos predefinidos.

## 5. Flujo interno (transacción)
1. **SELECT FOR UPDATE**: Bloquea el lote para evitar condiciones de carrera.
2. **Cálculo stock**: Calcula el nuevo stock del lote.
3. **Update lote**: Actualiza la cantidad del lote.
4. **Update producto**: Sincroniza el stock total del producto.
5. **Kardex**: Registra el ajuste en el kardex.
6. **Movimiento**: Registra el movimiento de almacén.
7. **Auditoría**: Registra la acción en el log de auditoría.

## 6. Impacto en sistema
- **bot_lotes**: Actualiza la cantidad del lote.
- **bot_productos**: Sincroniza el stock total del producto.
- **bot_kardex**: Registra el ajuste con detalles completos.
- **bot_movimientos_almacen**: Registra el movimiento asociado al ajuste.

## 7. Frontend
- **Pantalla:** `AjustesPage`
- **Campos:** Producto, Almacén, Lote, Cantidad, Motivo, Detalle.
- **Validaciones:** Todos los campos son obligatorios excepto detalle.
- **UX:** Interfaz clara con selección de productos, almacenes y lotes.

## 8. Roles permitidos
Solo los roles de administrador y supervisor pueden realizar ajustes de inventario.

## 9. Ejemplos reales

### Caso 1: MERMA (-5)
- Producto: Paracetamol
- Almacén: Principal
- Lote: Lote 123
- Cantidad: -5
- Motivo: MERMA
- Detalle: Blister roto detectado en conteo

### Caso 2: CORRECCIÓN (+10)
- Producto: Ibuprofeno
- Almacén: Secundario
- Lote: Lote 456
- Cantidad: +10
- Motivo: CORRECCION_OPERATIVA
- Detalle: Ajuste por conteo físico

## 10. Validación final
- **FEFO:** No se ve afectado, ya que los ajustes se realizan por lote.
- **Kardex consistente:** Cada ajuste se registra con detalle completo.
- **Stock consistente:** Sincronización completa entre lotes y productos.

## 11. Conclusión
Este módulo es el flujo oficial para correcciones de stock, reemplazando cualquier modificación manual. Garantiza la integridad del sistema mediante trazabilidad completa y auditoría de cada ajuste.
