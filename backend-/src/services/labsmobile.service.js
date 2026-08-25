import https from 'https';
import { logMessage } from './messageLogger.service.js';
import { getLabsMobileCredentialsFromDB, resolveCredentials } from './labsmobileConfig.service.js';

// Phone number normalization for LabsMobile
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

  // For other formats, return as-is with +
  if (!limpio.startsWith('+')) {
    limpio = '+' + limpio;
  }

  return limpio;
};

/**
 * Send SMS via LabsMobile API
 * @param {string} toNumber - Recipient number (will be normalized)
 * @param {string} messageBody - Message content
 * @param {Object} metadata - Additional metadata for logging
 * @param {Object} credentials - Optional credentials (username, apiToken, sender)
 * @returns {Promise<{success: boolean, subid?: string, error?: Error}>}
 */
const sendViaSMS = async (toNumber, messageBody, metadata = {}, credentials = null) => {
  return new Promise(async (resolve) => {
    try {
      const numeroNormalizado = normalizarNumeroTelefonico(toNumber);
      if (!numeroNormalizado) {
        console.error('Invalid phone number:', toNumber);
        resolve({ success: false, error: 'Invalid phone number' });
        return;
      }

      // Obtener credenciales de BD
      const dbCredentials = await getLabsMobileCredentialsFromDB();

      // Resolver credenciales: parámetro → BD → variables de entorno
      const resolvedCreds = resolveCredentials(credentials, dbCredentials);

      const username = resolvedCreds?.username;
      const apiToken = resolvedCreds?.apiToken;
      const sender = resolvedCreds?.sender || 'DETAILER';

      if (!username || !apiToken) {
        console.error('❌ Missing LabsMobile credentials (no credentials in parameters, database, or environment)');
        resolve({ success: false, error: 'Missing LabsMobile credentials' });
        return;
      }

      // Prepare LabsMobile API request
      const data = JSON.stringify({
        message: messageBody,
        tpoa: sender,
        recipient: [
          {
            msisdn: numeroNormalizado
          }
        ]
      });

      const auth = Buffer.from(
        `${username}:${apiToken}`
      ).toString('base64');

      const options = {
        hostname: 'api.labsmobile.com',
        port: 443,
        path: '/json/send',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'Authorization': `Basic ${auth}`
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', async () => {
          try {
            const response = JSON.parse(responseData);

            if (response.code === '0') {
              // Success
              await logMessage({
                phoneNumber: numeroNormalizado,
                messageBody,
                status: 'success',
                twilioSid: response.subid, // Use subid from LabsMobile
                notificationType: metadata.type,
                userId: metadata.userId,
                orderId: metadata.orderId
              });

              console.log(`✓ SMS sent via LabsMobile to ${numeroNormalizado} (SubID: ${response.subid})`);
              resolve({ success: true, subid: response.subid });
            } else {
              // Error response
              const errorMsg = response.message || 'Unknown error';
              await logMessage({
                phoneNumber: numeroNormalizado,
                messageBody,
                status: 'failed',
                errorDetails: {
                  code: response.code,
                  message: errorMsg
                },
                notificationType: metadata.type,
                userId: metadata.userId,
                orderId: metadata.orderId
              });

              console.error(`✗ LabsMobile failed for ${numeroNormalizado}: [${response.code}] ${errorMsg}`);
              resolve({ success: false, error: errorMsg });
            }
          } catch (parseError) {
            console.error('Error parsing LabsMobile response:', parseError.message);
            await logMessage({
              phoneNumber: numeroNormalizado,
              messageBody,
              status: 'failed',
              errorDetails: {
                message: 'Failed to parse response',
                details: parseError.message
              },
              notificationType: metadata.type,
              userId: metadata.userId,
              orderId: metadata.orderId
            });
            resolve({ success: false, error: parseError });
          }
        });
      });

      req.on('error', async (error) => {
        console.error('✗ LabsMobile request failed:', error.message);
        await logMessage({
          phoneNumber: numeroNormalizado,
          messageBody,
          status: 'failed',
          errorDetails: {
            message: error.message,
            details: error.toString()
          },
          notificationType: metadata.type,
          userId: metadata.userId,
          orderId: metadata.orderId
        });
        resolve({ success: false, error });
      });

      req.write(data);
      req.end();
    } catch (error) {
      console.error('✗ SMS send error:', error.message);
      resolve({ success: false, error });
    }
  });
};

/**
 * Format notification message for order with detailed tracking
 */
const formatOrderNotification = (clientName, message, total, additionalInfo = '', placa = '') => {
  let fullMessage = `¡Hola ${clientName}! 👋\n`;
  fullMessage += `━━━━━━━━━━━━━━━━━━━\n`;

  if (placa) {
    fullMessage += `🚗 Placa: ${placa}\n`;
  }

  fullMessage += `${message}\n`;

  if (total) {
    fullMessage += `\n💰 Valor total: $${total.toLocaleString('es-CO')}\n`;
  }

  if (additionalInfo) {
    fullMessage += `\n${additionalInfo}`;
  }

  fullMessage += `\n━━━━━━━━━━━━━━━━━━━\n`;
  fullMessage += `📍 The Detailer\n`;
  fullMessage += `⏰ Horario: Lunes-Domingo 7am-6pm`;

  return fullMessage.trim();
};

// EXPORTED NOTIFICATION FUNCTIONS
export const enviarNotificacionInicioServicio = async (telefono, nombreCliente, total, placa = '', metadata = {}, credentials = null) => {
  const mensaje = formatOrderNotification(
    nombreCliente,
    '✅ Tu orden ha sido RECIBIDA\nEstatus: EN PROCESO',
    total,
    '⏳ Nos comunicaremos cuando esté lista.\n¡Gracias por confiar en nosotros! 🙏',
    placa
  );

  return sendViaSMS(telefono, mensaje, {
    type: 'orden_inicio',
    ...metadata
  }, credentials);
};

export const enviarNotificacionOrdenListaSinRifa = async (telefono, nombreCliente, total, placa = '', metadata = {}, credentials = null) => {
  const mensaje = formatOrderNotification(
    nombreCliente,
    '🎉 ¡Tu vehículo está LISTO!\nEstatus: DISPONIBLE PARA RECOGER',
    total,
    '📋 Descarga tu recibo adjunto\n🏪 Ven a recoger tu orden\n¡Gracias por tu preferencia! 👌',
    placa
  );

  return sendViaSMS(telefono, mensaje, {
    type: 'orden_lista_sin_rifa',
    ...metadata
  }, credentials);
};

export const enviarNotificacionOrdenListaConRifa = async (telefono, nombreCliente, total, numeroRifa, placa = '', metadata = {}, credentials = null) => {
  const mensaje = formatOrderNotification(
    nombreCliente,
    '¡Tu vehículo está listo!',
    total,
    `Tu número de rifa: ${numeroRifa}\n\nPor favor dirígete a recoger tu orden.\n¡Gracias por tu preferencia!`,
    placa
  );

  return sendViaSMS(telefono, mensaje, {
    type: 'orden_lista_con_rifa',
    ...metadata
  }, credentials);
};

export const enviarNotificacionOrdenTerminada = async (telefono, nombreCliente, total, placa = '', metadata = {}, credentials = null) => {
  const mensaje = formatOrderNotification(
    nombreCliente,
    '✨ ¡Tu orden ha sido FINALIZADA!\nEstatus: COMPLETADO Y LISTO',
    total,
    '📋 Descarga tu recibo\n🚗 Tu vehículo está perfecto\n¡Listo para llevarlo! 🎊\n\n💫 Pronto te esperaremos para seguir cuidando tu vehículo\n🧢 Recuerda recoger tu casco',
    placa
  );

  return sendViaSMS(telefono, mensaje, {
    type: 'orden_terminada',
    ...metadata
  }, credentials);
};

export const enviarNotificacionSimple = async (telefono, mensaje, metadata = {}, credentials = null) => {
  return sendViaSMS(telefono, mensaje, {
    type: 'notificacion_simple',
    ...metadata
  }, credentials);
};

export const enviarNotificacionModificacion = async (telefono, nombreCliente, detallesCambio, metadata = {}, credentials = null) => {
  const mensaje = `¡Hola ${nombreCliente}!\n\nTu orden ha sido modificada:\n\n${detallesCambio}\n\nSi tienes dudas, no dudes en contactarnos.`;

  return sendViaSMS(telefono, mensaje, {
    type: 'orden_modificacion',
    ...metadata
  }, credentials);
};

export const enviarReciboMostrador = async (telefono, nombreCliente, detallesRecibo, total, metadata = {}, credentials = null) => {
  const mensaje = `¡Hola ${nombreCliente}!\n\nGracias por tu compra.\n\n${detallesRecibo}\n\nTotal: $${total.toLocaleString('es-CO')}\n\n¡Esperamos verte pronto!`;

  return sendViaSMS(telefono, mensaje, {
    type: 'recibo_mostrador',
    ...metadata
  }, credentials);
};
