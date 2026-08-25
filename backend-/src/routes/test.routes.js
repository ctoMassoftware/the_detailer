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

// Endpoint para verificar el canal activo y configuración
router.get('/notificacion-canal', (req, res) => {
  const canalActual = getCurrentChannel();
  const esLabsMobile = canalActual === 'sms';

  res.json({
    canal_activo: canalActual,
    es_labsmobile_activo: esLabsMobile,
    opciones_disponibles: ['sms', 'whatsapp'],
    sms_descripcion: 'LabsMobile SMS',
    whatsapp_descripcion: 'Twilio WhatsApp',
    config_labsmobile: {
      username: process.env.LABSMOBILE_USERNAME ? '✓ Configurado' : '✗ Falta',
      api_token: process.env.LABSMOBILE_API_TOKEN ? '✓ Configurado' : '✗ Falta',
      sender: process.env.LABSMOBILE_SENDER || 'DETAILER',
      host: 'api.labsmobile.com'
    },
    config_twilio: {
      account_sid: process.env.TWILIO_ACCOUNT_SID ? '✓ Configurado' : '✗ Falta',
      auth_token: process.env.TWILIO_AUTH_TOKEN ? '✓ Configurado' : '✗ Falta',
      whatsapp_number: process.env.TWILIO_WHATSAPP_NUMBER || 'No configurado'
    }
  });
});

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    canal_notificaciones: getCurrentChannel()
  });
});

// Endpoint para prueba SMS específicamente
router.post('/test-sms', async (req, res) => {
  const canalActual = getCurrentChannel();

  if (canalActual !== 'sms') {
    return res.status(400).json({
      error: `Canal activo es '${canalActual}', no SMS. Cambia NOTIFICATION_CHANNEL=sms en Railway Variables.`,
      canal_actual: canalActual,
      esperado: 'sms'
    });
  }

  try {
    const { telefono = '+573151611975', mensaje = 'Prueba de SMS desde LabsMobile' } = req.body;

    const resultado = await enviarNotificacionSimple(telefono, mensaje, {
      tipo: 'test_sms',
      timestamp: new Date().toISOString()
    });

    if (resultado?.success) {
      res.json({
        success: true,
        mensaje: 'SMS enviado correctamente vía LabsMobile',
        detalles: {
          telefono,
          canal: 'SMS (LabsMobile)',
          subid: resultado.subid,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: resultado?.error || 'Error desconocido al enviar SMS',
        detalles: {
          telefono,
          canal: 'SMS (LabsMobile)'
        }
      });
    }
  } catch (error) {
    console.error('Error en test-sms:', error);
    res.status(500).json({
      error: error.message,
      tipo: 'exception'
    });
  }
});

// Endpoint para verificar que LabsMobile está bien configurado
router.get('/verificar-labsmobile', (req, res) => {
  const checks = {
    username: !!process.env.LABSMOBILE_USERNAME,
    api_token: !!process.env.LABSMOBILE_API_TOKEN,
    sender: !!process.env.LABSMOBILE_SENDER,
    notification_channel_sms: process.env.NOTIFICATION_CHANNEL === 'sms'
  };

  const todoConfigurable = Object.values(checks).every(v => v);

  res.json({
    labsmobile_configurado: todoConfigurable,
    checks,
    detalles: {
      username: checks.username ? process.env.LABSMOBILE_USERNAME : 'NO CONFIGURADO',
      sender: process.env.LABSMOBILE_SENDER || 'DETAILER (default)',
      canal: process.env.NOTIFICATION_CHANNEL || 'NO CONFIGURADO',
      api_token_longitud: process.env.LABSMOBILE_API_TOKEN?.length || 0,
      recomendacion: !todoConfigurable ? 'Agregar variables faltantes a Railway' : 'Todo configurado ✓'
    }
  });
});

export default router;
