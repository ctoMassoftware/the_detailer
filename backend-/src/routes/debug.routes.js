import { Router } from 'express';
import { pool } from '../config/db.js';
import { verifyToken } from '../controllers/auth.controller.js';
import { enviarNotificacionPorCambioEstado } from '../services/orderStatusNotification.service.js';
import { getLabsMobileCredentialsFromDB, resolveCredentials } from '../services/labsmobileConfig.service.js';

const router = Router();

/**
 * DEBUG: Consultar saldo real de la cuenta LabsMobile (PUBLIC - solo lectura, no expone el token)
 * GET /api/debug/labsmobile-balance
 * Diagnóstico para el caso "el sistema registra success pero el SMS nunca llega al celular":
 * LabsMobile puede aceptar (code 0) un envío y luego no entregarlo si la cuenta se quedó
 * sin saldo, así que "success" en nuestra BD NO garantiza que el operador móvil lo entregó.
 */
router.get('/labsmobile-balance', async (req, res) => {
  try {
    const dbCredentials = await getLabsMobileCredentialsFromDB();
    const { username, apiToken } = resolveCredentials(null, dbCredentials);

    if (!username || !apiToken) {
      return res.status(400).json({ error: 'No hay credenciales de LabsMobile configuradas' });
    }

    const auth = Buffer.from(`${username}:${apiToken}`).toString('base64');
    const response = await fetch('https://api.labsmobile.com/json/balance', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      }
    });

    const data = await response.json();
    res.json({
      consultado_en: new Date().toISOString(),
      labsmobile_response: data
    });
  } catch (error) {
    console.error('Error consultando saldo LabsMobile:', error);
    res.status(500).json({ error: error.message });
  }
});

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

/**
 * DEBUG: Verificar estructura de tabla recibo_token
 * GET /api/debug/recibo-token-structure
 */
router.get('/recibo-token-structure', async (req, res) => {
  try {
    // Verificar si tabla existe
    const tableExists = await pool.query(`
      SELECT EXISTS(
        SELECT FROM information_schema.tables
        WHERE table_name = 'recibo_token'
      ) as existe
    `);

    if (!tableExists.rows[0].existe) {
      return res.json({
        error: 'Tabla recibo_token NO existe',
        status: 'CRÍTICO'
      });
    }

    // Obtener estructura de la tabla
    const structure = await pool.query(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'recibo_token'
      ORDER BY ordinal_position
    `);

    // Verificar registros
    const records = await pool.query(`
      SELECT COUNT(*) as total FROM recibo_token
    `);

    // Verificar últimos registros
    const latestRecords = await pool.query(`
      SELECT
        id,
        id_orden,
        id_venta,
        token_hash,
        creado_at,
        expira_at,
        activo
      FROM recibo_token
      ORDER BY creado_at DESC
      LIMIT 5
    `);

    res.json({
      status: 'OK',
      tabla_existe: true,
      columnas: structure.rows,
      total_registros: records.rows[0].total,
      ultimos_registros: latestRecords.rows
    });

  } catch (error) {
    console.error('Error en debug/recibo-token-structure:', error);
    res.status(500).json({
      error: error.message,
      detalle: error.toString()
    });
  }
});

/**
 * DEBUG: Validar token específico
 * GET /api/debug/validar-token/:token
 */
router.get('/validar-token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const crypto = await import('crypto');

    // Hash del token
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    console.log(`🔍 Buscando token: ${token.substring(0, 20)}...`);
    console.log(`   Hash: ${tokenHash.substring(0, 20)}...`);

    // Buscar en BD
    const result = await pool.query(`
      SELECT
        rt.id,
        rt.id_orden,
        rt.id_venta,
        rt.token_hash,
        rt.creado_at,
        rt.expira_at,
        rt.activo,
        rt.placa_vehiculo,
        o.id_orden as orden_existe,
        v.id_venta as venta_existe
      FROM recibo_token rt
      LEFT JOIN orden o ON rt.id_orden = o.id_orden
      LEFT JOIN venta_mostrador v ON rt.id_venta = v.id_venta
      WHERE rt.token_hash = $1
    `, [tokenHash]);

    if (result.rows.length === 0) {
      return res.json({
        found: false,
        message: 'Token NO encontrado en BD',
        token: token.substring(0, 20) + '...',
        hash_buscado: tokenHash.substring(0, 20) + '...'
      });
    }

    const row = result.rows[0];
    const ahora = new Date();
    const expira = new Date(row.expira_at);
    const vigente = row.activo && expira > ahora;

    res.json({
      found: true,
      token: row,
      vigente: vigente,
      activo: row.activo,
      expirado: expira < ahora,
      fecha_expira: row.expira_at,
      orden_vinculada_existe: !!row.orden_existe,
      venta_vinculada_existe: !!row.venta_existe,
      problema: !vigente ? 'Token inactivo o expirado' : 'Token válido'
    });

  } catch (error) {
    console.error('Error en debug/validar-token:', error);
    res.status(500).json({
      error: error.message,
      detalle: error.toString()
    });
  }
});

/**
 * Corregir numero_rifa de ventas de mostrador
 * POST /api/debug/corregir-numero-rifa
 * Body: { ventas: [{ id_venta: 82, numero_rifa: "418" }, ...] }
 */
router.post('/corregir-numero-rifa', verifyToken, async (req, res) => {
  const { ventas } = req.body;
  if (!ventas || !Array.isArray(ventas) || ventas.length === 0) {
    return res.status(400).json({ error: 'ventas requerido: [{ id_venta, numero_rifa }]' });
  }

  const resultados = [];
  for (const { id_venta, numero_rifa } of ventas) {
    try {
      const numeroFormatted = numero_rifa.toString().padStart(3, '0');
      const r = await pool.query(
        `UPDATE venta_mostrador SET numero_rifa = $1 WHERE id_venta = $2 RETURNING id_venta, numero_rifa`,
        [numeroFormatted, id_venta]
      );
      if (r.rowCount === 1) {
        resultados.push({ id_venta, numero_rifa: numeroFormatted, status: 'ok' });
        console.log(`✅ Venta ${id_venta} corregida: numero_rifa=${numeroFormatted}`);
      } else {
        resultados.push({ id_venta, status: 'no encontrada' });
      }
    } catch (err) {
      resultados.push({ id_venta, status: 'error', error: err.message });
    }
  }

  res.json({ success: true, resultados });
});

/**
 * Reenviar SMS de recibo a una venta de mostrador
 * POST /api/debug/reenviar-recibo-venta
 * Body: { id_venta: 82 }
 */
router.post('/reenviar-recibo-venta', verifyToken, async (req, res) => {
  const { id_venta } = req.body;
  if (!id_venta) return res.status(400).json({ error: 'id_venta requerido' });

  try {
    // 1. Obtener datos de la venta
    const ventaRes = await pool.query(
      `SELECT v.*, rt.token_hash
       FROM venta_mostrador v
       LEFT JOIN recibo_token rt ON rt.id_venta = v.id_venta AND rt.activo = true
       WHERE v.id_venta = $1
       LIMIT 1`,
      [id_venta]
    );

    if (ventaRes.rows.length === 0) {
      return res.status(404).json({ error: `Venta ${id_venta} no encontrada` });
    }

    const venta = ventaRes.rows[0];

    if (!venta.telefono_cliente) {
      return res.status(400).json({ error: 'La venta no tiene teléfono registrado' });
    }

    // Siempre generar token nuevo para el reenvío
    const crypto = (await import('crypto')).default;
    const tokenRecibo = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(tokenRecibo).digest('hex');
    await pool.query(
      `INSERT INTO recibo_token (id_venta, token_hash) VALUES ($1, $2)`,
      [id_venta, tokenHash]
    );
    console.log(`✓ Token nuevo generado para venta ${id_venta} (reenvío)`);

    // 3. Construir y enviar SMS
    const { enviarReciboMostrador } = await import('../services/notificationRouter.service.js');
    const total = Number(venta.total || 0);
    const detalles = venta.numero_rifa ? `Boleta #${venta.numero_rifa}` : 'Ver detalle en link';

    const resultado = await enviarReciboMostrador(
      venta.telefono_cliente,
      venta.cliente_nombre,
      detalles,
      total,
      {
        tokenRecibo,
        idVenta: id_venta,
        tipo: 'venta_mostrador',
        con_rifa_desde_inicio: !!venta.numero_rifa
      }
    );

    console.log(`📱 Reenvío SMS venta ${id_venta} → ${venta.telefono_cliente}:`, resultado);

    res.json({
      success: resultado.success !== false,
      id_venta,
      telefono: venta.telefono_cliente,
      numero_rifa: venta.numero_rifa || null,
      resultado
    });

  } catch (error) {
    console.error('❌ Error en reenvío de recibo:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;