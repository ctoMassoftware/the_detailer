import { Router } from 'express';
import { validarTokenRecibo, marcarTokenComoDescargado } from '../services/reciboToken.service.js';
import { pool } from '../config/db.js';

const router = Router();

// 🔍 Middleware de debugging - registra todas las solicitudes
router.use((req, res, next) => {
  console.log(`📍 GET /api/recibos${req.path}`);
  next();
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
