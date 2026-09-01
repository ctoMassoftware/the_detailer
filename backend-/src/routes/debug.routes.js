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
 * DEBUG: Verificar número telefónico guardado
 * GET /api/debug/telefono/:orderId
 * Muestra exactamente qué número se usará para SMS
 */
router.get('/telefono/:orderId', async (req, res) => {
  const { orderId } = req.params;

  try {
    const result = await pool.query(`
      SELECT
        id_orden,
        nombre_cliente,
        telefono_cliente,
        LENGTH(telefono_cliente) as longitud,
        OCTET_LENGTH(telefono_cliente) as bytes,
        telefono_cliente::bytea as bytes_hex
      FROM orden
      WHERE id_orden = $1
    `, [orderId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Orden ${orderId} no encontrada` });
    }

    const row = result.rows[0];
    const telefonoLimpio = row.telefono_cliente.trim();
    const tieneEspacios = telefonoLimpio !== row.telefono_cliente;
    const esValido = /^3\d{9}$/.test(telefonoLimpio);

    res.json({
      orden_id: row.id_orden,
      cliente: row.nombre_cliente,
      telefono_original: `"${row.telefono_cliente}"`,
      telefono_limpio: telefonoLimpio,
      caracteres: row.longitud,
      bytes: row.bytes,
      tiene_espacios: tieneEspacios,
      formato_valido: esValido,
      normalizacion_labsmobile: `+57${telefonoLimpio}`,
      validacion: {
        '¿Empieza con 3?': telefonoLimpio.startsWith('3'),
        '¿Tiene 10 dígitos?': telefonoLimpio.length === 10,
        '¿Solo números?': /^\d+$/.test(telefonoLimpio),
        '¿Formato válido?': esValido
      },
      diagnostico: esValido ? '✅ Teléfono OK' : '❌ Formato incorrecto',
      recomendacion: tieneEspacios ? 'Limpiar espacios en BD' : 'Verificar con operador'
    });

  } catch (error) {
    console.error('Error en debug/telefono:', error);
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

/**
 * DEBUG: Ver últimos SMS enviados
 * GET /api/debug/sms-log?limit=10
 */
router.get('/sms-log', async (req, res) => {
  const { limit = 10 } = req.query;

  try {
    const result = await pool.query(`
      SELECT
        id_mensaje,
        numero_telefono,
        SUBSTRING(contenido_mensaje, 1, 80) as contenido_preview,
        estado,
        sid_twilio as subid_labsmobile,
        tipo_notificacion,
        error_detalles,
        TO_CHAR(timestamp_envio, 'YYYY-MM-DD HH24:MI:SS') as fecha_envio
      FROM mensaje_log
      ORDER BY timestamp_envio DESC
      LIMIT $1
    `, [parseInt(limit)]);

    res.json({
      total: result.rows.length,
      sms: result.rows
    });

  } catch (error) {
    console.error('Error en debug/sms-log:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DEBUG: Ver credenciales LabsMobile en BD
 * GET /api/debug/labsmobile-config
 */
router.get('/labsmobile-config', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        username,
        SUBSTRING(api_token, 1, 10) || '...' as api_token_preview,
        LENGTH(api_token) as token_length,
        sender,
        activo,
        TO_CHAR(actualizado_at, 'YYYY-MM-DD HH24:MI:SS') as ultima_actualizacion
      FROM config_labsmobile
      WHERE activo = true
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.json({
        error: 'No hay credenciales activas',
        config: null
      });
    }

    const config = result.rows[0];
    res.json({
      configurado: true,
      config,
      validacion: {
        'Username presente': !!config.username,
        'Token presente': config.token_length > 0,
        'Sender configurado': !!config.sender,
        'Activo': config.activo
      }
    });

  } catch (error) {
    console.error('Error en debug/labsmobile-config:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DEBUG: Resumen de SMS por estado (últimas 24 horas)
 * GET /api/debug/sms-stats
 */
router.get('/sms-stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        estado,
        COUNT(*) as total,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as porcentaje
      FROM mensaje_audit_log
      WHERE timestamp_envio >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
      GROUP BY estado
      ORDER BY total DESC
    `);

    res.json({
      periodo: 'Últimas 24 horas',
      estadisticas: result.rows
    });

  } catch (error) {
    console.error('Error en debug/sms-stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DEBUG: Ver estructura de tablas relacionadas con mensajes
 * GET /api/debug/db-structure
 */
router.get('/db-structure', async (req, res) => {
  try {
    // 1. Ver tablas que existen
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND (table_name LIKE '%mensaje%' OR table_name LIKE '%log%' OR table_name LIKE '%sms%' OR table_name LIKE '%config%')
      ORDER BY table_name
    `);

    const tables = tablesResult.rows.map(r => r.table_name);

    // 2. Para cada tabla, obtener columnas
    const estructura = {};

    for (const table of tables) {
      const columnsResult = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [table]);

      estructura[table] = {
        columnas: columnsResult.rows,
        total_columnas: columnsResult.rows.length
      };

      // Obtener count de registros
      const countResult = await pool.query(`SELECT COUNT(*) as total FROM ${table}`);
      estructura[table].total_registros = parseInt(countResult.rows[0].total);
    }

    res.json({
      tablas_encontradas: tables,
      estructura,
      diagnostico: {
        'mensaje_log existe': tables.includes('mensaje_log'),
        'mensaje_audit_log existe': tables.includes('mensaje_audit_log'),
        'config_labsmobile existe': tables.includes('config_labsmobile'),
        'total_tablas': tables.length
      }
    });

  } catch (error) {
    console.error('Error en debug/db-structure:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DEBUG: Ver contenido de mensaje_log (últimos 20 registros)
 * GET /api/debug/mensaje-log-content
 */
router.get('/mensaje-log-content', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM mensaje_audit_log
      ORDER BY timestamp_envio DESC
      LIMIT 20
    `);

    res.json({
      total: result.rows.length,
      registros: result.rows
    });

  } catch (error) {
    console.error('Error en debug/mensaje-log-content:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DEBUG: Ver contenido de config_labsmobile
 * GET /api/debug/config-content
 */
router.get('/config-content', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM config_labsmobile
      LIMIT 5
    `);

    res.json({
      total: result.rows.length,
      registros: result.rows.map(r => ({
        ...r,
        api_token: r.api_token ? r.api_token.substring(0, 20) + '...' : null
      }))
    });

  } catch (error) {
    console.error('Error en debug/config-content:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DEBUG: Ver últimas ventas de mostrador (PUBLIC)
 * GET /api/debug/ultimas-ventas
 */
router.get('/ultimas-ventas', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        v.id_venta,
        v.cliente_nombre,
        v.telefono_cliente,
        v.metodo_pago,
        v.total,
        v.sede,
        v.fecha,
        v.hora,
        u.nombre as vendedor,
        COUNT(d.id_detalle) as items
      FROM venta_mostrador v
      LEFT JOIN usuarios u ON v.id_user_vendedor = u.id_user
      LEFT JOIN detalle_venta_mostrador d ON v.id_venta = d.id_venta
      GROUP BY v.id_venta, u.nombre
      ORDER BY v.fecha DESC, v.hora DESC
      LIMIT 10
    `);

    res.json({
      total: result.rows.length,
      ventas: result.rows
    });

  } catch (error) {
    console.error('Error en debug/ultimas-ventas:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DEBUG: Ver detalles de una venta (PUBLIC)
 * GET /api/debug/venta/:idVenta
 */
router.get('/venta/:idVenta', async (req, res) => {
  const { idVenta } = req.params;

  try {
    // Datos de la venta
    const ventaResult = await pool.query(`
      SELECT * FROM venta_mostrador WHERE id_venta = $1
    `, [idVenta]);

    if (ventaResult.rows.length === 0) {
      return res.status(404).json({ error: `Venta ${idVenta} no encontrada` });
    }

    const venta = ventaResult.rows[0];

    // Detalles de la venta
    const detallesResult = await pool.query(`
      SELECT * FROM detalle_venta_mostrador WHERE id_venta = $1
    `, [idVenta]);

    // Buscar SMS enviados para esta venta
    const smsResult = await pool.query(`
      SELECT
        id_log as id_mensaje,
        numero_telefono,
        contenido_mensaje,
        estado,
        sid_twilio,
        tipo_notificacion,
        error_detalles,
        timestamp_envio
      FROM mensaje_audit_log
      WHERE numero_telefono = $1
      ORDER BY timestamp_envio DESC
      LIMIT 5
    `, [venta.telefono_cliente]);

    res.json({
      venta,
      detalles: detallesResult.rows,
      sms_enviados: {
        total: smsResult.rows.length,
        registros: smsResult.rows
      },
      diagnostico: {
        'Venta registrada': !!venta.id_venta,
        'Tiene teléfono': !!venta.telefono_cliente,
        'SMS encontrados': smsResult.rows.length > 0,
        'Primer SMS estado': smsResult.rows[0]?.estado || 'N/A'
      }
    });

  } catch (error) {
    console.error('Error en debug/venta:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DEBUG: Ver últimas órdenes (PUBLIC)
 * GET /api/debug/ultimas-ordenes
 */
router.get('/ultimas-ordenes', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id_orden,
        nombre_cliente,
        telefono_cliente,
        placa_vehiculo,
        estado,
        fecha_creacion,
        id_rifa,
        id_boleta
      FROM orden
      ORDER BY fecha_creacion DESC
      LIMIT 10
    `);

    res.json({
      total: result.rows.length,
      ordenes: result.rows
    });

  } catch (error) {
    console.error('Error en debug/ultimas-ordenes:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
