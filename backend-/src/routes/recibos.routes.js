import { Router } from 'express';
import { validarTokenRecibo, marcarTokenComoDescargado } from '../services/reciboToken.service.js';
import { pool } from '../config/db.js';

const router = Router();

/**
 * Health check y diagnostics
 * GET /api/recibos/health
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'recibos',
    timestamp: new Date().toISOString(),
    endpoints: [
      'GET /datos/:token?placa=XXX - Obtener recibo específico',
      'GET /por-placa/:placa - Obtener todas las órdenes de una placa',
      'GET /descargar/:token?placa=XXX - Descargar HTML del recibo'
    ]
  });
});

// 🔍 Middleware de debugging - registra todas las solicitudes
router.use((req, res, next) => {
  console.log(`📍 GET /api/recibos${req.path}`);
  next();
});

/**
 * Obtener todas las órdenes de un vehículo por placa
 * GET /api/recibos/por-placa/:placa
 */
router.get('/por-placa/:placa', async (req, res) => {
  try {
    const { placa } = req.params;

    console.log(`📥 ENDPOINT ÓRDENES POR PLACA - Solicitud recibida`);
    console.log(`   Placa: ${placa}`);

    if (!placa || placa.length < 3) {
      return res.status(400).json({ error: 'Placa inválida' });
    }

    // Obtener órdenes de esa placa (últimas 24 horas máximo para seguridad)
    const result = await pool.query(
      `SELECT
        o.*,
        CONCAT(u.nombre, ' ', u.apellido) as responsable_nombre,
        COALESCE(SUM(d.cantidad * d.precio_servicio_aplicado), 0) as total_orden,
        COALESCE(
          json_agg(
            json_build_object(
              'servicio', s.nombre_servicio,
              'cantidad', d.cantidad,
              'precio_unitario', d.precio_servicio_aplicado,
              'subtotal', (d.cantidad * d.precio_servicio_aplicado)
            )
          ) FILTER (WHERE d.id_servicio IS NOT NULL),
          '[]'::json
        ) as lista_servicios,
        er.descripcion_premios as rifa_premio,
        er.fecha_sorteo as fecha_sorteo,
        (SELECT numero_boleta FROM rifa WHERE id_evento_rifa = o.id_rifa LIMIT 1) as numero_rifa
       FROM orden o
       LEFT JOIN usuarios u ON o.id_user_encargado = u.id_user
       LEFT JOIN detalle_orden_venta d ON o.id_orden = d.id_orden
       LEFT JOIN servicio s ON d.id_servicio = s.id_servicio
       LEFT JOIN evento_rifa er ON o.id_rifa = er.id_evento
       WHERE UPPER(o.placa_vehiculo) = UPPER($1)
         AND o.fecha >= (CURRENT_DATE AT TIME ZONE 'America/Bogota') - INTERVAL '1 day'
       GROUP BY o.id_orden, o.cedula_cliente, o.nombre_cliente, o.correo_cliente, o.telefono_cliente, o.direccion_cliente, o.placa_vehiculo, o.marca_vehiculo, o.modelo_vehiculo, o.tipo_vehiculo, o.metodo_pago, o.caja, o.estado, o.id_user_encargado, o.id_rifa, o.notas, o.fecha, o.hora, o.sede, u.nombre, u.apellido, er.descripcion_premios, er.fecha_sorteo
       ORDER BY o.fecha DESC, o.hora DESC, o.id_orden DESC
       LIMIT 1`,
      [placa]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No hay órdenes registradas para la placa ${placa}`
      });
    }

    const ordenes = result.rows.map(row => ({
      id_orden: row.id_orden,
      fecha: row.fecha,
      hora: row.hora,
      nombre_cliente: row.nombre_cliente,
      cedula_cliente: row.cedula_cliente,
      telefono_cliente: row.telefono_cliente,
      correo_cliente: row.correo_cliente,
      placa_vehiculo: row.placa_vehiculo,
      tipo_vehiculo: row.tipo_vehiculo,
      marca_vehiculo: row.marca_vehiculo,
      modelo_vehiculo: row.modelo_vehiculo,
      total: row.total_orden,
      estado: row.estado,
      cantidad_cascos: row.cantidad_cascos || 0,
      numero_rifa: row.numero_rifa,
      rifa_premio: row.rifa_premio,
      fecha_sorteo: row.fecha_sorteo,  // Cuándo juega (fecha del sorteo)
      responsable: row.responsable_nombre,  // Nombre del operario/responsable de rifa
      id_rifa: row.id_rifa,  // Para validar si tiene rifa
      notas: row.notas,  // Observaciones de la orden
      servicios: row.lista_servicios,
      metodoPago: row.metodo_pago
    }));

    res.json({
      success: true,
      placa: placa,
      total_ordenes: ordenes.length,
      ordenes: ordenes
    });

  } catch (error) {
    console.error('Error obteniendo órdenes por placa:', error);
    res.status(500).json({ error: 'Error obteniendo órdenes' });
  }
});

/**
 * DEBUG: Validar datos en BD para una orden específica
 * GET /api/recibos/debug/:idOrden
 */
router.get('/debug/:idOrden', async (req, res) => {
  try {
    const { idOrden } = req.params;

    // Validar orden
    const ordenRes = await pool.query('SELECT * FROM orden WHERE id_orden = $1', [idOrden]);
    const orden = ordenRes.rows[0] || null;

    // Validar evento de rifa
    let eventoRifa = null;
    if (orden && orden.id_rifa) {
      const rifaRes = await pool.query('SELECT * FROM evento_rifa WHERE id_evento = $1', [orden.id_rifa]);
      eventoRifa = rifaRes.rows[0] || null;
    }

    // Validar boletas registradas para ese evento
    let boletas = [];
    if (orden && orden.id_rifa) {
      const boletasRes = await pool.query('SELECT * FROM rifa WHERE id_evento_rifa = $1', [orden.id_rifa]);
      boletas = boletasRes.rows;
    }

    res.json({
      debug: true,
      orden: orden ? {
        id_orden: orden.id_orden,
        placa_vehiculo: orden.placa_vehiculo,
        nombre_cliente: orden.nombre_cliente,
        id_rifa: orden.id_rifa,
        fecha: orden.fecha,
        estado: orden.estado
      } : null,
      eventoRifa: eventoRifa,
      boletasParaEseEvento: boletas,
      primeraBoletaDelEvento: boletas.length > 0 ? boletas[0] : null
    });
  } catch (error) {
    console.error('Error en debug:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DEBUG: Buscar órdenes que tienen rifa
 * GET /api/recibos/debug-rifa
 */
router.get('/debug-rifa', async (req, res) => {
  try {
    // Buscar órdenes con rifa
    const result = await pool.query(`
      SELECT o.id_orden, o.placa_vehiculo, o.nombre_cliente, o.id_rifa,
             er.id_evento, er.descripcion_premios, er.fecha_sorteo,
             r.numero_boleta, r.placa_vehiculo as rifa_placa
      FROM orden o
      LEFT JOIN evento_rifa er ON o.id_rifa = er.id_evento
      LEFT JOIN rifa r ON o.id_rifa = r.id_evento_rifa
      WHERE o.id_rifa IS NOT NULL
      LIMIT 5
    `);

    res.json({
      debug: true,
      totalConRifa: result.rowCount,
      ordenes: result.rows
    });
  } catch (error) {
    console.error('Error en debug rifa:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * SETUP: Crear evento de rifa y asignar a todas las órdenes
 * POST /api/recibos/setup-rifa (sin autenticación - temporal)
 */
router.post('/setup-rifa', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Crear evento de rifa
    const rifaResult = await client.query(`
      INSERT INTO evento_rifa (fecha_sorteo, descripcion_premios, encargado, estado)
      VALUES (
        CURRENT_DATE + INTERVAL '30 days',
        'Lavado Gratis + Encerado Premium',
        'The Detailer',
        true
      )
      RETURNING id_evento
    `);
    const idEvento = rifaResult.rows[0].id_evento;
    console.log(`✓ Evento de rifa creado: ${idEvento}`);

    // 2. Asignar rifa a todas las órdenes sin rifa
    const updateResult = await client.query(`
      UPDATE orden SET id_rifa = $1
      WHERE id_rifa IS NULL
      RETURNING id_orden
    `, [idEvento]);
    console.log(`✓ ${updateResult.rowCount} órdenes actualizadas con rifa`);

    // 3. Crear boletas para cada orden con esa rifa
    const boletasResult = await client.query(`
      INSERT INTO rifa (id_evento_rifa, numero_boleta, nombre, telefono, placa_vehiculo)
      SELECT
        $1,
        CONCAT('BL-', o.id_orden),
        o.nombre_cliente,
        o.telefono_cliente,
        o.placa_vehiculo
      FROM orden o
      WHERE o.id_rifa = $1
        AND NOT EXISTS (
          SELECT 1 FROM rifa r
          WHERE r.id_evento_rifa = $1
            AND r.numero_boleta = CONCAT('BL-', o.id_orden)
        )
      RETURNING id_boleta
    `, [idEvento]);
    console.log(`✓ ${boletasResult.rowCount} boletas creadas`);

    await client.query('COMMIT');

    res.json({
      success: true,
      eventoRifaId: idEvento,
      ordenesActualizadas: updateResult.rowCount,
      boletasCreadas: boletasResult.rowCount,
      mensaje: 'Setup de rifa completado exitosamente'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en setup rifa:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

/**
 * Obtener datos del recibo en JSON
 * GET /api/recibos/datos/:token?placa=ABC123
 */
router.get('/datos/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { placa } = req.query;

    console.log(`📥 ENDPOINT DATOS RECIBO - Solicitud recibida`);
    console.log(`   Token: ${token ? token.substring(0, 20) + '...' : 'NO'}`);
    console.log(`   Placa: ${placa || 'NO'}`);

    // Validar token
    let orden = await validarTokenRecibo(token, placa);
    console.log(`   Validación inicial: ${orden ? '✅ EXITOSA' : '❌ FALLÓ'}`);

    // Si no hay orden válida con token, intentar generar uno nuevo para esa placa/token
    // El token podría ser una orden ID en formato numérico
    if (!orden && token && !isNaN(token)) {
      console.log(`   ℹ️ Intentando generar token para orden ${token}`);
      const { generarTokenRecibo } = await import('../services/reciboToken.service.js');
      const nuevoToken = await generarTokenRecibo(parseInt(token), placa);
      if (nuevoToken) {
        console.log(`   ✅ Token generado: ${nuevoToken.substring(0, 20)}...`);
        // Validar el nuevo token
        orden = await validarTokenRecibo(nuevoToken, placa);
      }
    }

    if (!orden) {
      return res.status(401).json({
        error: 'Token inválido, expirado o ya descargado'
      });
    }

    // Obtener datos completos de la orden
    const result = await pool.query(
      `SELECT
        o.*,
        COALESCE(SUM(d.cantidad * d.precio_servicio_aplicado), 0) as total_orden,
        COALESCE(
          json_agg(
            json_build_object(
              'servicio', s.nombre_servicio,
              'cantidad', d.cantidad,
              'precio_unitario', d.precio_servicio_aplicado,
              'subtotal', (d.cantidad * d.precio_servicio_aplicado)
            )
          ) FILTER (WHERE d.id_servicio IS NOT NULL),
          '[]'::json
        ) as lista_servicios
       FROM orden o
       LEFT JOIN detalle_orden_venta d ON o.id_orden = d.id_orden
       LEFT JOIN servicio s ON d.id_servicio = s.id_servicio
       WHERE o.id_orden = $1
       GROUP BY o.id_orden`,
      [orden.id_orden]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    const ordenData = result.rows[0];

    // 📥 Registrar descarga (solo cuando acceden, no cuando solo obtienen datos)
    const ipCliente = req.ip || req.connection.remoteAddress;
    await marcarTokenComoDescargado(token, ipCliente);

    // Retornar JSON con todos los datos
    res.json({
      success: true,
      orden: {
        id_orden: ordenData.id_orden,
        fecha: ordenData.fecha,
        nombre_cliente: ordenData.nombre_cliente,
        placa_vehiculo: ordenData.placa_vehiculo,
        marca_vehiculo: ordenData.marca_vehiculo,
        modelo_vehiculo: ordenData.modelo_vehiculo,
        total: ordenData.total_orden,
        estado: ordenData.estado,
        servicios: ordenData.lista_servicios
      }
    });

  } catch (error) {
    console.error('Error obteniendo datos de recibo:', error);
    res.status(500).json({ error: 'Error obteniendo recibo' });
  }
});

/**
 * Descargar recibo como HTML (legacy - para compatibilidad)
 * GET /api/recibos/descargar/:token?placa=ABC123
 */
router.get('/descargar/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { placa } = req.query;

    console.log(`📥 ENDPOINT RECIBOS - Solicitud recibida`);
    console.log(`   Token: ${token ? token.substring(0, 20) + '...' : 'NO'}`);
    console.log(`   Placa: ${placa || 'NO'}`);

    // Validar token
    const orden = await validarTokenRecibo(token, placa);
    console.log(`   Validación: ${orden ? '✅ EXITOSA' : '❌ FALLÓ'}`);

    if (!orden) {
      return res.status(401).json({
        error: 'Token inválido, expirado o ya descargado'
      });
    }

    // Obtener datos completos de la orden para el recibo
    const result = await pool.query(
      `SELECT
        o.*,
        COALESCE(SUM(d.cantidad * d.precio_servicio_aplicado), 0) as total_orden,
        COALESCE(
          json_agg(
            json_build_object(
              'servicio', s.nombre_servicio,
              'cantidad', d.cantidad,
              'precio_unitario', d.precio_servicio_aplicado,
              'subtotal', (d.cantidad * d.precio_servicio_aplicado)
            )
          ) FILTER (WHERE d.id_servicio IS NOT NULL),
          '[]'::json
        ) as lista_servicios
       FROM orden o
       LEFT JOIN detalle_orden_venta d ON o.id_orden = d.id_orden
       LEFT JOIN servicio s ON d.id_servicio = s.id_servicio
       WHERE o.id_orden = $1
       GROUP BY o.id_orden`,
      [orden.id_orden]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    const ordenData = result.rows[0];

    // Generar HTML del recibo
    const html = generarHTMLRecibo(ordenData);

    // Registrar descarga
    const ipCliente = req.ip || req.connection.remoteAddress;
    await marcarTokenComoDescargado(token, ipCliente);

    // 📄 Retornar HTML para visualizar en la página (no descargar)
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // NO usar Content-Disposition: attachment para que se muestre en la página
    res.send(html);

  } catch (error) {
    console.error('Error descargando recibo:', error);
    res.status(500).json({ error: 'Error descargando recibo' });
  }
});

/**
 * Generar HTML del recibo (puede convertirse a PDF con librería externa)
 */
const generarHTMLRecibo = (orden) => {
  const fecha = new Date(orden.fecha).toLocaleDateString('es-CO');
  const total = orden.total_orden || 0;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recibo - The Detailer</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
    .toolbar { text-align: center; margin-bottom: 20px; }
    .btn-descargar {
      background: #2c3e50;
      color: white;
      padding: 12px 30px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
      font-weight: bold;
    }
    .btn-descargar:hover { background: #34495e; }
    .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    @media print { .toolbar { display: none; } }
    .header { text-align: center; border-bottom: 3px solid #2c3e50; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #2c3e50; font-size: 28px; margin-bottom: 5px; }
    .header p { color: #7f8c8d; font-size: 14px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
    .info-box { padding: 15px; background: #ecf0f1; border-radius: 4px; }
    .info-box strong { display: block; color: #2c3e50; margin-bottom: 5px; }
    .info-box span { color: #34495e; font-size: 14px; }
    .servicios { margin: 30px 0; }
    .servicios h3 { color: #2c3e50; margin-bottom: 15px; border-bottom: 2px solid #ecf0f1; padding-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #34495e; color: white; padding: 10px; text-align: left; }
    td { padding: 10px; border-bottom: 1px solid #ecf0f1; }
    .total-row { background: #ecf0f1; font-weight: bold; color: #2c3e50; font-size: 16px; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ecf0f1; color: #7f8c8d; font-size: 12px; }
    .estado { display: inline-block; padding: 8px 15px; border-radius: 4px; font-weight: bold; margin-top: 10px; }
    .estado.lista { background: #27ae60; color: white; }
    .estado.finalizada { background: #2980b9; color: white; }
    .estado.proceso { background: #f39c12; color: white; }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="btn-descargar" onclick="descargarPDF()">📥 Descargar como PDF</button>
  </div>

  <div class="container" id="recibo">
    <div class="header">
      <h1>🚗 The Detailer</h1>
      <p>Recibo de Orden de Servicio</p>
    </div>

    <div class="info-grid">
      <div class="info-box">
        <strong>Número de Orden</strong>
        <span>#${orden.id_orden}</span>
      </div>
      <div class="info-box">
        <strong>Fecha</strong>
        <span>${fecha}</span>
      </div>
      <div class="info-box">
        <strong>Cliente</strong>
        <span>${orden.nombre_cliente || 'N/A'}</span>
      </div>
      <div class="info-box">
        <strong>Vehículo</strong>
        <span>${orden.placa_vehiculo} - ${orden.marca_vehiculo} ${orden.modelo_vehiculo}</span>
      </div>
    </div>

    <div class="servicios">
      <h3>Servicios Realizados</h3>
      <table>
        <thead>
          <tr>
            <th>Servicio</th>
            <th style="text-align: center;">Cantidad</th>
            <th style="text-align: right;">Precio Unitario</th>
            <th style="text-align: right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${orden.lista_servicios.map(s => `
            <tr>
              <td>${s.servicio}</td>
              <td style="text-align: center;">${s.cantidad}</td>
              <td style="text-align: right;">$${s.precio_unitario.toLocaleString('es-CO')}</td>
              <td style="text-align: right;">$${s.subtotal.toLocaleString('es-CO')}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="3" style="text-align: right;">TOTAL:</td>
            <td style="text-align: right;">$${total.toLocaleString('es-CO')}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <span class="estado ${orden.estado.toLowerCase().replace(' ', '-')}">${orden.estado}</span>
    </div>

    <div class="footer">
      <p>📍 The Detailer | ⏰ Lunes-Viernes 8am-6pm</p>
      <p>Gracias por confiar en nosotros 🙏</p>
      <p style="margin-top: 15px; font-size: 11px; color: #95a5a6;">
        Este recibo fue generado digitalmente. Para cualquier duda, contáctanos.
      </p>
    </div>
  </div>

  <script>
    function descargarPDF() {
      const elemento = document.getElementById('recibo');
      const opt = {
        margin: 10,
        filename: '${orden.placa_vehiculo || 'recibo'}.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
      };

      html2pdf().set(opt).from(elemento).save();
    }
  </script>
</body>
</html>
  `;
};

export default router;
