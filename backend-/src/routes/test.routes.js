import { Router } from 'express';
import {
  enviarNotificacionInicioServicio,
  enviarNotificacionSimple,
  enviarReciboMostrador,
  getCurrentChannel
} from '../services/notificationRouter.service.js';

const router = Router();

// Endpoint de prueba para enviar notificaciones (SMS/WhatsApp por defecto)
router.post('/enviar-notificacion', async (req, res) => {
  try {
    const {
      telefono,
      nombre = 'Cliente',
      total = 0,
      tipo = 'simple'
    } = req.body;

    if (!telefono) {
      return res.status(400).json({ error: 'El teléfono es requerido' });
    }

    let resultado;

    if (tipo === 'inicio') {
      resultado = await enviarNotificacionInicioServicio(nombre, telefono, total);
    } else if (tipo === 'recibo') {
      resultado = await enviarReciboMostrador(
        nombre,
        telefono,
        'Servicio de Detallado',
        total
      );
    } else {
      resultado = await enviarNotificacionSimple(telefono, 'Mensaje de prueba');
    }

    if (resultado?.success) {
      res.json({
        success: true,
        mensaje: 'Notificación enviada exitosamente',
        tipo,
        canal: getCurrentChannel(),
        telefono,
        nombre
      });
    } else {
      res.status(500).json({
        success: false,
        error: resultado?.error || 'No se pudo enviar la notificación'
      });
    }
  } catch (error) {
    console.error('Error al enviar notificación:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Endpoint para verificar el canal activo
router.get('/notificacion-canal', (req, res) => {
  res.json({
    canal_activo: getCurrentChannel(),
    opciones_disponibles: ['sms', 'whatsapp'],
    sms_descripcion: 'LabsMobile SMS',
    whatsapp_descripcion: 'Twilio WhatsApp'
  });
});

export default router;
