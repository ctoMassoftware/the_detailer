# ✅ CHECKLIST COMPLETO DE VALIDACIÓN

**Fecha:** 2026-08-28  
**Status:** Código corregido, pendiente validación en Railway  

---

## 🔴 PROBLEMAS IDENTIFICADOS Y CORREGIDOS

### Problema #1: Frontend no extrae id_boleta
**Status:** ✅ CORREGIDO  
**Línea:** `consultar-orden.ts:423-424`  
**Cambio:** Agregué extracción de `id_boleta` y `id_rifa` en `cargarOrdenes()`

### Problema #2: Backend no recibe id_boleta
**Status:** ✅ CORREGIDO  
**Línea:** `orden.controller.js:308`  
**Cambio:** Agregué `id_boleta` a desestructuración del body

### Problema #3: Backend no actualiza id_boleta
**Status:** ✅ CORREGIDO  
**Línea:** `orden.controller.js:388-393`  
**Cambio:** Agregué bloque condicional para UPDATE id_boleta

### Problema #4: Backend SELECT no incluye id_boleta
**Status:** ✅ CORREGIDO  
**Línea:** `orden.controller.js:320`  
**Cambio:** Agregué `id_rifa, id_boleta` al SELECT

### Problema #5: Órdenes históricas con id_boleta = NULL
**Status:** ⏳ PENDIENTE VALIDACIÓN  
**Solución:** 
- Auto-asignación en `/api/recibos/por-placa/:placa` (líneas 65-109)
- O ejecutar `FIX_LEGACY_ORDERS.sql` manualmente

---

## 🎯 PUNTOS DE VALIDACIÓN EN RAILWAY

### Después del Rebuild:

#### 1. Validar orden 359 (histórica)

```bash
# Test 1: Endpoint de recibos
curl https://thedetailer.up.railway.app/api/recibos/por-placa/JES32E | jq '.ordenes[] | select(.id_orden == 359)'

# Debe retornar:
# {
#   "id_orden": 359,
#   "numero_rifa": "008",  ← Número CORRECTO, NO "003"
#   "id_rifa": 1,
#   ...
# }
```

#### 2. Validar nueva orden (post-fix)

```bash
# Crear orden con boleta
# 1. POST /crear-orden (Sin rifa aún)
# 2. PUT /ordenes/{id}/asignar-rifa (Asignar rifa)
# 3. POST /rifas/registrar-boleta (Registrar boleta)
# 4. POST /rifas/asignar-boleta (Asignar boleta a orden)
# 5. PUT /ordenes/{id} (Actualizar estado)

# Verificar en BD:
SELECT id_orden, id_boleta, id_rifa FROM orden WHERE id_orden = [nueva];
# id_boleta debe ser NOT NULL
```

#### 3. Validar SMS con rifa

```bash
# La orden debe enviar SMS #2 con número de boleta CORRECTO
# SMS #2 debe decir: "Tu orden está lista con boleta #008"
# NO: "Tu orden está lista con boleta #003"
```

---

## 🔄 FLUJO COMPLETO POST-FIX

### Frontend (Angular)

```typescript
// 1. cargarOrdenes() - CORREGIDO ✅
return {
  id_orden_db: o.id_orden,
  id_boleta: o.id_boleta || null,  // ← AGREGADO
  id_rifa: o.id_rifa || null,      // ← AGREGADO
  // ... otros campos
};

// 2. ejecutarUpdateEstado() - CORREGIDO ✅
const payload = {
  id_boleta: orden.id_boleta,  // ← AGREGADO - Preservar valor
  id_rifa: orden.id_rifa,      // ← AGREGADO
  // ... otros campos
};
```

### Backend (Node.js)

```javascript
// 1. getOrdenes() - SIN CAMBIOS (retorna SELECT o.*)
// Ya contiene id_boleta e id_rifa

// 2. updateOrden() - CORREGIDO ✅
const { id_boleta, id_rifa, ... } = body;  // ← AGREGADO
const SELECT ... id_rifa, id_boleta;      // ← AGREGADO
if (id_boleta !== undefined) {              // ← AGREGADO
  updateQuery += `, id_boleta = $${paramIndex}`;
}

// 3. enviarNotificacionPorCambioEstado() - SIN CAMBIOS
// Ya recibe id_boleta en ordenDatos
// Pasa a obtenerNumeroBoleta() que usa id_boleta correctamente
```

---

## 📊 DATOS ESPERADOS POR ENDPOINT

### GET /api/recibos/por-placa/JES32E

```json
{
  "success": true,
  "placa": "JES32E",
  "ordenes": [
    {
      "id_orden": 359,
      "numero_rifa": "008",      // ← Correcto, no "003"
      "id_rifa": 1,
      "rifa_premio": "Moto Yamaha 125cc",
      "encargado_rifa": "Jorge Manuel",
      "responsable": "Jorge Manuel"
    }
  ]
}
```

### GET /api/debug/orden/359

```json
{
  "validacion": {
    "Tiene id_boleta": "✅",
    "Boleta registrada en tabla rifa": "✅"
  },
  "resumen": {
    "boleta_asignada": "#008"
  }
}
```

### SMS que debe enviar

```
✅ Correcto:
"Tu orden #359 está lista con boleta #008 para la rifa. Premio: Moto Yamaha 125cc. Juega el 09/01/2026"

❌ Incorrecto:
"Tu orden #359 está lista con boleta #003 para la rifa."
```

---

## 🚨 INDICADORES DE FALLO

Si CUALQUIERA de estos es cierto, el fix NO funcionó:

- [ ] GET /recibos?placa=JES32E sigue mostrando #003 para orden 359
- [ ] Endpoint debug retorna `id_boleta = null` para orden 359
- [ ] SMS dice "boleta #003" en lugar del número correcto
- [ ] Recibo PDF muestra número incorrecto
- [ ] Nueva orden (post-rebuild) también muestra #003

**Si alguno falla:** Ejecutar `FIX_LEGACY_ORDERS.sql` en Railway

---

## 📋 CAMBIOS REALIZADOS EN ESTE COMMIT

### Archivos Modificados: 2
1. `frontend-/src/app/components/consultar-orden/consultar-orden.ts`
   - Interface Orden: +2 campos
   - cargarOrdenes(): +2 líneas
   
2. `backend-/src/controllers/orden.controller.js`
   - updateOrden() desestructuración: +1 campo
   - updateOrden() SELECT: +1 línea
   - updateOrden() UPDATE dinámica: +4 líneas

### Archivos Nuevos: 4
1. `debug.routes.js` - Endpoint para validación
2. `FIX_LEGACY_ORDERS.sql` - Script de corrección
3. `CRITICAL_BUGS_FIXED.md` - Documentación de bugs
4. `ORDEN_359_ANALYSIS.md` - Análisis de orden histórica

---

## 🎯 PRÓXIMOS PASOS

1. **Esperar rebuild de Railway** (normalmente 2-5 minutos)
2. **Ejecutar validación:**
   ```bash
   curl https://thedetailer.up.railway.app/api/debug/orden/359
   ```
3. **Si falla:** Ejecutar `FIX_LEGACY_ORDERS.sql` en Railway PostgreSQL
4. **Validar SMS:** Crear orden nueva, completarla, verificar SMS recibido

---

## ✨ RESULTADO ESPERADO

**Orden 359 (histórica):**
- Antes: Mostraba #003 (incorrecta)
- Después: Mostrará #008 (correcta)

**Nuevas órdenes:**
- Desde hoy: Preservarán id_boleta correctamente
- SMS tendrá número de boleta correcto

