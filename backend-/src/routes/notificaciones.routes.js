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
      `SELECT o.nombre_cliente, o.telefono_cliente, o.placa_vehiculo, o.tipo_vehiculo, o.cantidad_cascos,
              COALESCE(SUM(d.cantidad * d.precio_servicio_aplicado), 0) as total
       FROM public.orden o
       LEFT JOIN public.detalle_orden_venta d ON o.id_orden = d.id_orden
       WHERE o.id_orden = $1
       GROUP BY o.id_orden, o.nombre_cliente, o.telefono_cliente, o.placa_vehiculo, o.tipo_vehiculo, o.cantidad_cascos`,
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
          orden.telefono_cliente,
          orden.nombre_cliente,
          orden.total,
          orden.placa_vehiculo,
          idOrden,
          { orderId: idOrden, reenvio: true }
        );
        break;

      case 'lista':
        const { enviarNotificacionOrdenListaSinRifa } = await import('../services/notificationRouter.service.js');
        resultado = await enviarNotificacionOrdenListaSinRifa(
          orden.telefono_cliente,
          orden.nombre_cliente,
          orden.total,
          orden.placa_vehiculo,
          idOrden,
          { orderId: idOrden, reenvio: true }
        );
        break;

      case 'completada':
        const { enviarNotificacionOrdenTerminada } = await import('../services/notificationRouter.service.js');
        const { generarTokenRecibo } = await import('../services/reciboToken.service.js');
        const tokenRecibo = await generarTokenRecibo(idOrden, orden.placa_vehiculo);
        resultado = await enviarNotificacionOrdenTerminada(
          orden.telefono_cliente,
          orden.nombre_cliente,
          orden.total,
          orden.placa_vehiculo,
          orden.tipo_vehiculo,
          orden.cantidad_cascos || 0,
          idOrden,
          tokenRecibo,
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

/**
 * Endpoint de PRUEBA: Enviar SMS de completada con parámetros específicos
 * POST /api/notificaciones/prueba-cascos
 * Body: { telefono, nombre, placa, tipoVehiculo, cantidadCascos }
 */
router.post('/prueba-cascos', async (req, res) => {
  try {
    const { telefono, nombre, placa, tipoVehiculo, cantidadCascos } = req.body;

    if (!telefono || !nombre) {
      return res.status(400).json({ error: 'Se requieren: telefono, nombre' });
    }

    const { enviarNotificacionOrdenTerminada } = await import('../services/notificationRouter.service.js');

    console.log(`🧪 PRUEBA SMS COMPLETADA`);
    console.log(`   Teléfono: ${telefono}`);
    console.log(`   Nombre: ${nombre}`);
    console.log(`   Placa: ${placa || 'N/A'}`);
    console.log(`   Tipo: ${tipoVehiculo || 'N/A'}`);
    console.log(`   Cascos: ${cantidadCascos || 0}`);

    const { generarTokenRecibo } = await import('../services/reciboToken.service.js');
    const tokenRecibo = await generarTokenRecibo(9999, placa || 'ABC123');

    const resultado = await enviarNotificacionOrdenTerminada(
      telefono,
      nombre,
      150000, // total de prueba
      placa || 'ABC123',
      tipoVehiculo || 'CARRO',
      cantidadCascos || 0,
      '9999', // numeroOrden de prueba
      tokenRecibo,
      { tipo: 'prueba_cascos' }
    );

    res.json({
      success: resultado?.success,
      mensaje: resultado?.success ? 'SMS de prueba enviado' : 'Error enviando SMS',
      resultado
    });
  } catch (error) {
    console.error('Error en prueba-cascos:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Auditoría de los 3 mensajes SMS automáticos
 * GET /api/notificaciones/auditoria-3-mensajes
 * Valida que se envíen los mensajes correctos en cada estado
 */
router.get('/auditoria-3-mensajes', async (req, res) => {
  try {
    // Obtener últimas 50 órdenes con mensajes registrados
    const result = await pool.query(`
      SELECT
        o.id_orden,
        o.nombre_cliente,
        o.telefono_cliente,
        o.placa_vehiculo,
        o.tipo_vehiculo,
        o.cantidad_cascos,
        o.estado,
        o.id_rifa,
        COALESCE(SUM(d.cantidad * d.precio_servicio_aplicado), 0) as total,
        COUNT(DISTINCT mal.id_log) as total_mensajes,
        json_agg(
          json_build_object(
            'tipo', mal.tipo_notificacion,
            'estado_sms', mal.estado,
            'contenido', LEFT(mal.contenido_mensaje, 100),
            'timestamp', mal.timestamp_envio
          )
          ORDER BY mal.timestamp_envio ASC
        ) as mensajes
      FROM orden o
      LEFT JOIN detalle_orden_venta d ON o.id_orden = d.id_orden
      LEFT JOIN mensaje_audit_log mal ON o.id_orden = mal.id_orden
      WHERE mal.id_log IS NOT NULL
      GROUP BY o.id_orden, o.nombre_cliente, o.telefono_cliente, o.placa_vehiculo, o.tipo_vehiculo, o.cantidad_cascos, o.estado, o.id_rifa
      ORDER BY o.id_orden DESC
      LIMIT 20
    `);

    // Analizar para los 3 tipos de mensajes
    const analysis = result.rows.map(orden => {
      const mensajes = orden.mensajes || [];
      const tieneInicio = mensajes.some(m => m.tipo === 'estado_proceso');
      const tieneLista = mensajes.some(m => m.tipo === 'estado_lista' || m.tipo === 'estado_lista_rifa');
      const tieneCompletada = mensajes.some(m => m.tipo === 'orden_completada');

      const mensajeInicio = mensajes.find(m => m.tipo === 'estado_proceso');
      const mensajeLista = mensajes.find(m => m.tipo === 'estado_lista' || m.tipo === 'estado_lista_rifa');
      const mensajeCompletada = mensajes.find(m => m.tipo === 'orden_completada');

      return {
        id_orden: orden.id_orden,
        cliente: orden.nombre_cliente,
        telefono: orden.telefono_cliente,
        placa: orden.placa_vehiculo,
        estado_actual: orden.estado,
        total_mensajes: orden.total_mensajes,
        validacion: {
          mensaje_1_inicio: tieneInicio ? '✅ SÍ' : '❌ NO',
          mensaje_2_lista: tieneLista ? '✅ SÍ' : '❌ NO',
          mensaje_3_completada: tieneCompletada ? '✅ SÍ' : '❌ NO',
          completo: (tieneInicio && tieneLista && tieneCompletada) ? '✅ COMPLETO' : '⚠️ INCOMPLETO'
        },
        detalles: {
          inicio: mensajeInicio ? {
            tipo: mensajeInicio.tipo,
            estado: mensajeInicio.estado_sms,
            contenido: mensajeInicio.contenido,
            fecha: mensajeInicio.timestamp
          } : null,
          lista: mensajeLista ? {
            tipo: mensajeLista.tipo,
            estado: mensajeLista.estado_sms,
            contenido: mensajeLista.contenido,
            fecha: mensajeLista.timestamp
          } : null,
          completada: mensajeCompletada ? {
            tipo: mensajeCompletada.tipo,
            estado: mensajeCompletada.estado_sms,
            contenido: mensajeCompletada.contenido,
            fecha: mensajeCompletada.timestamp
          } : null
        }
      };
    });

    const totalOrdenes = analysis.length;
    const completas = analysis.filter(o => o.validacion.completo === '✅ COMPLETO').length;
    const incompletas = totalOrdenes - completas;

    res.json({
      resumen: {
        total_ordenes_analizadas: totalOrdenes,
        ordenes_con_3_mensajes: completas,
        ordenes_incompletas: incompletas,
        porcentaje_completitud: Math.round((completas / totalOrdenes) * 100) + '%'
      },
      ordenes: analysis
    });

  } catch (error) {
    console.error('Error en auditoría:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
