# 📱 Crear Template en Kapso AI

## ✅ Decisión: UN ÚNICO TEMPLATE GENÉRICO

Hemos refactorizado el sistema para usar **UN SOLO TEMPLATE** que funciona para TODOS los casos:
- Inicio de servicio
- Orden lista
- Orden con rifa
- Modificación de orden
- Recibo de venta

---

## 🎯 Template a Crear

**Nombre:** `the_detailer_notificacion`

**Parámetros:** 4 parámetros dinámicos {{1}}, {{2}}, {{3}}, {{4}}

**Contenido sugerido:**

```
Hola {{1}},

{{2}}

{{3}}

{{4}}

¡Gracias por confiar en nosotros! 🙌
```

### Explicación de Parámetros:
- `{{1}}` = Nombre del cliente
- `{{2}}` = Mensaje principal (descripción de la acción)
- `{{3}}` = Total/monto (opcional, puede ser vacío)
- `{{4}}` = Información adicional: rifa, sede, productos (opcional, puede ser vacío)

---

## 📋 Paso a Paso en Kapso

### 1. Acceder al Panel de Kapso
1. Abre https://kapso.ai en tu navegador
2. Inicia sesión con tus credenciales
3. Busca la sección **"Templates"** o **"Message Templates"**

### 2. Crear Nuevo Template
1. Haz clic en **"Create Template"** o **"Nueva Plantilla"**
2. Selecciona **WhatsApp** como canal
3. Selecciona idioma: **Español (México)** o **Español** según disponibilidad

### 3. Completar Información del Template
- **Nombre (Template Name):** `the_detailer_notificacion`
- **Categoría (Category):** `ACCOUNT_UPDATE` o `TRANSACTIONAL` (elige la más cercana)
- **Tipo:** Message Template

### 4. Crear el Contenido
En la sección de contenido, escribe exactamente esto:

```
Hola {{1}},

{{2}}

{{3}}

{{4}}

¡Gracias por confiar en nosotros! 🙌
```

**Importante:**
- Los `{{1}}`, `{{2}}`, `{{3}}`, `{{4}}` son parámetros dinámicos
- Kapso puede mostrarlos automáticamente o pedirte confirmarlos
- Algunos campos pueden ser opcionales (dejar en blanco está bien)

### 5. Agregar Ejemplos (si Kapso lo solicita)
Kapso podría pedir ejemplos para cada parámetro:

```
{{1}}: Carlos
{{2}}: 🚗 Tu vehículo con placa ABC-123 está listo para recoger.
{{3}}: $150.000
{{4}}: 
```

### 6. Revisar y Enviar
1. Revisa que todo esté correcto
2. Haz clic en **"Submit"** o **"Enviar"**
3. Kapso enviará a Meta (WhatsApp) para aprobación

### 7. Esperar Aprobación
- **Tiempo de aprobación:** Usualmente 30 minutos a 24 horas
- **Estado:** Verás cambiar de "PENDING" a "APPROVED"

---

## 🔄 Si Kapso Usa Interfaz Visual

Algunos templates en Kapso se crean con interfaz visual:

1. **Body (Cuerpo):** Escribe el contenido con variables
2. **Variables/Parámetros:** Define {{1}}, {{2}}, {{3}}, {{4}}
3. **Header (Opcional):** Puedes agregar encabezado
4. **Footer (Opcional):** Puedes agregar pie de página
5. **Buttons (Opcional):** Agrega botones si lo deseas

---

## 🧪 Alternativa: Template Simple Sin Parámetros

Si Kapso no acepta parámetros dinámicos, crea un template simplificado:

```
Hola cliente,

Tu solicitud ha sido procesada.

Gracias por confiar en nosotros.

The Detailer
```

Pero esto sería menos flexible. **Recomendamos intentar primero con parámetros.**

---

## ✅ Verificación Post-Aprobación

Una vez aprobado, verifica:

1. Abre terminal en `backend-/`
2. Ejecuta prueba:
   ```bash
   node test-whatsapp.js
   ```
3. Deberías ver:
   ```
   [KAPSO] 📤 Enviando template "the_detailer_notificacion" a +573108030240...
   [KAPSO] ✅ Enviado (messageId: wamid.xxx)
   Resultado: ✅ ÉXITO
   ```

---

## 🚨 Solución de Problemas

### Error: "Template not found"
- Verifica que el nombre sea exacto: `the_detailer_notificacion`
- Asegúrate de que está **APPROVED** (no PENDING)

### Error: "Invalid language code"
- Usa `es_MX` (Español México)
- O intenta `es_ES` (Español España)

### Error: "Invalid parameters"
- Asegúrate de tener exactamente 4 parámetros {{1}}, {{2}}, {{3}}, {{4}}
- Los parámetros deben estar numerados secuencialmente

### El template se aprueba pero no se envía
- Espera 5-10 minutos después de aprobación
- Kapso necesita tiempo para sincronizar con Meta

---

## 📊 Resumen de Casos de Uso

Con este template único, se envían mensajes para:

| Caso | Parámetros |
|------|-----------|
| Inicio de servicio | nombre, descripción, "", "" |
| Orden lista | nombre, descripción, total, "" |
| Orden + rifa | nombre, descripción, total, info_rifa |
| Modificación | nombre, descripción, nuevo_total, "" |
| Recibo venta | nombre, descripción, total, productos |

---

## 💡 Ventajas de Este Enfoque

✅ **UN template = Menos mantenimiento**
✅ **Flexible = Funciona para todos los casos**
✅ **Escalable = Fácil agregar nuevos tipos de mensajes**
✅ **Controlado = Un punto de aprobación**
✅ **Profesional = Mensaje consistente**

---

## 🎯 Próximos Pasos

1. ✅ Crear template en Kapso
2. ✅ Esperar aprobación (horas)
3. ✅ Ejecutar `node test-whatsapp.js`
4. ✅ Verificar que todos los mensajes se envíen
5. ✅ Integrar en la aplicación

**¿Necesitas ayuda con algo?** Revisa los logs del servidor en `test-whatsapp.js` para ver exactamente qué está sucediendo.
