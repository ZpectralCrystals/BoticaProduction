# PRODUCCION PLENA - DESPLIEGUE

Fecha de actualización: 2026-04-12

## 1. Objetivo

Esta guía deja el ERP Botica El Pueblo listo para un despliegue reproducible con:

- backend Fastify detrás de proxy HTTPS
- frontend Vite compilado
- PostgreSQL con backups automáticos
- jobs operativos de vencimientos y reconciliación
- validaciones post-deploy y rollback básico

## 2. Prerrequisitos

- Node.js 20 LTS o superior
- npm 10 o superior
- PostgreSQL 15 o superior
- `pg_dump`, `psql`, `gzip`, `curl`
- nginx 1.24 o superior
- usuario de sistema para correr la app, por ejemplo `botica`
- directorios de logs y backups creados:
  - `/var/log/botica`
  - `/opt/botica/backups/database`

## 3. Variables de entorno

### Backend: `backend-fastify/.env`

```bash
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
LOG_LEVEL=info
TRUST_PROXY=true

BOTICA_DB_HOST=127.0.0.1
BOTICA_DB_PORT=5432
BOTICA_DB_NAME=botica_db
BOTICA_DB_USER=botica_app
BOTICA_DB_PASS=<password-seguro>

JWT_SECRET=<minimo-32-caracteres-aleatorios>
CORS_ORIGIN=https://erp.boticaelpueblo.pe

SENTRY_DSN=
SENTRY_ENVIRONMENT=production
```

Notas:

- `JWT_SECRET` es obligatoria en producción. El backend no arranca sin ella.
- `CORS_ORIGIN` es obligatoria en producción. El backend no arranca sin ella.
- `TRUST_PROXY=true` es obligatorio si nginx termina TLS delante del backend.

### Frontend

```bash
VITE_CLERK_PUBLISHABLE_KEY=<si-aplica>
VITE_SENTRY_DSN=
```

## 4. Instalación base

### Backend

```bash
cd /opt/botica/backend-fastify
npm ci
npm run build
```

### Frontend

```bash
cd /opt/botica/frontend
npm ci
npm run build
```

## 5. Base de datos y migraciones

### Primera instalación

```bash
createdb -U postgres botica_db
psql -U postgres -d botica_db -f ops/baseline/schema_botica_actual.sql
for migration in ops/migrations/*.sql; do
  psql -U postgres -d botica_db -f "$migration"
done
```

### Actualización de una instalación existente

Antes de aplicar cambios:

```bash
cd /opt/botica
./scripts/backup-db.sh
```

Luego aplicar únicamente las migraciones no ejecutadas en ese entorno.

## 6. Backup previo obligatorio

Antes de cada deploy:

```bash
cd /opt/botica
./scripts/backup-db.sh
```

Comportamiento actual del script:

- carga variables desde `backend-fastify/.env` si existe
- genera `botica_YYYYMMDD_HHMMSS.sql.gz`
- verifica integridad del gzip
- rota backups antiguos con `RETENTION_DAYS`, por defecto 30 días

## 7. Arranque del backend

### Opción recomendada: `systemd`

Archivo: `/etc/systemd/system/botica-api.service`

```ini
[Unit]
Description=Botica El Pueblo API
After=network.target postgresql.service

[Service]
Type=simple
User=botica
WorkingDirectory=/opt/botica/backend-fastify
EnvironmentFile=/opt/botica/backend-fastify/.env
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
RestartSec=5
StandardOutput=append:/var/log/botica/backend.log
StandardError=append:/var/log/botica/backend-error.log

[Install]
WantedBy=multi-user.target
```

Activación:

```bash
sudo systemctl daemon-reload
sudo systemctl enable botica-api
sudo systemctl restart botica-api
sudo systemctl status botica-api
```

## 8. Publicación del frontend

Servir el contenido compilado de `frontend/dist` desde nginx:

```bash
cp -R /opt/botica/frontend/dist/* /var/www/botica/
```

## 9. Proxy HTTPS con nginx

```nginx
server {
    listen 443 ssl http2;
    server_name erp.boticaelpueblo.pe;

    ssl_certificate     /etc/letsencrypt/live/erp.boticaelpueblo.pe/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/erp.boticaelpueblo.pe/privkey.pem;

    root /var/www/botica;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://127.0.0.1:3000;
    }
}

server {
    listen 80;
    server_name erp.boticaelpueblo.pe;
    return 301 https://$host$request_uri;
}
```

## 10. Jobs operativos

### A. Backup

```cron
0 2 * * * cd /opt/botica && ./scripts/backup-db.sh >> /var/log/botica/backup.log 2>&1
```

Retención mínima recomendada:

- 30 días en disco local
- 7 backups adicionales fuera del servidor si la operación es crítica

### B. Vencimientos

```cron
0 6 * * * cd /opt/botica && ./scripts/cron-vencimientos.sh >> /var/log/botica/vencimientos.log 2>&1
```

Frecuencia recomendada:

- diaria a las 06:00
- `DRY_RUN=false` en producción

Autenticación recomendada para jobs:

```bash
BOTICA_JOB_DNI=12345678
BOTICA_JOB_CLAVE=<clave-del-usuario-tecnico>
```

No se recomienda usar un JWT fijo porque expira.

### C. Reconciliación

Dry-run diario:

```cron
0 7 * * * cd /opt/botica && DRY_RUN=true ./scripts/cron-reconciliacion.sh >> /var/log/botica/reconciliacion.log 2>&1
```

Apply semanal:

```cron
0 3 * * 0 cd /opt/botica && DRY_RUN=false ./scripts/cron-reconciliacion.sh >> /var/log/botica/reconciliacion.log 2>&1
```

Cuándo usar cada modo:

- `DRY_RUN=true`: monitoreo diario, detección temprana, no modifica datos
- `DRY_RUN=false`: solo con ventana de mantenimiento o supervisión admin

## 11. Healthchecks y monitoreo

Endpoints disponibles:

- `GET /health/live`
- `GET /health/ready`
- `GET /health`

Comportamiento:

- `/health/live`: responde 200 si el proceso está vivo
- `/health/ready`: responde 200 si backend y DB están operativos, 503 si la DB no responde
- `/health`: alias de readiness

Alertas recomendadas:

- backend caído: `/health/live` != 200 por 2 chequeos consecutivos
- DB caída: `/health/ready` = 503
- inconsistencia de stock: `/api/v1/consistencia/resumen` con `estadoGeneral=CRITICA`
- fallos en reconciliación: salida no 200 en `cron-reconciliacion.sh`
- lotes vencidos críticos: `/api/v1/consistencia/alertas` con `resumen.lotesPorVencerCriticos > 0`

### Preparación para Sentry o equivalente

Estado actual:

- backend y frontend ya dejan variables de entorno preparadas
- no se amarró una dependencia específica en esta iteración

Recomendación:

- backend: Sentry, Datadog APM o New Relic
- frontend: Sentry Browser SDK o LogRocket

Evento mínimo a capturar:

- errores no controlados 5xx del backend
- errores de render de frontend
- fallos de login
- fallos de reconciliación y jobs nocturnos

## 12. Validaciones post-deploy

### Infraestructura

```bash
curl -sS https://erp.boticaelpueblo.pe/health/live
curl -sS https://erp.boticaelpueblo.pe/health/ready
sudo systemctl status botica-api
tail -n 100 /var/log/botica/backend.log
```

### Aplicación

```bash
cd /opt/botica/backend-fastify && npm test
cd /opt/botica/frontend && npm test
```

Smoke funcional pre-go-live:

1. login con usuario real
2. abrir dashboard y revisar alertas
3. registrar una compra con lote
4. confirmar inventario por almacén
5. vender desde POS con almacén vendible
6. verificar FEFO y kardex
7. anular venta
8. trasladar stock entre almacenes
9. registrar devolución cliente y proveedor
10. ejecutar `consistencia/reconciliar` en dry-run

## 13. Rollback básico

### Código

```bash
cd /opt/botica
git checkout <commit-estable>
cd backend-fastify && npm ci && npm run build
cd ../frontend && npm ci && npm run build
sudo systemctl restart botica-api
sudo systemctl reload nginx
```

### Base de datos

```bash
gunzip -c backups/database/botica_YYYYMMDD_HHMMSS.sql.gz | psql -U postgres -d botica_db
```

## 14. Lista corta antes de abrir a usuarios

- `.env` cargado y validado
- HTTPS activo
- backup del día generado
- jobs instalados en cron
- login probado
- smoke funcional ejecutado en el entorno real
- responsables operativos con acceso a logs y backups
