# 🚀 MIGRATION DEPLOYMENT GUIDE - The Detailer

**Fecha:** 2026-09-11  
**Versión:** 1.0  
**Ambiente:** Railway (Producción) + Netlify (Frontend)

---

## 📋 RESUMEN EJECUTIVO

Las **2 migraciones SQL nuevas** se ejecutarán automáticamente al reiniciar el backend en Railway. No requieren intervención manual ni comandos adicionales.

### Flujo Automático
```
1. Push a main ✅ (completado)
2. Railway detecta cambios
3. Redeploy automático
4. Backend inicia → initDB() se ejecuta → migraciones corren
5. Aplicación lista ✅
```

---

## 📁 MIGRACIONES NUEVAS

### 1. `add_rifa_columns_to_orden_venta.sql`
**Estado:** ✅ Modificada (se agregó columna `id_rifa`)  
**Ubicación:** `backend-/src/database/migrations/`  
**Acción:** Agrega columna `id_rifa` a tabla `venta_mostrador`

```sql
ALTER TABLE venta_mostrador 
ADD COLUMN IF NOT EXISTS id_rifa INTEGER 
REFERENCES evento_rifa(id_evento) ON DELETE SET NULL;
```

### 2. `add_con_rifa_desde_inicio_to_orden.sql` (NUEVA)
**Estado:** ✅ Nueva migración  
**Ubicación:** `backend-/src/database/migrations/`  
**Acción:** Agrega flag `con_rifa_desde_inicio` a tabla `orden`

```sql
ALTER TABLE orden 
ADD COLUMN con_rifa_desde_inicio BOOLEAN DEFAULT FALSE;

-- Actualizar órdenes existentes con rifa
UPDATE orden
SET con_rifa_desde_inicio = TRUE
WHERE id_rifa IS NOT NULL AND con_rifa_desde_inicio = FALSE;
```

---

## 🔄 PROCESO DE EJECUCIÓN EN RAILWAY

### Paso 1: Railway Detecta Cambios Automáticamente
- GitHub webhook se dispara
- Railway ve nuevo commit en main
- Automáticamente inicia rebuild

### Paso 2: Build & Deploy
```
1. Clonar repo con cambios
2. npm install (backend dependencies)
3. Iniciar backend con: npm start
4. index.js → initDB() → runMigrations()
```

### Paso 3: Migraciones Se Ejecutan
```
Durante el startup del backend:

📍 Conectando a BD...
✅ Base de datos conectada correctamente

🔄 Inicializando base de datos...
  • Leyendo migraciones de src/database/migrations/
  • Ejecutando: add_message_audit_table.sql
  • Ejecutando: add_rifa_columns_to_orden_venta.sql
  • Ejecutando: add_con_rifa_desde_inicio_to_orden.sql
✅ Base de datos inicializada

✅ ¡SERVIDOR INICIADO EXITOSAMENTE!
```

### Paso 4: Aplicación Lista
- Frontend en Netlify se conecta automáticamente
- Nueva funcionalidad disponible

---

## ✅ VERIFICACIÓN - DESPUÉS DE DEPLOY

### 1. Verificar Backend en Railway
```bash
# En Dashboard de Railway:
1. Ir a tu proyecto The Detailer
2. Ir a pestaña "Deployments"
3. Ver último deploy (debe tener ✅ SUCCESS)
4. Expandir logs del build
5. Buscar líneas:
   ✅ Base de datos inicializada
   ✅ ¡SERVIDOR INICIADO EXITOSAMENTE!
```

### 2. Verificar Migraciones en BD
```sql
-- Conectar a BD PostgreSQL de Railway

-- Verificar que tabla venta_mostrador tiene columna id_rifa
\d venta_mostrador
-- Debe mostrar: id_rifa | integer | references evento_rifa(id_evento)

-- Verificar que tabla orden tiene columna con_rifa_desde_inicio
\d orden
-- Debe mostrar: con_rifa_desde_inicio | boolean

-- Contar órdenes con rifa asignada desde inicio
SELECT COUNT(*) as ordenes_con_rifa_desde_inicio
FROM orden
WHERE con_rifa_desde_inicio = TRUE;
```

### 3. Verificar Frontend en Netlify
```
1. Ir a https://thedetailer-produccion.netlify.app
2. Debe cargar sin errores
3. Revisar consola del navegador (F12)
4. No debe haber errores de conexión con backend
```

---

## 🧪 TESTING MANUAL (Después de Deploy)

### Test 1: SMS #3 Se Dispara
```
1. Login en frontend
2. Crear orden sin rifa (orden #421)
3. Ver que SMS #1 y #2 llegan
4. Cambiar estado a FINALIZADA_ENTREGADA
5. ✅ VERIFICAR: SMS #3 llega en <60 segundos
```

### Test 2: Órdenes Sin Rifa No Muestran Boleta
```
1. Crear orden #422 SIN rifa
2. Cambiar a estado LISTA
3. Ver SMS #2
4. ✅ VERIFICAR: SMS NO contiene número de boleta
```

### Test 3: Órdenes CON Rifa SÍ Muestran Boleta
```
1. Crear orden #423 CON rifa
2. Cambiar a estado LISTA
3. Ver SMS #2
4. ✅ VERIFICAR: SMS contiene número de boleta
```

### Test 4: Números de Boleta Sin Duplicados
```
1. Crear 5 ventas mostrador con rifa
2. Verificar números en BD:
   SELECT numero_boleta FROM rifa ORDER BY numero_boleta;
3. ✅ VERIFICAR: Números consecutivos, sin duplicados
```

### Test 5: Seguridad - Cambiar Rifa como OPERARIO
```
1. Login como OPERARIO
2. PUT /api/ordenes/421 con {"id_rifa": 5}
3. ✅ VERIFICAR: Recibe 403 Forbidden
```

### Test 6: Seguridad - Cambiar Rifa como ADMIN
```
1. Login como ADMIN
2. PUT /api/ordenes/421 con {"id_rifa": 5}
3. ✅ VERIFICAR: id_rifa cambió exitosamente (200 OK)
```

---

## 📊 TIMELINE ESPERADO

| Evento | Tiempo | Status |
|--------|--------|--------|
| Push a main | 2026-09-11 08:04 | ✅ COMPLETADO |
| Railway detecta cambios | +1 min | ⏳ Automático |
| Build comienza | +2 min | ⏳ Automático |
| Migraciones ejecutan | +5 min | ⏳ Automático |
| Backend ready | +6 min | ⏳ Automático |
| Frontend se reconecta | +7 min | ⏳ Automático |
| **LISTO PARA USO** | **+8 min** | **✅ ESTIMADO** |

---

## 🚨 SI ALGO FALLA

### Síntoma: "Migration Error" en logs
```
Causa probable: Syntax error en SQL
Acción:
1. Revisar logs de Railway
2. Copiar el error SQL
3. Ejecutar comando:
   psql <connection-string> < migrations/archivo.sql
4. Ver qué línea falla
5. Corregir y volver a deployar
```

### Síntoma: "Column already exists"
```
Causa probable: Migración ya se ejecutó antes
Acción: ✅ NORMAL - Las migraciones tienen IF NOT EXISTS
No requiere acción, simplemente ignora ese mensaje
```

### Síntoma: Frontend no conecta al backend
```
Causa probable: Backend aún no está listo
Acción:
1. Esperar 30 segundos
2. Refresh en navegador (Ctrl+F5)
3. Si sigue fallando, revisar logs de Railway
4. Buscar "✅ SERVIDOR INICIADO EXITOSAMENTE"
```

---

## 📞 ACCIONES SI NECESITAS ROLLBACK

### Opción 1: Rollback del Código
```bash
# En tu máquina local
git revert c4398dd
git push origin main
# Railway automáticamente redeploy con versión anterior
```

### Opción 2: Revertir Migraciones (Manual)
```sql
-- Conectar a BD de Railway
-- Remover columna id_rifa de venta_mostrador
ALTER TABLE venta_mostrador DROP COLUMN IF EXISTS id_rifa;

-- Remover columna con_rifa_desde_inicio de orden
ALTER TABLE orden DROP COLUMN IF EXISTS con_rifa_desde_inicio;

-- Código automáticamente reintentará crear las columnas en siguiente deploy
```

---

## ✅ CHECKLIST DE CONFIRMACIÓN

### Pre-Deploy
- [x] Commit: c4398dd pusheado a main
- [x] 2 migraciones SQL listas en backend-/src/database/migrations/
- [x] Código backend modificado correctamente
- [x] initDB() configurado para ejecutar migraciones automáticamente

### Post-Deploy (A hacer después de que Railway redeploy)
- [ ] Railway deployment completado exitosamente
- [ ] Logs de Railway muestran "✅ Base de datos inicializada"
- [ ] Verificar tablas en BD: venta_mostrador.id_rifa existe
- [ ] Verificar tablas en BD: orden.con_rifa_desde_inicio existe
- [ ] Frontend en Netlify conecta sin errores
- [ ] Test SMS #3: orden FINALIZADA_ENTREGADA recibe SMS
- [ ] Test seguridad: OPERARIO recibe 403 al cambiar rifa
- [ ] Monitorear logs por 30 minutos (buscar errores)

---

## 📱 FRONTEND DEPLOYMENT (Netlify)

**Status:** ✅ Automático  
**Acción:** No requiere cambios en frontend

Frontend en Netlify automáticamente se reconectará al backend cuando este se reinicie. No hay cambios de código frontend, solo backend.

---

## 🎯 RESUMEN

✅ **Las migraciones se ejecutarán automáticamente al reiniciar Railway**

No necesitas:
- ❌ Conectarte vía SSH a Railway
- ❌ Ejecutar comandos psql manualmente
- ❌ Cambiar variables de entorno

Solo necesitas:
- ✅ Esperar a que Railway redeploy automáticamente (~8 minutos)
- ✅ Verificar que logs muestren "✅ Base de datos inicializada"
- ✅ Ejecutar los 6 tests manual para confirmar que todo funciona

**¿Listo para proceder?** Solo di "listo" y Railway hará el deploy automático.

