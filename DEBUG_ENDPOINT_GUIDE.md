# 🔍 Debug Endpoint - Análisis Completo de Órdenes

## Endpoint creado
```
GET /api/debug/orden/:id
```

## Autenticación
Requiere un token JWT válido. Puedes obtenerlo usando tus credenciales de admin.

## Uso en Desarrollo

### Paso 1: Obtener token
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@thedetailer.com",
    "password": "tu_contraseña"
  }'
```

Copia el `token` de la respuesta.

### Paso 2: Consultar orden
```bash
curl -X GET http://localhost:3000/api/debug/orden/358 \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

## Uso en Producción (Railway)

```bash
curl -X GET https://thedetailer.up.railway.app/api/debug/orden/358 \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

## Respuesta esperada

El endpoint retorna un JSON con:
```json
{
  "orden": {
    "id_orden": 358,
    "nombre_cliente": "...",
    "id_rifa": 1,
    "id_boleta": 357,      // ✅ CRÍTICO: Debe tener valor, NO null
    "estado": "Lista",
    ...
  },
  "boleta": {
    "id_boleta": 357,
    "numero_boleta": "008",
    "nombre": "...",
    ...
  },
  "evento": {
    "id_evento": 1,
    "encargado": "...",
    ...
  },
  "validacion": {
    "Orden existe": "✅",
    "Tiene rifa": "✅",
    "Tiene id_boleta": "✅",           // Debe ser ✅
    "Boleta registrada en tabla rifa": "✅",
    "Evento existe": "✅"
  },
  "resumen": {
    "numero_orden": 358,
    "boleta_asignada": "#008",        // Debe mostrar número, NO "#003"
    "estado": "Lista"
  }
}
```

## Checklist de Validación para Orden 358

✅ `id_boleta` no es `null`  
✅ `numero_boleta` es el que seleccionaste (NO #003)  
✅ `Tiene id_boleta` = ✅  
✅ `Boleta registrada en tabla rifa` = ✅  

Si todos están ✅, **el fix funcionó correctamente**.

## Alternativa: Consultar directamente en Railway

Si prefieres query SQL directo en Railway, ejecuta:
```sql
SELECT 
  o.id_orden,
  o.nombre_cliente,
  o.id_rifa,
  o.id_boleta,
  r.numero_boleta,
  o.estado,
  o.fecha
FROM orden o
LEFT JOIN rifa r ON o.id_boleta = r.id_boleta
WHERE o.id_orden = 358;
```

Si `id_boleta` NO es NULL y `numero_boleta` muestra el número correcto → **Fix validado ✅**
