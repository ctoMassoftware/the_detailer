// Notificación: Orden lista SIN rifa (usa plantilla)
export const enviarNotificacionOrdenListaSinRifa = async (nombre, telefono, placa, totalPagar) => {
    let numeroDestino = telefono.replace(/\D/g, '');
    if (!numeroDestino.startsWith('57')) {
        numeroDestino = '57' + numeroDestino;
    }

    const safeNombre = (nombre || 'Cliente').trim();
    const safePlaca = (placa || 'N/A').trim();
    const safeTotal = totalPagar != null ? String(totalPagar) : '0';

    // Log para verificar exactamente qué se envía
    console.log('📤 Enviando orden lista sin rifa:', { safeNombre, safePlaca, safeTotal });
    console.log('📋 contentVariables string:', JSON.stringify({ '1': safeNombre, '2': safePlaca, '3': safeTotal }));

    try {
        const response = await client.messages.create({
            from: fromNumber,
            to: `whatsapp:+${numeroDestino}`,
            contentSid: 'HX42d11753ef517ec4fabd1b30db4bcabd',
            contentVariables: JSON.stringify({
                '1': safeNombre,
                '2': safePlaca,
                '3': safeTotal
            })
        });
        console.log('✅ Mensaje enviado:', response.sid);
        return true;
    } catch (error) {
        console.error('❌ Error completo:', JSON.stringify({
            message: error?.message,
            code: error?.code,
            status: error?.status,
            details: error?.details,
            moreInfo: error?.moreInfo
        }));

        // Fallback con body de texto plano (siempre funciona en WhatsApp aprobado)
        try {
            const response2 = await client.messages.create({
                from: fromNumber,
                to: `whatsapp:+${numeroDestino}`,
                body: `👋 Hola ${safeNombre},\n\n🚗 Tu vehículo con placa ${safePlaca} está listo para recoger.\n\n💰 Total a pagar: $${safeTotal}\n\n¡Gracias por confiar en nosotros! 🙌`
            });
            console.log('✅ Fallback enviado:', response2.sid);
            return true;
        } catch (error2) {
            console.error('❌ Error en fallback:', error2?.message);
            return false;
        }
    }
};

// Notificación: Orden lista CON rifa (usa plantilla)
export const enviarNotificacionOrdenListaConRifa = async (nombre, telefono, placa, totalPagar, numeroBoleta) => {
    let numeroDestino = telefono.replace(/\D/g, '');
    if (!numeroDestino.startsWith('57')) {
        numeroDestino = '57' + numeroDestino;
    }
    try {
        // Intenta con contentSid/contentVariables (API nueva)
        const response = await client.messages.create({
            from: fromNumber,
            to: `whatsapp:+${numeroDestino}`,
            contentSid: 'HXc8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8', // REEMPLAZA por el SID real de la plantilla "orden_lista_con_rifa"
            contentVariables: JSON.stringify({
                '1': nombre,
                '2': placa,
                '3': totalPagar,
                '4': numeroBoleta
            })
        });
        console.log('Mensaje de WhatsApp (orden lista con rifa, contentSid) enviado:', response.sid);
        return true;
    } catch (error) {
        console.error('Error enviando WhatsApp (orden lista con rifa, contentSid):', error?.message || error, error);
        // Si falla, intenta con template (API clásica)
        try {
            const response2 = await client.messages.create({
                from: fromNumber,
                to: `whatsapp:+${numeroDestino}`,
                template: {
                    name: 'orden_lista_con_rifa', // nombre exacto de la plantilla
                    languageCode: 'es',
                    components: [
                        {
                            type: 'body',
                            parameters: [
                                { type: 'text', text: nombre },
                                { type: 'text', text: placa },
                                { type: 'text', text: totalPagar },
                                { type: 'text', text: numeroBoleta }
                            ]
                        }
                    ]
                }
            });
            console.log('Mensaje de WhatsApp (orden lista con rifa, template) enviado:', response2.sid);
            return true;
        } catch (error2) {
            console.error('Error enviando WhatsApp (orden lista con rifa, template):', error2?.message || error2, error2);
            return false;
        }
    }
};
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