import { Router } from 'express';
import {
  enviarNotificacionInicioServicio,
  enviarNotificacionSimple,
  enviarReciboMostrador
} from '../services/whatsapp.service.js';

const router = Router();

// Endpoint de prueba para enviar mensaje de WhatsApp
router.post('/enviar-whatsapp', async (req, res) => {
  try {
    const { telefono, nombre = 'Cliente', placa = 'TEST', total = 0, tipo = 'simple' } = req.body;

    if (!telefono) {
      return res.status(400).json({ error: 'El teléfono es requerido' });
    }

    let resultado;

    if (tipo === 'inicio') {
      resultado = await enviarNotificacionInicioServicio(nombre, telefono, placa);
    } else if (tipo === 'recibo') {
      const productos = [{ cantidad: 1, nombre_producto: 'Servicio de Detallado' }];
      resultado = await enviarReciboMostrador(nombre, telefono, 'The Detailer', total, productos);
    } else {
      resultado = await enviarNotificacionSimple(nombre, telefono, placa, total);
    }

    if (resultado) {
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
        error: 'No se pudo enviar el mensaje'
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
