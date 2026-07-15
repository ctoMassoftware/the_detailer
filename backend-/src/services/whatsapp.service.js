import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

const client = twilio(accountSid, authToken);

// Phone normalization: remove non-digits, add +57 if missing
const normalizePhoneNumber = (phone) => {
  let normalized = phone.replace(/\D/g, ''); // Remove all non-digits
  if (!normalized.startsWith('57')) {
    normalized = '57' + normalized;
  }
  return '+' + normalized; // Return with + prefix: +57XXXXXXXXXX
};

// Send via Kapso AI API
const sendViaKapso = async (phoneNumber, mensaje) => {
  const kapsoUrl = process.env.KAPSO_API_URL;
  const kapsoPhoneId = process.env.KAPSO_PHONE_ID;
  const kapsoApiKey = process.env.KAPSO_API_KEY;

  // Check if Kapso is configured
  if (!kapsoUrl || !kapsoPhoneId || !kapsoApiKey) {
    console.log('[KAPSO] ❌ Kapso no configurado, saltando');
    return { success: false, error: 'Kapso not configured' };
  }

  const normalizedPhone = normalizePhoneNumber(phoneNumber);

  try {
    console.log(`[KAPSO] 📤 Enviando a ${normalizedPhone}...`);

    const response = await fetch(`${kapsoUrl}/${kapsoPhoneId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': kapsoApiKey
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalizedPhone,
        type: 'text',
        text: { body: mensaje }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[KAPSO] ❌ Error (${response.status}):`, data);
      return { success: false, error: data.error?.message || 'Unknown error' };
    }

    const messageId = data.messages?.[0]?.id || 'unknown';
    console.log(`[KAPSO] ✅ Enviado (messageId: ${messageId})`);
    return { success: true, messageId };
  } catch (error) {
    console.error(`[KAPSO] ❌ Exception:`, error.message);
    return { success: false, error: error.message };
  }
};

// Send via Twilio (fallback)
const sendViaTwilio = async (phoneNumber, mensaje) => {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);

  try {
    console.log(`[TWILIO] 📤 Enviando a ${normalizedPhone}...`);

    const response = await client.messages.create({
      from: fromNumber,
      to: `whatsapp:${normalizedPhone}`,
      body: mensaje
    });

    console.log(`[TWILIO] ✅ Enviado (sid: ${response.sid})`);
    return { success: true, messageId: response.sid };
  } catch (error) {
    console.error(`[TWILIO] ❌ Exception:`, error.message);
    return { success: false, error: error.message };
  }
};

// Orchestrate: try Kapso first, fallback to Twilio
const sendMessageWithFallback = async (phoneNumber, mensaje) => {
  // Try Kapso first
  const kapsoResult = await sendViaKapso(phoneNumber, mensaje);
  if (kapsoResult.success) {
    return true;
  }

  // Fallback to Twilio
  console.log('[FALLBACK] 🔄 Kapso falló, reintentando con Twilio...');
  const twilioResult = await sendViaTwilio(phoneNumber, mensaje);
  if (twilioResult.success) {
    return true;
  }

  // Both failed
  console.error('[FALLBACK] ❌ Ambos proveedores fallaron');
  return false;
};

// 1. Notificación Inicio Servicio
export const enviarNotificacionInicioServicio = async (nombre, telefono, placa) => {
  let numeroDestino = telefono.replace(/\D/g, '');
  if (!numeroDestino.startsWith('57')) {
    numeroDestino = '57' + numeroDestino;
  }

  const safeNombre = (nombre || 'Cliente').trim();
  const safePlaca = (placa || 'N/A').trim();

  const mensaje = `
👋 Hola ${safeNombre},

🚗 Hemos recibido tu vehículo con placa ${safePlaca}.

Trabajaremos en tu orden lo más rápido posible.

¡Gracias por confiar en nosotros! 🙌`;

  return await sendMessageWithFallback(numeroDestino, mensaje);
};

// 2. Notificación: Orden lista SIN rifa
export const enviarNotificacionOrdenListaSinRifa = async (nombre, telefono, placa, totalPagar) => {
  let numeroDestino = telefono.replace(/\D/g, '');
  if (!numeroDestino.startsWith('57')) {
    numeroDestino = '57' + numeroDestino;
  }

  const safeNombre = (nombre || 'Cliente').trim();
  const safePlaca = (placa || 'N/A').trim();
  const safeTotal = totalPagar != null ? String(totalPagar) : '0';

  const mensaje = `
👋 Hola ${safeNombre},

🚗 Tu vehículo con placa ${safePlaca} está listo para recoger.

💰 Total a pagar: $${safeTotal}

¡Gracias por confiar en nosotros! 🙌`;

  return await sendMessageWithFallback(numeroDestino, mensaje);
};

// 3. Notificación: Orden lista CON rifa
export const enviarNotificacionOrdenListaConRifa = async (nombre, telefono, placa, totalPagar, numeroBoleta) => {
  let numeroDestino = telefono.replace(/\D/g, '');
  if (!numeroDestino.startsWith('57')) {
    numeroDestino = '57' + numeroDestino;
  }

  const safeNombre = (nombre || 'Cliente').trim();
  const safePlaca = (placa || 'N/A').trim();
  const safeTotal = totalPagar != null ? String(totalPagar) : '0';
  const safeBoleta = numeroBoleta != null ? String(numeroBoleta) : '000';

  const mensaje = `
👋 Hola ${safeNombre},

🚗 Tu vehículo con placa ${safePlaca} está listo para recoger.

💰 Total a pagar: $${safeTotal}

🎟️ ¡The Detailer te premia!
Participas en nuestra rifa con la Lotería del Quindío con el número de boleta:
👉 ${safeBoleta}

¡Mucha suerte y gracias por confiar en nosotros! 🍀`;

  return await sendMessageWithFallback(numeroDestino, mensaje);
};

// 4. Notificación cuando hay boleta de rifa (Orden Terminada)
export const enviarNotificacionOrdenTerminada = async (nombre, telefono, placa, numeroBoleta, totalPagar) => {
  let numeroDestino = telefono.replace(/\D/g, '');
  if (!numeroDestino.startsWith('57')) {
    numeroDestino = '57' + numeroDestino;
  }

  const safeNombre = (nombre || 'Cliente').trim();
  const safePlaca = (placa || 'N/A').trim();
  const safeBoleta = numeroBoleta != null ? String(numeroBoleta) : '000';
  const safeTotal = totalPagar != null ? String(totalPagar) : '0';

  const mensaje = `
👋 Hola ${safeNombre},

🚗 Tu vehículo con placa ${safePlaca} está listo.

💰 Resumen del servicio:
Total a pagar: $${safeTotal}

🎟️ ¡The Detailer!
Como agradecimiento, participas en nuestra rifa con el número de boleta:
👉 ${safeBoleta}

¡Gracias por confiar en nosotros!`;

  return await sendMessageWithFallback(numeroDestino, mensaje);
};

// 5. Notificación simple sin rifa
export const enviarNotificacionSimple = async (nombre, telefono, placa, totalPagar) => {
  let numeroDestino = telefono.replace(/\D/g, '');
  if (!numeroDestino.startsWith('57')) {
    numeroDestino = '57' + numeroDestino;
  }

  const safeNombre = (nombre || 'Cliente').trim();
  const safePlaca = (placa || 'N/A').trim();
  const safeTotal = totalPagar != null ? String(totalPagar) : '0';

  const mensaje = `
👋 Hola ${safeNombre},

🚗 Tu vehículo con placa ${safePlaca} está listo para recoger.

💰 Resumen del servicio:
Total a pagar: $${safeTotal}

¡Gracias por confiar en nosotros! 🙌`;

  return await sendMessageWithFallback(numeroDestino, mensaje);
};

// 6. Notificación de modificación de orden
export const enviarNotificacionModificacion = async (nombre, telefono, placa, totalPagar) => {
  let numeroDestino = telefono.replace(/\D/g, '');
  if (!numeroDestino.startsWith('57')) {
    numeroDestino = '57' + numeroDestino;
  }

  const safeNombre = (nombre || 'Cliente').trim();
  const safePlaca = (placa || 'N/A').trim();
  const safeTotal = totalPagar != null ? String(totalPagar) : '0';

  const mensaje = `
👋 Hola ${safeNombre},

📝 Tu orden ha sido actualizada.

🚗 Vehículo: Placa ${safePlaca}

💰 Nuevo total: $${safeTotal}

Si tienes alguna pregunta, contáctanos. ¡Gracias! 🙌`;

  return await sendMessageWithFallback(numeroDestino, mensaje);
};

// 7. Notificación Venta de Mostrador
export const enviarReciboMostrador = async (nombre, telefono, sede, totalPagar, productos) => {
  let numeroDestino = telefono.replace(/\D/g, '');
  if (!numeroDestino.startsWith('57')) {
    numeroDestino = '57' + numeroDestino;
  }

  const safeNombre = (nombre || 'Cliente').trim();
  const safeSede = (sede || 'The Detailer').trim();
  const safeTotal = totalPagar != null ? String(totalPagar) : '0';

  let listaProductos = productos.map(p => `- ${p.cantidad}x ${p.nombre_producto}`).join('\n');

  const mensaje = `
🛍️ Venta Confirmada - The Detailer
📍 Sede: ${safeSede}

Hola ${safeNombre}, gracias por tu compra en mostrador.

🛒 Detalle:
${listaProductos}

💰 Total Pagado: $${safeTotal}

¡Vuelve pronto! 🙌`;

  return await sendMessageWithFallback(numeroDestino, mensaje);
};
