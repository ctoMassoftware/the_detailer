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

      // Validar longitud del mensaje
      if (messageBody.length > 160) {
        console.warn(`⚠️ SMS EXCEDE 160 CARACTERES: ${messageBody.length} chars - se enviará en ${Math.ceil(messageBody.length / 160)} mensajes`);
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
                twilioSid: response.subid,
                notificationType: metadata.type,
                userId: metadata.userId,
                orderId: metadata.orderId
              });

              console.log(`✓ SMS enviado a ${numeroNormalizado} (${messageBody.length} chars)`);
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

              console.error(`✗ LabsMobile error for ${numeroNormalizado}: [${response.code}] ${errorMsg}`);
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

// EXPORTED NOTIFICATION FUNCTIONS - ALL OPTIMIZED FOR 160 CHARS MAX

export const enviarNotificacionInicioServicio = async (telefono, nombreCliente, total, placa = '', numeroOrden = '', metadata = {}, credentials = null) => {
  // COMPACTO: 160 chars max (1 SMS)
  const mensaje = `Orden #${numeroOrden} recibida ✅\n${placa} | Total: $${Number(total || 0).toLocaleString('es-CO')}\n⏳ Te contactaremos cuando esté lista.\nThe Detailer`;

  console.log(`📊 SMS Inicio - ${mensaje.length} chars (máx: 160)`);

  return sendViaSMS(telefono, mensaje, {
    type: 'orden_inicio',
    ...metadata
  }, credentials);
};

export const enviarNotificacionOrdenListaSinRifa = async (telefono, nombreCliente, total, placa = '', numeroOrden = '', metadata = {}, credentials = null) => {
  // COMPACTO: 160 chars max (1 SMS)
  const mensaje = `¡LISTA! Orden #${numeroOrden}\n${placa} | $${Number(total || 0).toLocaleString('es-CO')}\nVer: the-detailer.co/recibos?placa=${placa}`;

  console.log(`📊 SMS Lista - ${mensaje.length} chars (máx: 160)`);

  return sendViaSMS(telefono, mensaje, {
    type: 'orden_lista_sin_rifa',
    ...metadata
  }, credentials);
};

export const enviarNotificacionOrdenListaConRifa = async (telefono, nombreCliente, total, numeroRifa, placa = '', numeroOrden = '', metadata = {}, credentials = null) => {
  // COMPACTO: 160 chars max (1 SMS)
  const mensaje = `¡LISTA! Orden #${numeroOrden}\n${placa} | Rifa: ${numeroRifa}\nVer: the-detailer.co/recibos?placa=${placa}`;

  console.log(`📊 SMS Lista+Rifa - ${mensaje.length} chars (máx: 160)`);

  return sendViaSMS(telefono, mensaje, {
    type: 'orden_lista_con_rifa',
    ...metadata
  }, credentials);
};

export const enviarNotificacionOrdenTerminada = async (telefono, nombreCliente, total, placa = '', tipoVehiculo = '', cantidadCascos = 0, numeroOrden = '', tokenRecibo = '', metadata = {}, credentials = null) => {
  // COMPACTO: 160 chars max (1 SMS)
  let mensaje = `¡COMPLETADA! Orden #${numeroOrden}\n${placa} | $${Number(total || 0).toLocaleString('es-CO')}\nVer: the-detailer.co/recibos?placa=${placa}`;

  // Solo agregar cascos si es moto (y cabe en 160)
  const esMoto = tipoVehiculo && String(tipoVehiculo).toUpperCase().includes('MOTO');
  if (esMoto && cantidadCascos > 0 && mensaje.length < 140) {
    mensaje += `\n🧢 Recoger ${cantidadCascos} casco(s)`;
  }

  console.log(`📊 SMS Terminada - ${mensaje.length} chars (máx: 160)`);

  return sendViaSMS(telefono, mensaje, {
    type: 'orden_terminada',
    ...metadata
  }, credentials);
};

export const enviarNotificacionSimple = async (telefono, mensaje, metadata = {}, credentials = null) => {
  console.log(`📊 SMS Simple - ${mensaje.length} chars (máx: 160)`);

  return sendViaSMS(telefono, mensaje, {
    type: 'notificacion_simple',
    ...metadata
  }, credentials);
};

export const enviarNotificacionModificacion = async (telefono, nombreCliente, detallesCambio, metadata = {}, credentials = null) => {
  // COMPACTO: 160 chars max (1 SMS)
  const mensaje = `Orden modificada 🔄\n${detallesCambio}\nGracias, The Detailer`;

  console.log(`📊 SMS Modificación - ${mensaje.length} chars (máx: 160)`);

  return sendViaSMS(telefono, mensaje, {
    type: 'orden_modificacion',
    ...metadata
  }, credentials);
};

export const enviarReciboMostrador = async (telefono, nombreCliente, detallesRecibo, total, metadata = {}, credentials = null) => {
  // COMPACTO: 160 chars max (1 SMS)
  const mensaje = `Recibo Mostrador\n${detallesRecibo}\nTotal: $${Number(total || 0).toLocaleString('es-CO')}`;

  console.log(`📊 SMS Recibo - ${mensaje.length} chars (máx: 160)`);

  return sendViaSMS(telefono, mensaje, {
    type: 'recibo_mostrador',
    ...metadata
  }, credentials);
};
