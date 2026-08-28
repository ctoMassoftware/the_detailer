import { Router } from 'express';
import { pool } from '../config/db.js';
import { verifyToken } from '../controllers/auth.controller.js';

const router = Router();

/**
 * DEBUG: Analizar orden completa
 * GET /api/debug/orden/:id
 */
router.get('/orden/:id', verifyToken, async (req, res) => {
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

export default router;
