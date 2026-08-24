import { Router } from 'express';
import {
  enviarNotificacionInicioServicio,
  enviarNotificacionSimple,
  enviarReciboMostrador
} from '../services/notificaciones.service.js';

const router = Router();

// Endpoint de prueba para enviar notificaciones (SMS/WhatsApp)
router.post('/enviar-notificacion', async (req, res) => {
  try {
    const {
      telefono,
      nombre = 'Cliente',
      total = 0,
      tipo = 'simple',
      canal = 'sms'
    } = req.body;

    if (!telefono) {
      return res.status(400).json({ error: 'El teléfono es requerido' });
    }

    let resultado;
    const metadata = { canal };

    if (tipo === 'inicio') {
      resultado = await enviarNotificacionInicioServicio(nombre, telefono, total, metadata);
    } else if (tipo === 'recibo') {
      resultado = await enviarReciboMostrador(
        nombre,
        telefono,
        'Servicio de Detallado',
        total,
        metadata
      );
    } else {
      resultado = await enviarNotificacionSimple(telefono, 'Mensaje de prueba', metadata);
    }

    if (resultado?.success) {
      res.json({
        success: true,
        mensaje: 'Notificación enviada exitosamente',
        tipo,
        canal,
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

// Legacy endpoint para compatibilidad
router.post('/enviar-whatsapp', async (req, res) => {
  try {
    const { telefono, nombre = 'Cliente', total = 0, tipo = 'simple' } = req.body;

    if (!telefono) {
      return res.status(400).json({ error: 'El teléfono es requerido' });
    }

    let resultado;

    if (tipo === 'inicio') {
      resultado = await enviarNotificacionInicioServicio(nombre, telefono, total, { canal: 'whatsapp' });
    } else if (tipo === 'recibo') {
      resultado = await enviarReciboMostrador(
        nombre,
        telefono,
        'Servicio de Detallado',
        total,
        { canal: 'whatsapp' }
      );
    } else {
      resultado = await enviarNotificacionSimple(telefono, 'Mensaje de prueba', { canal: 'whatsapp' });
    }

    if (resultado?.success) {
      res.json({
        success: true,
        mensaje: 'Mensaje enviado exitosamente',
        tipo,
        telefono,
        nombre
      });
    } else {
      res.status(500).json({
        success: false,
        error: resultado?.error || 'No se pudo enviar el mensaje'
      });
    }
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

export default router;
