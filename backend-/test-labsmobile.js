import https from 'https';

// Credenciales de LabsMobile
const LABSMOBILE_USERNAME = 'cto@massoftware.co';
const LABSMOBILE_API_TOKEN = 'fbmU0QMy227xlc1VDGop6jbcbOkG70Yb';
const LABSMOBILE_SENDER = 'The Detailer';

// Número a probar
const phoneNumber = '+573108030240';
const message = `¡Hola! 👋
━━━━━━━━━━━━━━━━━━━
🎉 ¡Tu vehículo está LISTO!
Estatus: DISPONIBLE PARA RECOGER

💰 Valor total: $25,000

📋 Descarga tu recibo adjunto
🏪 Ven a recoger tu orden
¡Gracias por tu preferencia! 👌
━━━━━━━━━━━━━━━━━━━
📍 The Detailer
⏰ Horario: Lunes-Viernes 8am-6pm`;

console.log('📱 Iniciando prueba de LabsMobile...\n');
console.log(`Username: ${LABSMOBILE_USERNAME}`);
console.log(`Token: ${LABSMOBILE_API_TOKEN.substring(0, 10)}...`);
console.log(`Sender: ${LABSMOBILE_SENDER}`);
console.log(`Destino: ${phoneNumber}\n`);

const data = JSON.stringify({
  message: message,
  tpoa: LABSMOBILE_SENDER,
  recipient: [
    {
      msisdn: phoneNumber
    }
  ]
});

const auth = Buffer.from(
  `${LABSMOBILE_USERNAME}:${LABSMOBILE_API_TOKEN}`
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

console.log('🔄 Enviando solicitud a LabsMobile...\n');

const req = https.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log('📬 Respuesta de LabsMobile:\n');
    try {
      const response = JSON.parse(responseData);
      console.log(JSON.stringify(response, null, 2));

      if (response.code === '0') {
        console.log('\n✅ SMS ENVIADO EXITOSAMENTE');
        console.log(`SubID: ${response.subid}`);
      } else {
        console.log(`\n❌ ERROR: [${response.code}] ${response.message}`);
      }
    } catch (e) {
      console.log('Raw response:');
      console.log(responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('\n❌ Error en la solicitud:');
  console.error(error.message);
});

req.write(data);
req.end();
