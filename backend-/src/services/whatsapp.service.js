import { getTwilioClient } from '../config/twilio.config.js';
import { logMessage } from './messageLogger.service.js';

// Phone number normalization
const normalizarNumeroTelefonico = (numero) => {
  if (!numero) return null;

  // Remove spaces, dashes, parentheses
  let limpio = numero.replace(/[\s\-()]/g, '');

  // If it starts with 3, add +57 (Colombia)
  if (limpio.startsWith('3') && !limpio.startsWith('+')) {
    limpio = '+57' + limpio;
  }

  // If it starts with +573, it's already correct
  if (limpio.startsWith('+573')) {
    return limpio;
  }

  // If it starts with 573, add +
  if (limpio.startsWith('573')) {
    return '+' + limpio;
  }

  return limpio;
};

/**
 * Send message via Twilio WhatsApp
 * @param {string} toNumber - Recipient number (normalized)
 * @param {string} messageBody - Message content
 * @param {Object} metadata - Additional metadata for logging
 * @returns {Promise<{success: boolean, sid?: string, error?: Error}>}
 */
const sendViaWhatsApp = async (toNumber, messageBody, metadata = {}) => {
  try {
    const client = getTwilioClient();

    const message = await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: `whatsapp:${toNumber}`,
      body: messageBody
    });

    // Log successful message
    await logMessage({
      phoneNumber: toNumber,
      messageBody,
      status: 'success',
      twilioSid: message.sid,
      notificationType: metadata.type,
      userId: metadata.userId,
      orderId: metadata.orderId
    });

    console.log(`✓ WhatsApp sent to ${toNumber} (SID: ${message.sid})`);
    return { success: true, sid: message.sid };
  } catch (error) {
    // Log failed message
    await logMessage({
      phoneNumber: toNumber,
      messageBody,
      status: 'failed',
      errorDetails: {
        code: error.code,
        message: error.message,
        details: error.details?.errors?.[0]?.message
      },
      notificationType: metadata.type,
      userId: metadata.userId,
      orderId: metadata.orderId
    });

    console.error(`✗ WhatsApp failed for ${toNumber}:`, error.message);
    return { success: false, error };
  }
};

/**
 * Format notification message for order
 */
const formatOrderNotification = (clientName, message, total, additionalInfo = '') => {
  let fullMessage = `¡Hola ${clientName}!

${message}

`;

  if (total) {
    fullMessage += `Valor total: $${total.toLocaleString('es-CO')}

`;
  }

  if (additionalInfo) {
    fullMessage += additionalInfo;
  }

  return fullMessage.trim();
};

// EXPORTED NOTIFICATION FUNCTIONS
export const enviarNotificacionInicioServicio = async (telefono, nombreCliente, total, metadata = {}) => {
  const numeroNormalizado = normalizarNumeroTelefonico(telefono);
  if (!numeroNormalizado) {
    console.error('Invalid phone number:', telefono);
    return { success: false, error: 'Invalid phone number' };
  }

  const mensaje = formatOrderNotification(
    nombreCliente,
    'Tu orden ha sido recibida y está en proceso.',
    total,
    '¡Gracias por confiar en nosotros!'
  );

  return sendViaWhatsApp(numeroNormalizado, mensaje, {
    type: 'orden_inicio',
    ...metadata
  });
};

export const enviarNotificacionOrdenListaSinRifa = async (telefono, nombreCliente, total, metadata = {}) => {
  const numeroNormalizado = normalizarNumeroTelefonico(telefono);
  if (!numeroNormalizado) {
    console.error('Invalid phone number:', telefono);
    return { success: false, error: 'Invalid phone number' };
  }

  const mensaje = formatOrderNotification(
    nombreCliente,
    '¡Tu vehículo está listo!',
    total,
    'Por favor dirígete a recoger tu orden.\n¡Gracias por tu preferencia!'
  );

  return sendViaWhatsApp(numeroNormalizado, mensaje, {
    type: 'orden_lista_sin_rifa',
    ...metadata
  });
};

export const enviarNotificacionOrdenListaConRifa = async (telefono, nombreCliente, total, numeroRifa, metadata = {}) => {
  const numeroNormalizado = normalizarNumeroTelefonico(telefono);
  if (!numeroNormalizado) {
    console.error('Invalid phone number:', telefono);
    return { success: false, error: 'Invalid phone number' };
  }

  const mensaje = formatOrderNotification(
    nombreCliente,
    '¡Tu vehículo está listo!',
    total,
    `Tu número de rifa: ${numeroRifa}

Por favor dirígete a recoger tu orden.\n¡Gracias por tu preferencia!`
  );

  return sendViaWhatsApp(numeroNormalizado, mensaje, {
    type: 'orden_lista_con_rifa',
    ...metadata
  });
};

export const enviarNotificacionOrdenTerminada = async (telefono, nombreCliente, total, metadata = {}) => {
  const numeroNormalizado = normalizarNumeroTelefonico(telefono);
  if (!numeroNormalizado) {
    console.error('Invalid phone number:', telefono);
    return { success: false, error: 'Invalid phone number' };
  }

  const mensaje = formatOrderNotification(
    nombreCliente,
    '¡Tu orden ha sido finalizada y tu vehículo está listo para recoger!',
    total,
    '¡Esperamos verte pronto!'
  );

  return sendViaWhatsApp(numeroNormalizado, mensaje, {
    type: 'orden_terminada',
    ...metadata
  });
};

export const enviarNotificacionSimple = async (telefono, mensaje, metadata = {}) => {
  const numeroNormalizado = normalizarNumeroTelefonico(telefono);
  if (!numeroNormalizado) {
    console.error('Invalid phone number:', telefono);
    return { success: false, error: 'Invalid phone number' };
  }

  return sendViaWhatsApp(numeroNormalizado, mensaje, {
    type: 'notificacion_simple',
    ...metadata
  });
};

export const enviarNotificacionModificacion = async (telefono, nombreCliente, detallesCambio, metadata = {}) => {
  const numeroNormalizado = normalizarNumeroTelefonico(telefono);
  if (!numeroNormalizado) {
    console.error('Invalid phone number:', telefono);
    return { success: false, error: 'Invalid phone number' };
  }

  const mensaje = `¡Hola ${nombreCliente}!

Tu orden ha sido modificada:

${detallesCambio}

Si tienes dudas, no dudes en contactarnos.`;

  return sendViaWhatsApp(numeroNormalizado, mensaje, {
    type: 'orden_modificacion',
    ...metadata
  });
};

export const enviarReciboMostrador = async (telefono, nombreCliente, detallesRecibo, total, metadata = {}) => {
  const numeroNormalizado = normalizarNumeroTelefonico(telefono);
  if (!numeroNormalizado) {
    console.error('Invalid phone number:', telefono);
    return { success: false, error: 'Invalid phone number' };
  }

  const mensaje = `¡Hola ${nombreCliente}!

Gracias por tu compra.

${detallesRecibo}

Total: $${total.toLocaleString('es-CO')}

¡Esperamos verte pronto!`;

  return sendViaWhatsApp(numeroNormalizado, mensaje, {
    type: 'recibo_mostrador',
    ...metadata
  });
};
