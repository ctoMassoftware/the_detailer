# 📱 Análisis y Setup de WhatsApp - Kapso AI

**Fecha de análisis:** 2026-07-16  
**Estado:** Sistema listo, requiere templates de WhatsApp

---

## ✅ Lo que Está Funcionando

### 1. Credenciales de Kapso
- ✅ API Key validada y funcional
- ✅ Phone ID configurado: `1183799051484040`
- ✅ URL de API correcta: `https://api.kapso.ai/meta/whatsapp/v24.0`

### 2. Normalización de Números Telefónicos
- ✅ Convierte `3108030240` → `+573108030240` correctamente
- ✅ Maneja números con y sin prefijo de país
- ✅ Valida formato para Colombia (+57)

### 3. Sistema de Envío
- ✅ Detecta cuando hay sesión activa (24h window)
- ✅ Automáticamente intenta enviar template si sesión no está activa
- ✅ Logs detallados para debugging

---

## 🎯 Lo que Falta: WhatsApp Templates

### El Problema
WhatsApp requiere que todos los mensajes usen **templates pre-aprobados**. El sistema está intentando hacer esto, pero:

**Error 400:** `Hello World templates can only be sent from the Public Test Numbers`

Esto significa que el template `hello_world` de prueba no funciona con números reales.

---

## 🛠️ Pasos para Resolver

### Paso 1: Acceder a tu Panel de Kapso AI
1. Dirígete a: https://kapso.ai (o donde esté tu panel)
2. Inicia sesión con tus credenciales
3. Busca la sección "Templates" o "WhatsApp Templates"

### Paso 2: Crear Templates Personalizados
Necesitas crear al menos 3 templates (o puedes usar menos). Ejemplos:

#### Template 1: Inicio de Servicio
```
Nombre: template_inicio_servicio
Contenido:
Hola {{1}},

Hemos recibido tu vehículo con placa {{2}}.

Trabajaremos en tu orden lo más rápido posible.

¡Gracias por confiar en nosotros! 🙌
```

#### Template 2: Orden Lista
```
Nombre: template_orden_lista
Contenido:
Hola {{1}},

Tu vehículo con placa {{2}} está listo para recoger.

💰 Total a pagar: ${{3}}

¡Gracias por confiar en nosotros! 🙌
```

#### Template 3: Recibo de Venta
```
Nombre: template_recibo_mostrador
Contenido:
🛍️ Venta Confirmada

Hola {{1}},

Gracias por tu compra en The Detailer.

💰 Total Pagado: ${{2}}

¡Vuelve pronto! 🙌
```

### Paso 3: Obtener Nombres de Templates Aprobados
Una vez creados, Kapso/WhatsApp los aprobará. Necesitarás sus nombres exactos.

### Paso 4: Actualizar `.env`
```env
KAPSO_TEMPLATE_INICIO=template_inicio_servicio
KAPSO_TEMPLATE_ORDEN_LISTA=template_orden_lista
KAPSO_TEMPLATE_RECIBO=template_recibo_mostrador
KAPSO_TEMPLATE_LANGUAGE=es_MX
```

### Paso 5: Actualizar el Servicio de WhatsApp
El servicio necesitará ser actualizado para pasar los parámetros del template.

---

## 📞 Pruebas Realizadas (16/07/2026)

### Test 1: Notificación de Inicio de Servicio
```
Teléfono: +573108030240
Resultado: ❌ Error 422 (fuera de ventana 24h)
Fallback: ❌ Intentó template, pero template no disponible
```

### Test 2: Notificación Simple (Orden Lista)
```
Teléfono: +573108030240
Resultado: ❌ Error 422 (fuera de ventana 24h)
Fallback: ❌ Intentó template, pero template no disponible
```

### Test 3: Recibo de Venta Mostrador
```
Teléfono: +573108030240
Resultado: ❌ Error 422 (fuera de ventana 24h)
Fallback: ❌ Intentó template, pero template no disponible
```

---

## 🔄 Flujo Actual del Sistema

```
1. Usuario intenta enviar mensaje de texto
   ↓
2. Sistema intenta enviar vía Kapso
   ↓
3. ¿Hay sesión activa (24h)?
   ├─ SÍ → Envía mensaje ✅
   └─ NO → Error 422
       ↓
4. Intenta enviar template
   ├─ ✅ Template existe y es válido → Sesión abierta
   └─ ❌ Template no válido → Falla
       ↓
5. Si Kapso falla → Intenta Twilio (fallback)
```

---

## 🚀 Próximos Pasos

1. **Crear templates en Kapso** (máxima prioridad)
2. **Actualizar `.env` con nombres de templates**
3. **Ejecutar prueba nuevamente:**
   ```bash
   cd backend-
   node test-whatsapp.js
   ```
4. **El primer mensaje abrirá la sesión de 24h**
5. **Los siguientes mensajes se enviarán como texto libre**

---

## 📋 Checklist

- [ ] Acceder al panel de Kapso
- [ ] Crear templates personalizados
- [ ] Obtener nombres exactos de templates
- [ ] Actualizar archivo `.env`
- [ ] Ejecutar `node test-whatsapp.js` nuevamente
- [ ] Verificar que el primer mensaje sea un template
- [ ] Verificar que los siguientes sean texto libre
- [ ] Probar en aplicación (crear orden, venta, etc.)

---

## 📧 Contacto y Soporte

Si tienes problemas:
1. Verifica los nombres de los templates en Kapso
2. Asegúrate de que estén **aprobados** (no pendientes)
3. Revisa los logs del servidor para mensajes de error específicos
4. Contacta a Kapso AI si un template no se aprueba
