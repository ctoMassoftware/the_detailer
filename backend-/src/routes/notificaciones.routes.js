import { Router } from 'express';
import { enviarNotificacionPorCambioEstado } from '../services/orderStatusNotification.service.js';
import { pool } from '../config/db.js';

const router = Router();

/**
 * Enviar SMS manual para una orden específica
 * Útil para reenviar notificaciones si algo falló
 */
router.post('/reenviar-sms/:idOrden', async (req, res) => {
  try {
    const { idOrden } = req.params;
    const { tipoNotificacion } = req.body;

    // Obtener datos de la orden
    const result = await pool.query(
      `SELECT nombre_cliente, telefono_cliente, placa_vehiculo,
              COALESCE(SUM(d.cantidad * d.precio_servicio_aplicado), 0) as total
       FROM public.orden o
       LEFT JOIN public.detalle_orden_venta d ON o.id_orden = d.id_orden
       WHERE o.id_orden = $1
       GROUP BY o.id_orden, o.nombre_cliente, o.telefono_cliente, o.placa_vehiculo`,
      [idOrden]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    const orden = result.rows[0];

    // Disparar notificación según tipo
    let resultado;
    switch (tipoNotificacion) {
      case 'inicio':
        const { enviarNotificacionInicioServicio } = await import('../services/notificationRouter.service.js');
        resultado = await enviarNotificacionInicioServicio(
          orden.nombre_cliente,
          orden.telefono_cliente,
          orden.total,
          { orderId: idOrden, reenvio: true }
        );
        break;

      case 'lista':
        const { enviarNotificacionOrdenListaSinRifa } = await import('../services/notificationRouter.service.js');
        resultado = await enviarNotificacionOrdenListaSinRifa(
          orden.nombre_cliente,
          orden.telefono_cliente,
          orden.placa_vehiculo,
          orden.total,
          { orderId: idOrden, reenvio: true }
        );
        break;

      case 'completada':
        const { enviarNotificacionOrdenTerminada } = await import('../services/notificationRouter.service.js');
        resultado = await enviarNotificacionOrdenTerminada(
          orden.nombre_cliente,
          orden.telefono_cliente,
          orden.placa_vehiculo,
          orden.total,
          { orderId: idOrden, reenvio: true }
        );
        break;

      default:
        return res.status(400).json({ error: 'Tipo de notificación no válido' });
    }

    if (resultado?.success) {
      res.json({
        success: true,
        mensaje: 'SMS reenviado correctamente',
        tipo: tipoNotificacion,
        idOrden
      });
    } else {
      res.status(500).json({
        success: false,
        error: resultado?.error || 'Error reenviando SMS'
      });
    }
  } catch (error) {
    console.error('Error reenviando SMS:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Ver estado de notificaciones enviadas para una orden
 */
router.get('/historial-sms/:idOrden', async (req, res) => {
  try {
    const { idOrden } = req.params;

    const result = await pool.query(
      `SELECT id_log, numero_telefono, contenido_mensaje, estado,
              timestamp_envio, tipo_notificacion
       FROM public.mensaje_audit_log
       WHERE id_orden = $1
       ORDER BY timestamp_envio DESC
       LIMIT 10`,
      [idOrden]
    );

    res.json({
      idOrden,
      total: result.rows.length,
      notificaciones: result.rows.map(row => ({
        id: row.id_log,
        telefono: row.numero_telefono,
        mensaje: row.contenido_mensaje.substring(0, 50) + '...',
        estado: row.estado,
        tipo: row.tipo_notificacion,
        fecha: row.timestamp_envio
      }))
    });
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Configuración de notificaciones automáticas
 */
router.get('/config-automaticas', (req, res) => {
  res.json({
    automaticas_activas: true,
    eventos: {
      'creacion_orden': {
        estado: 'ACTIVO ✅',
        mensaje: 'Tu orden ha sido RECIBIDA',
        cuando: 'Inmediatamente al crear orden',
        garantizado: true
      },
      'cambio_a_lista': {
        estado: 'ACTIVO ✅',
        mensaje: '¡Tu vehículo está LISTO!',
        cuando: 'Cuando estado cambia a "Lista"',
        garantizado: true
      },
      'cambio_a_completada': {
        estado: 'ACTIVO ✅',
        mensaje: 'Tu orden ha sido COMPLETADA',
        cuando: 'Cuando estado cambia a "Orden finalizada"',
        garantizado: true
      },
      'cancelacion': {
        estado: 'ACTIVO ✅',
        mensaje: 'Tu orden ha sido CANCELADA',
        cuando: 'Cuando estado cambia a "Cancelada"',
        garantizado: true
      }
    },
    canal: 'SMS (LabsMobile)',
    reintento_activo: true,
    reintento_veces: 3,
    reintento_intervalo: '2 minutos'
  });
});

export default router;
