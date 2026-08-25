import { Router } from 'express';
import https from 'https';

const router = Router();

/**
 * Normalizar número telefónico a formato +57XXXXXXXXXX
 */
const normalizarNumeroTelefonico = (numero) => {
  if (!numero) return null;

  let limpio = numero.replace(/[\s\-()]/g, '');

  if (limpio.startsWith('3') && !limpio.startsWith('+')) {
    limpio = '+57' + limpio;
  }

  if (limpio.startsWith('+573')) {
    return limpio;
  }

  if (limpio.startsWith('573')) {
    return '+' + limpio;
  }

  if (!limpio.startsWith('+')) {
    limpio = '+' + limpio;
  }

  return limpio;
};

/**
 * Enviar SMS con credenciales dinámicas
 * POST /api/sms/enviar
 * Body:
 * {
 *   "credentials": {
 *     "username": "email@example.com",
 *     "apiToken": "token_aqui",
 *     "sender": "DETAILER"
 *   },
 *   "mensaje": "Mensaje a enviar",
 *   "telefonos": ["3117899331"] o "3117899331"
 * }
 */
router.post('/enviar', async (req, res) => {
  try {
    const { credentials, mensaje, telefonos } = req.body;

    // Validar credenciales
    if (!credentials || !credentials.username || !credentials.apiToken) {
      return res.status(400).json({
        error: 'Credenciales de LabsMobile requeridas',
        required: ['credentials.username', 'credentials.apiToken', 'credentials.sender']
      });
    }

    // Validar mensaje
    if (!mensaje || typeof mensaje !== 'string' || mensaje.trim() === '') {
      return res.status(400).json({
        error: 'Mensaje requerido y debe ser texto'
      });
    }

    // Validar teléfonos
    if (!telefonos) {
      return res.status(400).json({
        error: 'Teléfonos requeridos (string o array)'
      });
    }

    // Convertir a array si es string
    let numeros = Array.isArray(telefonos) ? telefonos : [telefonos];

    // Validar que haya al menos un número
    if (numeros.length === 0) {
      return res.status(400).json({
        error: 'Se requiere al menos un número telefónico'
      });
    }

    // Normalizar números
    numeros = numeros
      .map(num => normalizarNumeroTelefonico(num))
      .filter(num => num !== null);

    if (numeros.length === 0) {
      return res.status(400).json({
        error: 'No se pudieron normalizar los números telefónicos'
      });
    }

    // Enviar a cada número
    const resultados = [];

    for (const numero of numeros) {
      const resultado = await enviarSMSLabsMobile(
        numero,
        mensaje,
        credentials
      );
      resultados.push({
        numero,
        ...resultado
      });
    }

    res.json({
      success: true,
      total: resultados.length,
      exitosos: resultados.filter(r => r.success).length,
      fallidos: resultados.filter(r => !r.success).length,
      resultados
    });

  } catch (error) {
    console.error('Error en endpoint SMS:', error);
    res.status(500).json({
      error: 'Error procesando solicitud',
      message: error.message
    });
  }
});

/**
 * Función auxiliar para enviar SMS a LabsMobile
 */
const enviarSMSLabsMobile = (numeroTelefonico, mensaje, credentials) => {
  return new Promise((resolve) => {
    try {
      const data = JSON.stringify({
        message: mensaje,
        tpoa: credentials.sender || 'DETAILER',
        recipient: [
          {
            msisdn: numeroTelefonico
          }
        ]
      });

      const auth = Buffer.from(
        `${credentials.username}:${credentials.apiToken}`
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

        res.on('end', () => {
          try {
            const response = JSON.parse(responseData);

            if (response.code === '0') {
              console.log(`✓ SMS enviado a ${numeroTelefonico} (SubID: ${response.subid})`);
              resolve({
                success: true,
                subid: response.subid,
                message: 'SMS enviado exitosamente'
              });
            } else {
              console.error(`✗ Error enviando a ${numeroTelefonico}: [${response.code}] ${response.message}`);
              resolve({
                success: false,
                code: response.code,
                error: response.message
              });
            }
          } catch (parseError) {
            console.error('Error parseando respuesta:', parseError);
            resolve({
              success: false,
              error: 'Error parseando respuesta de LabsMobile'
            });
          }
        });
      });

      req.on('error', (error) => {
        console.error('Error en solicitud HTTPS:', error);
        resolve({
          success: false,
          error: error.message
        });
      });

      req.write(data);
      req.end();
    } catch (error) {
      console.error('Error en envío:', error);
      resolve({
        success: false,
        error: error.message
      });
    }
  });
};

export default router;
