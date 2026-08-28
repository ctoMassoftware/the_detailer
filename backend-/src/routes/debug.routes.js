import { Router } from 'express';
import { pool } from '../config/db.js';
import { verifyToken } from '../controllers/auth.controller.js';
import { enviarNotificacionPorCambioEstado } from '../services/orderStatusNotification.service.js';

const router = Router();

/**
 * DEBUG: Analizar orden completa (PUBLIC - Sin autenticación)
 * GET /api/debug/orden/:id
 */
router.get('/orden/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // 1. DATOS PRINCIPALES DE LA ORDEN
    const ordenResult = await pool.query(`
      SELECT 
        o.id_orden,
        o.nombre_cliente,
        o.telefono_cliente,
        o.placa_vehiculo,
        o.estado,
        o.id_rifa,
        o.id_boleta,
        o.fecha,
        o.hora,
        o.metodo_pago
      FROM orden o
      WHERE o.id_orden = $1
    `, [id]);

    if (ordenResult.rows.length === 0) {
      return res.status(404).json({ error: `Orden ${id} no encontrada` });
    }

    const orden = ordenResult.rows[0];

    // 2. BOLETA ASIGNADA
    let boleta = null;
    if (orden.id_boleta) {
      const boletaResult = await pool.query(`
        SELECT 
          r.id_boleta,
          r.numero_boleta,
          r.nombre,
          r.telefono,
          r.placa_vehiculo,
          r.id_evento_rifa
        FROM rifa r
        WHERE r.id_boleta = $1
      `, [orden.id_boleta]);
      boleta = boletaResult.rows[0] || null;
    }

    // 3. EVENTO DE RIFA
    let evento = null;
    if (orden.id_rifa) {
      const eventoResult = await pool.query(`
        SELECT 
          er.id_evento,
          er.descripcion_premios,
          er.encargado,
          er.fecha_sorteo,
          er.estado
        FROM evento_rifa er
        WHERE er.id_evento = $1
      `, [orden.id_rifa]);
      evento = eventoResult.rows[0] || null;
    }

    // 4. SERVICIOS
    const serviciosResult = await pool.query(`
      SELECT 
        s.id_servicio,
        s.nombre_servicio,
        d.cantidad,
        d.precio_servicio_aplicado,
        (d.cantidad * d.precio_servicio_aplicado)::numeric as subtotal
      FROM detalle_orden_venta d
      JOIN servicio s ON d.id_servicio = s.id_servicio
      WHERE d.id_orden = $1
    `, [id]);

    // 5. VALIDACIÓN
    const validacion = {
      'Orden existe': '✅',
      'Tiene rifa': orden.id_rifa ? '✅' : '❌',
      'Tiene id_boleta': orden.id_boleta ? '✅' : '❌',
      'Boleta registrada en tabla rifa': boleta ? '✅' : '❌',
      'Evento existe': evento ? '✅' : '❌',
      'Estado': orden.estado
    };

    // RESPUESTA COMPLETA
    res.json({
      orden,
      boleta,
      evento,
      servicios: serviciosResult.rows,
      validacion,
      resumen: {
        numero_orden: orden.id_orden,
        cliente: orden.nombre_cliente,
        placa: orden.placa_vehiculo,
        rifa_asignada: orden.id_rifa ? `Evento ${orden.id_rifa}` : 'NO',
        boleta_asignada: orden.id_boleta ? `#${boleta?.numero_boleta || 'DESCONOCIDA'}` : 'NO',
        estado: orden.estado,
        fecha: orden.fecha
      }
    });

  } catch (error) {
    console.error('Error en debug/orden:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DEBUG: Prueba SMS #3 (Orden Completada)
 * POST /api/debug/test-sms3/:orderId
 * Simula una transición de LISTA → FINALIZADA para disparar SMS #3
 */
router.post('/test-sms3/:orderId', async (req, res) => {
  const { orderId } = req.params;

  try {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🧪 TEST SMS #3 - Orden ${orderId}`);
    console.log(`${'═'.repeat(60)}\n`);

    // 1. OBTENER DATOS DE LA ORDEN
    const ordenResult = await pool.query(`
      SELECT
        id_orden,
        nombre_cliente,
        telefono_cliente,
        placa_vehiculo,
        tipo_vehiculo,
        cantidad_cascos,
        estado,
        id_rifa,
        id_boleta,
        (SELECT SUM(cantidad * precio_servicio_aplicado)
         FROM detalle_orden_venta
         WHERE id_orden = $1)::numeric AS valorTotal
      FROM orden
      WHERE id_orden = $1
    `, [orderId]);

    if (ordenResult.rows.length === 0) {
      return res.status(404).json({
        error: `Orden ${orderId} no encontrada`,
        success: false
      });
    }

    const orden = ordenResult.rows[0];
    const estadoAnterior = orden.estado;

    console.log(`📋 Orden encontrada:`);
    console.log(`   Cliente: ${orden.nombre_cliente}`);
    console.log(`   Teléfono: ${orden.telefono_cliente}`);
    console.log(`   Placa: ${orden.placa_vehiculo}`);
    console.log(`   Estado actual: ${orden.estado}`);
    console.log(`   ID Rifa: ${orden.id_rifa}`);
    console.log(`   ID Boleta: ${orden.id_boleta}\n`);

    // 2. CAMBIAR ESTADO A FINALIZADA
    const nuevoEstado = 'FINALIZADA_ENTREGADA';
    await pool.query(
      `UPDATE orden SET estado = $1 WHERE id_orden = $2`,
      [nuevoEstado, orderId]
    );
    console.log(`✅ Estado actualizado: ${estadoAnterior} → ${nuevoEstado}\n`);

    // 3. DISPARAR SMS #3
    console.log(`📱 Intentando enviar SMS #3...\n`);
    const resultado = await enviarNotificacionPorCambioEstado(
      estadoAnterior,
      nuevoEstado,
      {
        nombre_cliente: orden.nombre_cliente,
        telefono_cliente: orden.telefono_cliente,
        placa_vehiculo: orden.placa_vehiculo,
        tipo_vehiculo: orden.tipo_vehiculo,
        cantidad_cascos: orden.cantidad_cascos,
        valorTotal: orden.valorTotal,
        id_orden: orden.id_orden,
        id_boleta: orden.id_boleta
      },
      orden.id_rifa
    );

    console.log(`\n📊 Resultado del envío:`);
    console.log(JSON.stringify(resultado, null, 2));

    return res.json({
      success: resultado.success !== false,
      mensaje: 'SMS #3 enviado - Revisa los logs del servidor para detalles',
      resultado,
      orden_data: {
        id_orden: orden.id_orden,
        estado_anterior: estadoAnterior,
        estado_nuevo: nuevoEstado,
        cliente: orden.nombre_cliente,
        telefono: orden.telefono_cliente
      }
    });

  } catch (error) {
    console.error(`\n❌ ERROR EN TEST SMS #3:`, error.message);
    console.error(`Stack:`, error.stack);
    res.status(500).json({
      error: error.message,
      stack: error.stack,
      success: false
    });
  }
});

export default router;
