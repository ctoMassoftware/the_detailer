# 📤 Flujo de Endpoints: Mensajes y Recibos

**Análisis de dónde va mal el número de boleta (#003 incorrecto)**

---

## 🔴 EL PROBLEMA REAL

El número #003 aparece en:
1. **Recibos** (PDF/HTML) → GET `/api/recibos/por-placa/{placa}`
2. **SMS Notificaciones** → PUT `/api/ordenes/{id}` → SMS #2

**Causa raíz:** Ambos endpoints usan `id_boleta` para obtener el número real de boleta.

---

## 📊 DIAGRAMA DE FLUJO

```
USUARIO COMPLETA ORDEN
        ↓
[Frontend PUT /ordenes/{id}]
        ↓
{id_boleta: 357, estado: "Lista"}  ← ✅ AHORA INCLUYE id_boleta (FIX)
        ↓
[Backend orden.controller.js:updateOrden()]
        ├─ SELECT id_boleta FROM orden WHERE id_orden = ?
        │  ↓
        │  id_boleta = 357  (del SELECT - AHORA FUNCIONA)
        │
        ├─ UPDATE orden SET id_boleta = 357 WHERE id_orden = ?  ← ✅ AHORA PRESERVA
        │  ↓
        │  BD: orden.id_boleta = 357 ✅
        │
        └─ enviarNotificacionPorCambioEstado()
           ↓
           [orderStatusNotification.service.js:notificarCambioDeEstado()]
           ├─ obtenerNumeroBoleta(id_rifa, placa, id_boleta)
           │  ↓
           │  SELECT numero_boleta FROM rifa WHERE id_boleta = 357
           │  ↓
           │  Retorna: "008"  ← ✅ NÚMERO CORRECTO
           │
           └─ enviarNotificacionOrdenListaConRifa()
              ├─ SMS #2: "Tu orden está lista con boleta #008"  ✅
              └─ Genera token para recibo
                    ↓
                    [Frontend accede a /recibos?placa=JES32E]
                         ↓
                    [Backend recibos.routes.js:por-placa()]
                         ├─ SELECT ... LEFT JOIN rifa ON o.id_boleta = r.id_boleta
                         │  ↓
                         │  numero_rifa = "008"  ← ✅ CORRECTO
                         │
                         └─ JSON respuesta: { numero_rifa: "008" }
                              ↓
                         [Frontend recibo.component.ts]
                              ├─ this.orden = response.ordenes[0]
                              └─ Template: "🎟️ Número de Boleta: #{{ orden.numero_rifa }}"
                                   ↓
                                   Muestra: "#008"  ✅
```

---

## 🔗 ENDPOINTS CRÍTICOS

### 1. PUT /api/ordenes/{id} - Actualizar Estado
**Archivo:** `backend-/src/controllers/orden.controller.js:updateOrden()`

**Antes del Fix:**
```javascript
const { id_rifa } = body;  // ❌ id_boleta NO se extrae
const SELECT ... id_rifa;  // ❌ id_boleta NO se obtiene
UPDATE orden SET id_rifa = $1;  // ❌ id_boleta NO se actualiza
id_boleta: undefined  // ❌ Pasa undefined a notificación
```

**Después del Fix:**
```javascript
const { id_rifa, id_boleta } = body;  // ✅ Ambos se extraen
const SELECT ... id_rifa, id_boleta;  // ✅ Ambos se obtienen
if (id_boleta !== undefined) UPDATE id_boleta;  // ✅ Se actualiza
id_boleta: 357  // ✅ Valor correcto pasa a notificación
```

**Impacto:** SMS #2 y Recibos ahora obtienen número correcto de boleta

---

### 2. POST /api/rifas/asignar-boleta - Asignar Boleta
**Archivo:** `backend-/src/controllers/rifa.controller.secured.js:asignarBoletaAOrden()`

**Función:** Actualiza orden.id_boleta cuando usuario selecciona boleta

**Query:**
```sql
BEGIN;
SELECT id_boleta FROM rifa WHERE numero_boleta = $1;
UPDATE orden SET id_boleta = 357 WHERE id_orden = $2;
COMMIT;
```

**Asignación:** orden.id_boleta = 357 ✅

---

### 3. GET /api/recibos/por-placa/{placa} - Obtener Recibos
**Archivo:** `backend-/src/routes/recibos.routes.js:router.get('/por-placa/:placa')`

**Query:**
```sql
SELECT
  o.id_boleta,
  r_boleta.numero_boleta as numero_rifa
FROM orden o
LEFT JOIN rifa r_boleta ON o.id_boleta = r_boleta.id_boleta
```

**Problema Antiguo:**
- Si `o.id_boleta = NULL` → JOIN retorna nothing → `numero_rifa = NULL`
- Frontend: mostraba valor por defecto (#003 o similar)

**Después del Fix:**
- Si `o.id_boleta = 357` → JOIN retorna boleta → `numero_rifa = "008"`
- Frontend: muestra "#008" ✅

**Auto-asignación (líneas 65-109):**
```javascript
// Si hay órdenes sin boleta, asignarles una automáticamente
const ordenesSinBoleta = await client.query(
  `SELECT o.id_orden FROM orden WHERE id_boleta IS NULL AND id_rifa IS NOT NULL`
);
for (const orden of ordenesSinBoleta.rows) {
  // Asignar boleta disponible
  UPDATE orden SET id_boleta = (SELECT id_boleta FROM rifa WHERE ...)
}
```

---

### 4. notificarCambioDeEstado() - Enviar SMS
**Archivo:** `backend-/src/services/orderStatusNotification.service.js`

**Flujo:**
```javascript
export const notificarCambioDeEstado = async (
  estadoAnterior,
  estadoNuevo,
  ordenDatos,  // ← CONTIENE id_boleta
  id_rifa
) => {
  // Si transición es → "LISTA":
  if (esTransicionALista) {
    const numeroBoleta = await obtenerNumeroBoleta(
      id_rifa,
      placa_vehiculo,
      id_boleta,  // ← ✅ CRÍTICO: Sin esto, falla
      id_orden
    );
    // SMS #2 con número correcto
    return await enviarNotificacionOrdenListaConRifa(
      telefono,
      nombre,
      numeroBoleta,  // "008"
      ...
    );
  }
}
```

**Antes del Fix:**
```
ordenDatos.id_boleta = undefined
→ obtenerNumeroBoleta(..., undefined, ...)
→ Auto-asigna boleta aleatoria (FIFO)
→ Posible duplicado #003
→ SMS: "boleta #003"
```

**Después del Fix:**
```
ordenDatos.id_boleta = 357
→ obtenerNumeroBoleta(..., 357, ...)
→ SELECT numero_boleta FROM rifa WHERE id_boleta = 357
→ Retorna: "008"
→ SMS: "boleta #008"  ✅
```

---

## 🔍 VALIDACIÓN PRÁCTICA

### Test 1: Verificar que SMS tiene número correcto

```bash
# Crear una orden con rifa y boleta #075
# Completar la orden
# Verificar SMS recibido:
# ✅ Correcto: "Tu orden está lista con boleta #075"
# ❌ Fallo: "Tu orden está lista con boleta #003"
```

### Test 2: Verificar que Recibo tiene número correcto

```bash
# GET /recibos?placa=JES32E
# Orden 359 debe mostrar: #008 (no #003)

curl https://thedetailer.up.railway.app/api/recibos/por-placa/JES32E | \
  jq '.ordenes[] | select(.id_orden == 359) | .numero_rifa'

# Esperado: "008"
# Fallo anterior: null
```

### Test 3: Verificar que endpoint de debug funciona

```bash
curl https://thedetailer.up.railway.app/api/debug/orden/359 | \
  jq '.resumen.boleta_asignada'

# Esperado: "#008"
# Fallo anterior: "#003"
```

---

## 📝 RESUMEN DE CAMBIOS EN ENDPOINTS

| Endpoint | Cambio | Impacto |
|----------|--------|---------|
| PUT /ordenes/{id} | ✅ Preserva id_boleta | SMS #2 correcta |
| POST /rifas/asignar-boleta | ✅ Sin cambios (ya funcionaba) | Asignación correcta |
| GET /recibos/por-placa/{placa} | ✅ Auto-asigna boletas sin ID | Recibos correctos |
| notificarCambioDeEstado() | ✅ Recibe id_boleta correcto | SMS con número correcto |

---

## 🎯 PUNTO CRÍTICO

**El verdadero problema NO es que los endpoints no tengan datos.**

**El problema es que PUT /ordenes/{id} no PRESERVABA id_boleta.**

Flujo:
1. POST /asignar-boleta → BD: id_boleta = 357 ✅
2. PUT /ordenes/{id} → Payload sin id_boleta → BD: id_boleta = NULL ✗
3. Notificación usa NULL → Auto-asigna → Posible #003 ✗

**El fix:** Incluir id_boleta en payload de PUT, y en SELECT de updateOrden()

---

## ✅ DESPUÉS DEL FIX

```
POST /asignar-boleta → BD: id_boleta = 357 ✅
PUT /ordenes/{id} → Payload CON id_boleta: 357 ✅
SELECT updateOrden → OBTIENE id_boleta = 357 ✅
Notificación → USO id_boleta = 357 ✅
SMS #2 → "boleta #008" ✅
Recibo → "boleta #008" ✅
```

