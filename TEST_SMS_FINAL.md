# 🧪 PRUEBA FINAL DE SMS #1, #2, #3

## Estado Actual

✅ **SMS #1** - Funciona (Orden en PROCESO)  
✅ **SMS #2** - Funciona (Orden en LISTA) - **ARREGLADO: Ya no llega duplicado**  
✅ **SMS #3** - Backend confirma envío exitoso (subid recibido) - **VERIFICAR RECEPCIÓN**

---

## 📋 Checklist Completo

### 1️⃣ Preparar Backend
```bash
# Asegúrate que Railway haya reconstruido los últimos 3 commits:
# - 08a7d2e: Fix Railway SIGTERM 
# - 9c81bd3: Add SMS #3 test endpoint
# - d89ee3c: Fix duplicate SMS #2
```

### 2️⃣ Crear Orden de Prueba
1. Accede a the-detailer.co (Frontend)
2. Crea una **NUEVA ORDEN** con:
   - Cliente: "TEST SMS"
   - Teléfono: **TU NÚMERO PERSONAL** (para recibir SMS)
   - Placa: "TEST00"
   - Tipo: Moto
   - Servicio: Lavado (cualquier servicio)
3. Guarda la orden → Deberías recibir **SMS #1** ("En PROCESO")

### 3️⃣ Cambiar a LISTA
1. Abre la orden creada
2. Haz clic en "Completar Orden" (sin rifa)
3. Estado cambia a LISTA → Deberías recibir **SMS #2** ("Orden LISTA")

### 4️⃣ Prueba Manual de SMS #3 (Endpoint de Debug)
```bash
# Ejecuta esta petición POST:
POST http://thedetailer-backend.railway.app/api/debug/test-sms3/[TU_ID_ORDEN]

# Ejemplo real:
POST http://thedetailer-backend.railway.app/api/debug/test-sms3/370
```

**Respuesta esperada:**
```json
{
  "success": true,
  "mensaje": "SMS #3 enviado - Revisa los logs del servidor para detalles",
  "resultado": {
    "success": true,
    "subid": "6a92041e857a0"  // ← Confirmación de LabsMobile
  }
}
```

### 5️⃣ Verificar Recepción
- ⏱️ Espera 10-15 segundos
- 📱 **Revisa tu teléfono**
- 🔍 SMS debería decir: "¡Orden #XXX completada! ✅\nhttps://the-detailer.co/recibos?placa=TEST00"

---

## 🔍 Diagnóstico

| SMS | Estado Anterior → Nuevo | Esperado | ✅/❌ |
|-----|------------------------|----------|------|
| #1  | NULL → PROCESO | "Tu orden está EN PROCESO" | ✅ |
| #2  | PROCESO → LISTA | "Tu orden está LISTA con boleta" | ✅ |
| #3  | LISTA → FINALIZADA | "¡Orden completada!" + Link | ❓ |

---

## 📊 Si SMS #3 NO llega:

### Posibles Causas:
1. **Número telefónico incorrecto**
   - Verifica que el campo "Teléfono" sea correcto (sin +57, solo el número)
   
2. **LabsMobile envía pero cliente no recibe**
   - Revisa el log de Railway: "✓ SMS enviado a +57[número] (70 chars)"
   - Si está ahí, el problema es externo (operador bloqueando, etc)
   
3. **Delay en entrega**
   - LabsMobile a veces tarda 30-60 segundos en entregar SMS
   - Espera más tiempo antes de descartar

4. **Número bloqueado**
   - Algunos operadores Colombianos (Claro, Movistar) bloq​ean números específicos
   - Prueba con otro número

---

## 📱 Alternativamente: Revisar BD directamente

```sql
-- Ver token generado para SMS #3:
SELECT * FROM recibo_token 
WHERE id_orden = 370 
ORDER BY creado_at DESC LIMIT 1;

-- Resultado esperado:
-- id_orden: 370
-- token_hash: (hash SHA256)
-- activo: true
-- expira_at: (24 horas desde ahora)
```

---

## ✅ Criterio de Éxito

**SMS #3 FUNCIONA CUANDO:**
1. Endpoint `/api/debug/test-sms3/[id]` retorna `success: true`
2. Log de Railway muestra: `✓ SMS enviado a +57[número]`
3. Cliente recibe SMS dentro de 10-60 segundos
4. SMS contiene el link correcto: `https://the-detailer.co/recibos?placa=...`

---

## 🚀 Próximos Pasos

1. ✅ Railway reconstruyó con los 3 fixes
2. ⏳ **AHORA:** Ejecuta la prueba manual con `/api/debug/test-sms3/[id]`
3. 📲 Verifica si SMS #3 llega en 60 segundos
4. 📋 Reporta si:
   - ✅ SMS llega correctamente
   - ❌ SMS no llega pero endpoint dice `success: true`
   - ⚠️ Endpoint retorna error
