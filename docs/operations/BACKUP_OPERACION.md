# BACKUP OPERATIVO — Botica El Pueblo ERP
**Documento operativo para el administrador del sistema**

---

## Resumen

| Parámetro | Valor |
|---|---|
| Base de datos | PostgreSQL — `botica_db` |
| Script de backup | `scripts/backup-db.sh` |
| Directorio destino | `backups/database/` (configurable) |
| Formato | SQL plano comprimido (`.sql.gz`) |
| Retención recomendada | 30 días |
| Frecuencia recomendada | Diaria a las 2:00 AM |

---

## Configuración de variables de entorno

El script lee las mismas variables que el backend. Configurar en el entorno del sistema o en `/etc/environment`:

```bash
BOTICA_DB_HOST=localhost
BOTICA_DB_PORT=5432
BOTICA_DB_NAME=botica_db
BOTICA_DB_USER=gg
BOTICA_DB_PASS=tu-contraseña-real
BOTICA_BACKUP_DIR=backups/database   # Opcional, default local del proyecto
```

---

## Uso del script

### Dar permisos de ejecución (primera vez)

```bash
chmod +x scripts/backup-db.sh
```

### Backup simple

```bash
./scripts/backup-db.sh
```

Genera: `backups/database/botica_20260411_020000.sql.gz`

### Backup con verificación de integridad

```bash
./scripts/backup-db.sh
```

### Backup con rotación automática (elimina backups > 30 días)

```bash
RETENTION_DAYS=30 ./scripts/backup-db.sh
```

---

## Configuración de CRON (Linux/Mac)

### Abrir el crontab del usuario del servidor

```bash
crontab -e
```

### Agregar línea para ejecutar diariamente a las 2:00 AM

```cron
0 2 * * * cd /ruta/completa/al/proyecto && RETENTION_DAYS=30 ./scripts/backup-db.sh >> backups/backup.log 2>&1
```

> **Importante:** Usar la ruta absoluta al script. Verificar que el usuario que ejecuta el cron tenga acceso a `pg_dump` y a las variables de entorno.

### Verificar que el cron está activo

```bash
crontab -l
```

### Ver logs de backup

```bash
tail -50 backups/backup.log
```

---

## Listar backups disponibles

```bash
ls -lh backups/database/
```

Salida esperada:
```
-rw-r--r-- 1 user user 2.3M Apr 11 02:00 botica_20260411_020000.sql.gz
-rw-r--r-- 1 user user 2.2M Apr 10 02:00 botica_20260410_020000.sql.gz
```

---

## Restauración de backup

### Paso 1: Descomprimir el backup

```bash
gunzip -k backups/database/botica_20260411_020000.sql.gz
# Genera: botica_20260411_020000.sql
```

### Paso 2: Crear base de datos limpia (si es recuperación completa)

```bash
psql -U postgres -c "CREATE DATABASE botica_db_restore;"
```

### Paso 3: Restaurar

```bash
psql \
  -h localhost \
  -U gg \
  -d botica_db_restore \
  -f backups/database/botica_20260411_020000.sql
```

### Paso 4: Verificar tablas principales

```sql
-- Conectarse a la BD restaurada y verificar:
\c botica_db_restore
SELECT COUNT(*) FROM bot_productos;
SELECT COUNT(*) FROM bot_ventas;
SELECT COUNT(*) FROM bot_usuarios;
```

### Paso 5 (si todo está bien): Renombrar bases de datos

```bash
# Conectar con postgres y sin tráfico en la BD activa:
psql -U gg -c "ALTER DATABASE botica_db RENAME TO botica_db_old;"
psql -U gg -c "ALTER DATABASE botica_db_restore RENAME TO botica_db;"
```

---

## Backup manual urgente (antes de cambios en producción)

Siempre ejecutar antes de aplicar migraciones SQL o actualizaciones del servidor:

```bash
BOTICA_BACKUP_DIR=/tmp ./scripts/backup-db.sh
```

---

## Checklist diario para el administrador

- [ ] Verificar que el cron corrió (revisar `backups/backup.log`)
- [ ] Confirmar que el archivo del día existe en `backups/database/`
- [ ] Verificar espacio disponible en disco: `df -h .`
- [ ] Una vez por semana: probar restauración en entorno de prueba

---

## Espacio en disco estimado

Con la base de datos actual (~65 KB sin comprimir):
- Backup comprimido: ~8-15 KB por día
- 30 días de retención: ~450 KB
- 90 días de retención: ~1.4 MB

Cuando la BD crezca (miles de ventas), estimar ~5-20 MB por backup comprimido.

---

## Backup existente

Desde ahora el backup operativo oficial es `scripts/backup-db.sh`.
Los archivos generados viven en `backups/database/` y no se versionan en git.
