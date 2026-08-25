# 📱 Endpoint Dinámico para Enviar SMS con LabsMobile

## Descripción

Endpoint que permite enviar mensajes SMS usando LabsMobile **sin depender de variables de entorno de Railway**. Recibe credenciales dinámicamente en cada solicitud.

**Ventajas:**
- ✅ No requiere guardar credenciales en Railway
- ✅ Permite usar múltiples cuentas de LabsMobile
- ✅ Flexibilidad para diferentes proyectos
- ✅ Envío a uno o múltiples números

---

## 📍 Endpoint

```
POST /api/sms/enviar
```

---

## 📋 Estructura del Request

### Headers
```
Content-Type: application/json
```

### Body

```json
{
  "credentials": {
    "username": "cto@massoftware.co",
    "apiToken": "fbmU0QMy227xlc1VDGop6jbcbOkG70Yb",
    "sender": "The Detailer"
  },
  "mensaje": "Visitanos en celuweb: https://celuweb.com",
  "telefonos": ["3117899331", "3108030240"]
}
```

### Campos Requeridos

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `credentials.username` | string | Email registrado en LabsMobile | `cto@massoftware.co` |
| `credentials.apiToken` | string | Token API de LabsMobile | `fbmU0QMy227xlc1VDGop6jbcbOkG70Yb` |
| `credentials.sender` | string | Nombre que aparecerá como remitente | `The Detailer` |
| `mensaje` | string | Contenido del SMS | `Hola! Este es un mensaje de prueba` |
| `telefonos` | string \| array | Número(s) de teléfono | `"3117899331"` o `["3117899331", "3108030240"]` |

---

## 📝 Ejemplos de Uso

### 1️⃣ Enviar a un único número

```bash
curl -X POST https://tu-backend/api/sms/enviar \
  -H "Content-Type: application/json" \
  -d '{
    "credentials": {
      "username": "cto@massoftware.co",
      "apiToken": "fbmU0QMy227xlc1VDGop6jbcbOkG70Yb",
      "sender": "The Detailer"
    },
    "mensaje": "Hola! Tu orden está lista",
    "telefonos": "3117899331"
  }'
```

### 2️⃣ Enviar a múltiples números

```bash
curl -X POST https://tu-backend/api/sms/enviar \
  -H "Content-Type: application/json" \
  -d '{
    "credentials": {
      "username": "cto@massoftware.co",
      "apiToken": "fbmU0QMy227xlc1VDGop6jbcbOkG70Yb",
      "sender": "The Detailer"
    },
    "mensaje": "Visitanos en celuweb: https://celuweb.com",
    "telefonos": ["3117899331", "3108030240", "3151234567"]
  }'
```

### 3️⃣ Con JavaScript/Fetch

```javascript
const enviarSMS = async () => {
  const response = await fetch('https://tu-backend/api/sms/enviar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      credentials: {
        username: 'cto@massoftware.co',
        apiToken: 'fbmU0QMy227xlc1VDGop6jbcbOkG70Yb',
        sender: 'The Detailer'
      },
      mensaje: '¡Tu vehículo está listo!',
      telefonos: ['3117899331', '3108030240']
    })
  });

  const resultado = await response.json();
  console.log(resultado);
};
```

---

## ✅ Respuesta Exitosa

```json
{
  "success": true,
  "total": 2,
  "exitosos": 2,
  "fallidos": 0,
  "resultados": [
    {
      "numero": "+573117899331",
      "success": true,
      "subid": "6a8da8bd4c54a",
      "message": "SMS enviado exitosamente"
    },
    {
      "numero": "+573108030240",
      "success": true,
      "subid": "6a8da8bd4c54b",
      "message": "SMS enviado exitosamente"
    }
  ]
}
```

---

## ❌ Respuesta con Error

### Error de validación

```json
{
  "error": "Credenciales de LabsMobile requeridas",
  "required": [
    "credentials.username",
    "credentials.apiToken",
    "credentials.sender"
  ]
}
```

### Error en envío a un número

```json
{
  "success": true,
  "total": 2,
  "exitosos": 1,
  "fallidos": 1,
  "resultados": [
    {
      "numero": "+573117899331",
      "success": true,
      "subid": "6a8da8bd4c54a",
      "message": "SMS enviado exitosamente"
    },
    {
      "numero": "+573108030240",
      "success": false,
      "code": "401",
      "error": "Unauthorized"
    }
  ]
}
```

---

## 📞 Formatos de Números Soportados

El endpoint **normaliza automáticamente** los números a formato `+57XXXXXXXXXX`:

| Formato | Resultado |
|---------|-----------|
| `3117899331` | `+573117899331` ✅ |
| `+573117899331` | `+573117899331` ✅ |
| `573117899331` | `+573117899331` ✅ |
| `(311) 789-9331` | `+573117899331` ✅ |
| `311-789-9331` | `+573117899331` ✅ |

---

## 🔐 Seguridad

### ⚠️ Importante

- **NO** guardes credenciales en el código
- **NO** expongas credenciales en logs
- Usa HTTPS en producción
- Valida credenciales antes de enviar

### Recomendaciones

1. **Frontend:** Almacena credenciales en un lugar seguro (backend, sesión)
2. **Backend:** Valida que la solicitud venga de un usuario autenticado
3. **Logs:** Las credenciales se truncan automáticamente en logs

---

## 📊 Casos de Uso

### 1. Notificaciones de Órdenes

```javascript
await fetch('/api/sms/enviar', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    credentials: { /* ... */ },
    mensaje: '🎉 ¡Tu orden está lista! Recógela hoy.',
    telefonos: cliente_telefono
  })
});
```

### 2. Alertas a Múltiples Usuarios

```javascript
await fetch('/api/sms/enviar', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    credentials: { /* ... */ },
    mensaje: '⚠️ Promoción especial: 50% descuento hoy',
    telefonos: usuarios_telefonos // Array
  })
});
```

### 3. Confirmación de Citas

```javascript
await fetch('/api/sms/enviar', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    credentials: { /* ... */ },
    mensaje: '✅ Tu cita está confirmada para mañana a las 10am',
    telefonos: '3117899331'
  })
});
```

---

## 🔍 Validaciones

El endpoint valida:

✅ **Credenciales:**
- `username` no vacío
- `apiToken` no vacío
- `sender` (opcional, por defecto "DETAILER")

✅ **Mensaje:**
- No vacío
- Tipo string

✅ **Teléfonos:**
- Al menos uno proporcionado
- Se normaliza automáticamente

---

## 📋 Códigos de Error

| HTTP | Error | Solución |
|------|-------|----------|
| `400` | Credenciales requeridas | Verifica que enviaste `username` y `apiToken` |
| `400` | Mensaje requerido | Verifica que `mensaje` no esté vacío |
| `400` | Teléfonos requeridos | Verifica que `telefonos` está presente |
| `400` | No se pudieron normalizar números | Verifica formato de números telefónicos |
| `500` | Error procesando solicitud | Revisa logs del servidor |

---

## 🛠️ Alternativas

### Opción 1: Variables de Entorno (Original)

```javascript
// En index.js
const LABSMOBILE_USERNAME = process.env.LABSMOBILE_USERNAME;
const LABSMOBILE_API_TOKEN = process.env.LABSMOBILE_API_TOKEN;
```

**Ventajas:** Más simple, credenciales centralizadas  
**Desventajas:** Depende de Railway, no permite múltiples cuentas

### Opción 2: Credenciales Dinámicas (Este endpoint)

```javascript
// En request body
"credentials": { username, apiToken, sender }
```

**Ventajas:** Flexible, sin dependencia de Railway  
**Desventajas:** Mayor responsabilidad de seguridad en el cliente

### Opción 3: Base de datos

Guardar credenciales encriptadas en BD y recuperarlas por ID de proyecto.

---

## 📞 Soporte

Para problemas con LabsMobile:
- Panel: https://labsmobile.com
- API Docs: https://labsmobile.com/api

Para problemas con el endpoint:
- Revisa logs en Railway
- Verifica credenciales
- Prueba con números conocidos
