# PRODUCCION PLENA - CHECKLIST FINAL

Fecha: 2026-04-12

## 1. Bloqueantes

Bloqueantes estrictamente de código/repositorio:

- ninguno crítico al cierre de esta iteración

Bloqueantes operativos antes de abrir a usuarios:

- desplegar en servidor real
- cargar secretos reales en `.env`
- instalar nginx/HTTPS
- instalar cron de backup, vencimientos y reconciliación
- ejecutar smoke funcional final en entorno real

## 2. Pendientes medios

- activar Sentry/APM real con DSN del entorno
- validar restauración real de un backup en ambiente de prueba
- definir usuario técnico exclusivo para jobs nocturnos

## 3. Pendientes bajos

- optimizar chunk principal del frontend
- limpiar warnings de `act(...)` en tests frontend
- formalizar dashboard externo de monitoreo operativo

## 4. Acciones obligatorias antes de abrir a usuarios

1. Generar y cargar `JWT_SECRET` segura.
2. Configurar `CORS_ORIGIN` con el dominio real.
3. Desplegar backend compilado y verificar `systemd` o PM2.
4. Desplegar frontend compilado y validar nginx con HTTPS.
5. Ejecutar `./scripts/backup-db.sh` y confirmar archivo generado.
6. Instalar cron de:
   - backup diario
   - vencimientos diarios
   - reconciliación dry-run diaria
   - reconciliación apply semanal
7. Validar `/health/live` y `/health/ready`.
8. Probar login con usuario real.
9. Ejecutar smoke de negocio completo en entorno real.
10. Confirmar acceso del equipo a logs y backups.

## 5. Acciones recomendadas semana 1

- monitorear diariamente `backend.log`, `backup.log`, `vencimientos.log` y `reconciliacion.log`
- revisar dashboard de consistencia cada mañana
- revisar dashboard de alertas al inicio y cierre del día
- probar restauración de un backup al menos una vez
- activar alertas externas de health y reconciliación

## 6. Acciones recomendadas mes 1

- activar Sentry o APM equivalente
- optimizar code splitting del frontend
- automatizar smoke test contra staging
- documentar simulacro de rollback con tiempos reales
- revisar permisos de usuarios críticos con auditoría de accesos

## 7. Resultado ejecutivo

- producción controlada: lista
- producción plena: lista en código y documentación, pendiente de ejecución operativa real
- recomendación: abrir a usuarios solo después del smoke final y de verificar cron + HTTPS en el servidor destino
