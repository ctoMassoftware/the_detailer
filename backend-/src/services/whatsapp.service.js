import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

const client = twilio(accountSid, authToken);

// 1. Notificación Inicio Servicio
export const enviarNotificacionInicioServicio = async (nombre, telefono, placa) => {
    let numeroDestino = telefono.replace(/\D/g, '');
    if (!numeroDestino.startsWith('57')) {
        numeroDestino = '57' + numeroDestino;
    }
    try {
        // 1. Intentar con contentSid/contentVariables (API nueva)
        const response = await client.messages.create({
            from: fromNumber,
            to: `whatsapp:+${numeroDestino}`,
            contentSid: 'HXc139efa91ee8a99b680683115fe01c47',
            contentVariables: JSON.stringify({
                '1': nombre,
                '2': placa
            })
        });
        console.log('Mensaje de WhatsApp (inicio, plantilla, contentSid) enviado:', response.sid);
        return true;
    } catch (error) {
        console.error('Error enviando WhatsApp (inicio, contentSid):', error?.message || error, error);
        // 2. Si falla, intentar con template (API clásica)
        try {
            const response2 = await client.messages.create({
                from: fromNumber,
                to: `whatsapp:+${numeroDestino}`,
                template: {
                    name: 'recepcion_orden',
                    languageCode: 'es',
                    components: [
                        {
                            type: 'body',
                            parameters: [
                                { type: 'text', text: nombre },
                                { type: 'text', text: placa }
                            ]
                        }
                    ]
                }
            });
            console.log('Mensaje de WhatsApp (inicio, plantilla, template) enviado:', response2.sid);
            return true;
        } catch (error2) {
            console.error('Error enviando WhatsApp (inicio, template):', error2?.message || error2, error2);
            return false;
        }
    }
};

// 2. Notificación cuando hay boleta de rifa
export const enviarNotificacionOrdenTerminada = async (nombre, telefono, placa, numeroBoleta, totalPagar) => {
    try {
        let numeroDestino = telefono.replace(/\D/g, '');
        if (!numeroDestino.startsWith('57')) {
            numeroDestino = '57' + numeroDestino;
        }

        const mensaje = `
👋 Hola *${nombre}*, 

🚗 Tu vehículo con placa *${placa}* está listo.

💰 *Resumen del servicio:*
Total a pagar: $${totalPagar}

🎟️ *¡The Detailer!*
Como agradecimiento, participas en nuestra rifa con el número de boleta:
👉 *${numeroBoleta}*

¡Gracias por confiar en nosotros! 
`;

        const response = await client.messages.create({
            body: mensaje,
            from: fromNumber,
            to: `whatsapp:+${numeroDestino}`
        });

        console.log('Mensaje de WhatsApp enviado:', response.sid);
        return true;
    } catch (error) {
        console.error('Error enviando WhatsApp:', error);
        return false;
    }
};

// 3. Notificación simple sin rifa
export const enviarNotificacionSimple = async (nombre, telefono, placa, totalPagar) => {
    try {
        let numeroDestino = telefono.replace(/\D/g, '');
        if (!numeroDestino.startsWith('57')) {
            numeroDestino = '57' + numeroDestino;
        }

        const mensaje = `
👋 Hola *${nombre}*, 

🚗 Tu vehículo con placa *${placa}* está listo para recoger.

💰 *Resumen del servicio:*
Total a pagar: $${totalPagar}

¡Gracias por confiar en nosotros! 🙌
`;

        const response = await client.messages.create({
            body: mensaje,
            from: fromNumber,
            to: `whatsapp:+${numeroDestino}`
        });

        console.log('Mensaje de WhatsApp (simple) enviado:', response.sid);
        return true;
    } catch (error) {
        console.error('Error enviando WhatsApp:', error);
        return false;
    }
};

// 4. Notificación de modificación de orden
export const enviarNotificacionModificacion = async (nombre, telefono, placa, totalPagar) => {
    try {
        let numeroDestino = telefono.replace(/\D/g, '');
        if (!numeroDestino.startsWith('57')) {
            numeroDestino = '57' + numeroDestino;
        }

        const mensaje = `
👋 Hola *${nombre}*, 

📝 Tu orden ha sido *actualizada*.

🚗 Vehículo: Placa *${placa}*

💰 *Nuevo total:* $${totalPagar}

Si tienes alguna pregunta, contáctanos. ¡Gracias! 🙌
`;

        const response = await client.messages.create({
            body: mensaje,
            from: fromNumber,
            to: `whatsapp:+${numeroDestino}`
        });

        console.log('Mensaje de WhatsApp (modificación) enviado:', response.sid);
        return true;
    } catch (error) {
        console.error('Error enviando WhatsApp:', error);
        return false;
    }
};

// 5. NUEVO: Notificación Venta de Mostrador
export const enviarReciboMostrador = async (nombre, telefono, sede, totalPagar, productos) => {
    try {
        let numeroDestino = telefono.replace(/\D/g, '');
        if (!numeroDestino.startsWith('57')) {
            numeroDestino = '57' + numeroDestino;
        }

        let listaProductos = productos.map(p => `- ${p.cantidad}x ${p.nombre_producto}`).join('\n');

        const mensaje = `
🛍️ *Venta Confirmada* - The Detailer
📍 Sede: *${sede}*

Hola *${nombre || 'Cliente'}*, gracias por tu compra en mostrador.

🛒 *Detalle:*
${listaProductos}

💰 *Total Pagado:* $${totalPagar}

¡Vuelve pronto! 🙌
`;

        const response = await client.messages.create({
            body: mensaje,
            from: fromNumber,
            to: `whatsapp:+${numeroDestino}`
        });

        console.log(`Recibo mostrador enviado a ${telefono} (Sede: ${sede}) - SID: ${response.sid}`);
        return true;
    } catch (error) {
        console.error('Error enviando WhatsApp (Mostrador):', error);
        return false;
    }
};