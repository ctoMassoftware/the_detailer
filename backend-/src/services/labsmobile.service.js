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
 * ✅ CRITICAL: Validar que SMS sea ≤160 caracteres
 * @param {string} mensaje - Contenido del SMS
 * @returns {Object} {valid: boolean, charCount: number, error?: string}
 */
export const validarSMS = (mensaje) => {
  const MAX_CHARS = 160;
  const charCount = mensaje ? mensaje.length : 0;

  if (!mensaje) {
    return {
      valid: false,
      charCount: 0,
      error: 'Mensaje vacío'
    };
  }

  if (charCount > MAX_CHARS) {
    return {
      valid: false,
      charCount,
      error: `SMS muy largo: ${charCount} caracteres (máx: ${MAX_CHARS})`
    };
  }

  return {
    valid: true,
    charCount,
    error: null
  };
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

      // ✅ CRITICAL: Validar que SMS sea ≤160 caracteres
      const validacion = validarSMS(messageBody);
      if (!validacion.valid) {
        console.error(`❌ ${validacion.error}`);
        resolve({ success: false, error: validacion.error });
        return;
      }
      console.log(`✅ SMS válido: ${validacion.charCount} caracteres (máx: 160)`);

      // Obtener credenciales de BD
      const dbCredentials = await getLabsMobileCredentialsFromDB();

      // Resolver credenciales: parámetro → BD → variables de entorno
      const resolvedCreds = resolveCredentials(credentials, dbCredentials);

      // Logging
      console.log(`📱 SMS a ${numeroNormalizado}: ${messageBody.substring(0, 50)}...`);

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
  // COMPACTO: 160 chars max - SIN TOTAL, SIN LINK
  const mensaje = `¡Hola ${nombreCliente}! 👋\nRecibimos tu orden #${numeroOrden}\n${placa}\n⏳ Te notificaremos cuando esté lista.\nThe Detailer`;

  console.log(`📊 SMS Inicio - ${mensaje.length} chars (máx: 160) - SIN TOTAL/LINK`);

  return sendViaSMS(telefono, mensaje, {
    type: 'orden_inicio',
    ...metadata
  }, credentials);
};

export const enviarNotificacionOrdenListaSinRifa = async (telefono, nombreCliente, total, placa = '', numeroOrden = '', metadata = {}, credentials = null) => {
  // COMPACTO: 160 chars max - CON TOTAL, SIN LINK (link solo en Terminada)
  const mensaje = `¡Tu orden #${numeroOrden} está LISTA! 🎉\n${placa}\n💰 Total: $${Number(total || 0).toLocaleString('es-CO')}\n\nVen a recogerla. The Detailer`;

  console.log(`📊 SMS Lista - ${mensaje.length} chars (máx: 160) - CON TOTAL, SIN LINK`);

  return sendViaSMS(telefono, mensaje, {
    type: 'orden_lista_sin_rifa',
    ...metadata
  }, credentials);
};

export const enviarNotificacionOrdenListaConRifa = async (telefono, nombreCliente, total, numeroRifa, placa = '', numeroOrden = '', metadata = {}, credentials = null) => {
  // COMPACTO: 160 chars max - CON TOTAL Y RIFA, SIN LINK
  const mensaje = `¡Tu orden #${numeroOrden} está LISTA! 🎉\n${placa} | Rifa: ${numeroRifa}\n💰 Total: $${Number(total || 0).toLocaleString('es-CO')}`;

  console.log(`📊 SMS Lista+Rifa - ${mensaje.length} chars (máx: 160) - CON TOTAL/RIFA, SIN LINK`);

  return sendViaSMS(telefono, mensaje, {
    type: 'orden_lista_con_rifa',
    ...metadata
  }, credentials);
};

export const enviarNotificacionOrdenTerminada = async (telefono, nombreCliente, total, placa = '', tipoVehiculo = '', cantidadCascos = 0, numeroOrden = '', tokenRecibo = '', metadata = {}, credentials = null) => {
  // 🔧 SIN LINK: Los operadores Colombianos (Claro, Movistar) bloquean SMS con URLs
  // El recibo ya se envió en SMS #2 (orden LISTA) con acceso a descargar
  // Este SMS #3 es solo confirmación de entrega

  let mensaje = `¡Orden #${numeroOrden} completada! ✅\nGracias por confiar en The Detailer`;

  // Solo agregar cascos si es moto Y hay espacio (máx 160)
  const esMoto = tipoVehiculo && String(tipoVehiculo).toUpperCase().includes('MOTO');
  if (esMoto && cantidadCascos > 0 && mensaje.length <= 140) {
    mensaje += `\n🧢 Recoger ${cantidadCascos} casco(s)`;
  }

  console.log(`📊 SMS Terminada - ${mensaje.length} chars (máx: 160) - SIN LINK (operadores bloquean URLs)`);

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
  const totalFormato = Number(total || 0).toLocaleString('es-CO');
  const numeroRecibo = metadata.idVenta ? `#${metadata.idVenta}` : '';
  let mensaje = `Recibo ${numeroRecibo}: ${detallesRecibo}\nTotal: $${totalFormato}`;

  // ✅ Si tenemos token, incluir link en el SMS
  if (metadata.tokenRecibo) {
    const baseUrl = process.env.BASE_URL || 'https://the-detailer.co';
    const linkRecibo = `${baseUrl}/recibos?token=${metadata.tokenRecibo}`;
    const mensajeConLink = `${mensaje}\nVer: ${linkRecibo}`;

    // Si el mensaje con link supera 160, usar versión compacta
    if (mensajeConLink.length <= 160) {
      mensaje = mensajeConLink;
    } else {
      // Versión ultra-compacta sin detalles de productos
      const totalAbrev = Math.round(total / 1000) + 'K';
      mensaje = `Recibo ${numeroRecibo}: $${totalAbrev}\n${linkRecibo}`;

      // Si aún es muy largo, versión mínima
      if (mensaje.length > 160) {
        mensaje = `Recibo ${numeroRecibo}\n$${totalFormato}\n${linkRecibo}`;
      }

      // Último recurso: solo recibo y link
      if (mensaje.length > 160) {
        mensaje = `Recibo ${numeroRecibo}: ${linkRecibo}`;
      }
    }
  } else {
    // Sin token: versión sin link
    if (mensaje.length > 160) {
      const totalAbrev = Math.round(total / 1000) + 'K';
      mensaje = `Recibo ${numeroRecibo}: $${totalAbrev}`;
    }
  }

  console.log(`📊 SMS Recibo - ${mensaje.length} chars (máx: 160) - ${metadata.tokenRecibo ? 'CON LINK' : 'SIN LINK'} - Validado ✅`);

  const validacion = validarSMS(mensaje);
  if (!validacion.valid) {
    console.error(`❌ ${validacion.error}`);
    return { success: false, error: validacion.error };
  }

  return sendViaSMS(telefono, mensaje, {
    type: 'recibo_mostrador',
    ...metadata
  }, credentials);
};
