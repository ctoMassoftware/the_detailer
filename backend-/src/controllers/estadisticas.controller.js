export const getReporteOperativo = async (req, res) => {
    // Mock de datos, reemplaza con lógica real si lo necesitas
    res.json({
        ventas: { total_ordenes: '10', total_ventas: '500000' },
        inventario: { total_insumos: '20', stock_total: '100', alertas_stock: '2' },
        pagos: { total_pagos: '5', total_pagado: '200000' }
    });
};
import { pool } from '../config/db.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export const getResumenDashboard = async (req, res) => {
    const { sede } = req.query;
    const { rol, sede: sedeUsuario } = req.user;
    const esAdminGlobal = rol === 'SUPER_ADMIN' || rol === 'ADMIN';
    try {
        const client = await pool.connect();
        try {
            // Si es SUPER_ADMIN, armar metricas_sedes para todas las sedes
            let metricas_sedes = [];
            if (esAdminGlobal) {
                // Obtener lista de sedes distintas en órdenes y ventas mostrador
                const sedesResult = await client.query(`
                    SELECT DISTINCT sede FROM (
                        SELECT sede FROM public.orden WHERE sede IS NOT NULL
                        UNION
                        SELECT sede FROM public.venta_mostrador WHERE sede IS NOT NULL
                    ) s
                `);
                const sedes = sedesResult.rows.map(r => r.sede);
                // Filtro de rango de fechas
                let fechaDesde = req.query.fecha_desde || new Date().toISOString().split('T')[0];
                let fechaHasta = req.query.fecha_hasta || fechaDesde;
                for (const sedeNombre of sedes) {
                    // Total servicios (órdenes finalizadas en el rango)
                    const totalServiciosRes = await client.query(
                        `SELECT COUNT(*) FROM public.orden WHERE sede = $1 AND fecha >= $2 AND fecha <= $3 AND estado != 'ANULADA'`,
                        [sedeNombre, fechaDesde, fechaHasta]
                    );
                    // Operarios activos en la sede
                    const operariosActivosRes = await client.query(
                        `SELECT COUNT(*) FROM public.usuarios WHERE sede = $1 AND estado_operario = TRUE AND rol = 'OPERARIO'`,
                        [sedeNombre]
                    );
                    // Comisión lavadero (60% de ventas en servicios en el rango)
                    const comisionRes = await client.query(
                        `SELECT COALESCE(SUM(d.cantidad * d.precio_servicio_aplicado),0) as total FROM public.orden o JOIN public.detalle_orden_venta d ON o.id_orden = d.id_orden WHERE o.sede = $1 AND o.fecha >= $2 AND o.fecha <= $3 AND o.estado != 'ANULADA'`,
                        [sedeNombre, fechaDesde, fechaHasta]
                    );
                    const comision_lavadero = Math.round(Number(comisionRes.rows[0].total || 0) * 0.6);
                    // Ventas mostrador en el rango
                    const ventasMostradorRes = await client.query(
                        `SELECT COALESCE(SUM(total),0) as total FROM public.venta_mostrador WHERE sede = $1 AND fecha >= $2 AND fecha <= $3`,
                        [sedeNombre, fechaDesde, fechaHasta]
                    );
                    const ventas_mostrador = Math.round(Number(ventasMostradorRes.rows[0].total || 0));
                    // Ganancia total del rango
                    const ganancia_total_dia = comision_lavadero + ventas_mostrador;
                    metricas_sedes.push({
                        sede_nombre: sedeNombre,
                        total_servicios: Number(totalServiciosRes.rows[0].count),
                        operarios_activos: Number(operariosActivosRes.rows[0].count),
                        comision_lavadero,
                        ventas_mostrador,
                        ganancia_total_dia
                    });
                }
            }

            // Lógica original para ventas y top_servicios (puede quedarse igual)
            let ventasQuery = `
                SELECT 
                    COALESCE(SUM(CASE WHEN o.fecha = CURRENT_DATE THEN d.cantidad * d.precio_servicio_aplicado ELSE 0 END), 0) as ventas_dia,
                    COALESCE(SUM(CASE WHEN o.fecha >= date_trunc('week', CURRENT_DATE) THEN d.cantidad * d.precio_servicio_aplicado ELSE 0 END), 0) as ventas_semana,
                    COALESCE(SUM(CASE WHEN o.fecha >= date_trunc('month', CURRENT_DATE) THEN d.cantidad * d.precio_servicio_aplicado ELSE 0 END), 0) as ventas_mes
                FROM public.orden o
                JOIN public.detalle_orden_venta d ON o.id_orden = d.id_orden
                WHERE o.estado != 'ANULADA'
            `;
            let params = [];
            if (!esAdminGlobal) {
                ventasQuery += ' AND o.sede = $1';
                params.push(sedeUsuario);
            } else if (sede) {
                ventasQuery += ' AND o.sede = $1';
                params.push(sede);
            }
            const ventasResult = await client.query(ventasQuery, params);

            let topServiciosQuery = `
                SELECT 
                    s.nombre_servicio,
                    s.tipo,
                    SUM(d.cantidad) as total_vendido,
                    SUM(d.cantidad * d.precio_servicio_aplicado) as total_ingresos
                FROM public.detalle_orden_venta d
                JOIN public.servicio s ON d.id_servicio = s.id_servicio
                JOIN public.orden o ON d.id_orden = o.id_orden
                WHERE o.fecha >= date_trunc('month', CURRENT_DATE)
            `;
            let params2 = [];
            if (!esAdminGlobal) {
                topServiciosQuery += ' AND o.sede = $1';
                params2.push(sedeUsuario);
            } else if (sede) {
                topServiciosQuery += ' AND o.sede = $1';
                params2.push(sede);
            }
            topServiciosQuery += ` GROUP BY s.nombre_servicio, s.tipo ORDER BY total_vendido DESC LIMIT 5`;
            const topServiciosResult = await client.query(topServiciosQuery, params2);

            res.json({
                ventas: {
                    dia: parseFloat(ventasResult.rows[0].ventas_dia),
                    semana: parseFloat(ventasResult.rows[0].ventas_semana),
                    mes: parseFloat(ventasResult.rows[0].ventas_mes)
                },
                top_servicios: topServiciosResult.rows,
                metricas_sedes: metricas_sedes.length > 0 ? metricas_sedes : undefined
            });

        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({ error: 'Error interno al calcular estadísticas' });
    }
};

export const getVentasDiariasMes = async (req, res) => {
    const { sede } = req.query;
    const { rol, sede: sedeUsuario } = req.user;
    const esAdminGlobal = rol === 'SUPER_ADMIN' || rol === 'ADMIN';
    try {
        let query = `
            SELECT 
                to_char(o.fecha, 'YYYY-MM-DD') as fecha,
                SUM(d.cantidad * d.precio_servicio_aplicado) as total
            FROM public.orden o
            JOIN public.detalle_orden_venta d ON o.id_orden = d.id_orden
            WHERE o.fecha >= date_trunc('month', CURRENT_DATE)
        `;
        let params = [];
        if (!esAdminGlobal) {
            query += ' AND o.sede = $1';
            params.push(sedeUsuario);
        } else if (sede) {
            query += ' AND o.sede = $1';
            params.push(sede);
        }
        query += ' GROUP BY o.fecha ORDER BY o.fecha ASC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo gráfica de ventas' });
    }
};

// Utilidad para convertir datos a CSV
function toCSV(data) {
    if (!data || !data.length) return '';
    const keys = Object.keys(data[0]);
    const header = keys.join(',');
    const rows = data.map(row => keys.map(k => '"' + (row[k] ?? '') + '"').join(','));
    return [header, ...rows].join('\n');
}

// Controlador para exportar reportes
export const exportarReporte = async (req, res) => {
    const { tipo, formato } = req.query;
    let query = '';
    let join = '';
    let filename = `${tipo}_reporte.${formato}`;
    let data = [];
    let headers = null;
    try {
        switch (tipo) {
            case 'ventas': {
                const { sede } = req.query;
                const { rol, sede: sedeUsuario } = req.user;
                const esAdminGlobal = rol === 'SUPER_ADMIN' || rol === 'ADMIN';
                query = `SELECT o.id_orden, o.fecha, o.estado, d.cantidad, d.precio_servicio_aplicado, s.nombre_servicio FROM public.orden o JOIN public.detalle_orden_venta d ON o.id_orden = d.id_orden JOIN public.servicio s ON d.id_servicio = s.id_servicio`;
                let params = [];
                if (!esAdminGlobal) {
                    query += ` WHERE o.sede = $1`;
                    params.push(sedeUsuario);
                } else if (sede) {
                    query += ` WHERE o.sede = $1`;
                    params.push(sede);
                }
                query += ` ORDER BY o.fecha DESC LIMIT 100`;
                data = (await pool.query(query, params)).rows;
                break;
            }
            case 'inventario': {
                const { sede } = req.query;
                const { rol, sede: sedeUsuario } = req.user;
                const esAdminGlobal = rol === 'SUPER_ADMIN' || rol === 'ADMIN';
                query = `SELECT id_producto, nombre_producto, proveedor, categoria, ubicacion, costo, cantidad, stock_minimo, sede FROM public.inventario_producto`;
                let params = [];
                if (!esAdminGlobal) {
                    query += ` WHERE sede = $1`;
                    params.push(sedeUsuario);
                } else if (sede) {
                    query += ` WHERE sede = $1`;
                    params.push(sede);
                }
                query += ` ORDER BY nombre_producto ASC`;
                data = (await pool.query(query, params)).rows;
                headers = [
                    { label: 'ID', property: 'id_producto', width: 35 },
                    { label: 'Producto', property: 'nombre_producto', width: 110 },
                    { label: 'Proveedor', property: 'proveedor', width: 80 },
                    { label: 'Categoría', property: 'categoria', width: 65 },
                    { label: 'Ubicación', property: 'ubicacion', width: 80 },
                    { label: 'Costo', property: 'costo', width: 65, format: v => v ? `$${Number(v).toLocaleString('es-CO')}` : '' },
                    { label: 'Cantidad', property: 'cantidad', width: 55 },
                    { label: 'Stock Mínimo', property: 'stock_minimo', width: 65 },
                    { label: 'Sede', property: 'sede', width: 80 }
                ];
                break;
            }
            case 'pagos': {
                const { sede } = req.query;
                const { rol, sede: sedeUsuario } = req.user;
                const esAdminGlobal = rol === 'SUPER_ADMIN' || rol === 'ADMIN';
                query = `SELECT p.id_pago, u.nombre AS nombre_operario, p.monto, p.metodo_pago, p.fecha_pago, p.observacion, p.sede FROM public.pago_operario p JOIN public.usuarios u ON p.id_operario = u.id_user`;
                let params = [];
                if (!esAdminGlobal) {
                    query += ` WHERE p.sede = $1`;
                    params.push(sedeUsuario);
                } else if (sede) {
                    query += ` WHERE p.sede = $1`;
                    params.push(sede);
                }
                query += ` ORDER BY p.fecha_pago DESC LIMIT 100`;
                data = (await pool.query(query, params)).rows;
                headers = [
                    { label: 'ID Pago', property: 'id_pago', width: 50 },
                    { label: 'Operario', property: 'nombre_operario', width: 110 },
                    { label: 'Monto', property: 'monto', width: 70, format: v => v ? `$${Number(v).toLocaleString('es-CO')}` : '' },
                    { label: 'Método de Pago', property: 'metodo_pago', width: 90 },
                    { label: 'Fecha de Pago', property: 'fecha_pago', width: 90 },
                    { label: 'Observación', property: 'observacion', width: 140 },
                    { label: 'Sede', property: 'sede', width: 80 }
                ];
                break;
            }
            case 'comisiones': {
                const { sede } = req.query;
                const { rol, sede: sedeUsuario } = req.user;
                const esAdminGlobal = rol === 'SUPER_ADMIN' || rol === 'ADMIN';
                query = `SELECT c.id_comision, c.id_orden, u.nombre AS nombre_operario, c.porcentaje_aplicado, c.monto_comision, c.estado, c.created_at FROM public.comision_orden_operario c JOIN public.usuarios u ON c.id_operario = u.id_user`;
                let params = [];
                if (!esAdminGlobal) {
                    query += ` WHERE c.sede = $1`;
                    params.push(sedeUsuario);
                } else if (sede) {
                    query += ` WHERE c.sede = $1`;
                    params.push(sede);
                }
                query += ` ORDER BY c.created_at DESC LIMIT 100`;
                data = (await pool.query(query, params)).rows;
                break;
            }
            default:
                return res.status(400).json({ error: 'Tipo de reporte no soportado' });
        }
        // No volver a ejecutar la consulta, ya se hizo arriba y data contiene los datos correctos
        if (formato === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            return res.send(toCSV(data));
        } else if (formato === 'excel' || formato === 'xlsx') {
            // Exportación real a Excel usando exceljs
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Reporte');
            if (data.length > 0) {
                worksheet.columns = headers
                    ? headers.map(h => ({ header: h.label, key: h.property }))
                    : Object.keys(data[0]).map(key => ({ header: key, key }));
                data.forEach(row => worksheet.addRow(row));
            }
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${tipo}_reporte.xlsx"`);
            await workbook.xlsx.write(res);
            res.end();
            return;
        } else if (formato === 'pdf') {
            // PDF con estilos avanzados
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${tipo}_reporte.pdf"`);
            // Cambia la orientación a landscape (horizontal)
            const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
            doc.pipe(res);
            const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
            // Cabecera negra (más alta y con saltos de línea automáticos)
            const headerHeight = 60;
            const headerY = doc.y;
            doc.rect(doc.page.margins.left, headerY, pageWidth, headerHeight).fill('#181B20');
            doc.fillColor('white').font('Helvetica-Bold').fontSize(24);
            const title = `Reporte ${tipo.toUpperCase()}`;
            doc.text(title, doc.page.margins.left + 10, headerY + 10, {
                width: pageWidth - 20,
                align: 'left',
                continued: false
            });
            doc.fontSize(10).fillColor('white');
            const fechaTexto = `Generado: ${new Date().toLocaleString()}`;
            doc.text(fechaTexto, doc.page.margins.left + 10, headerY + 38, {
                width: pageWidth - 20,
                align: 'left',
                continued: false
            });
            doc.y = headerY + headerHeight;
            doc.moveDown(0.5);
            // Línea roja
            doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.margins.left + pageWidth, doc.y).lineWidth(4).stroke('#F71C1C');
            doc.moveDown(1);
            if (data.length > 0) {
                // Usar headers si están definidos, si no usar las keys del primer objeto
                let cols = headers || Object.keys(data[0]).map(k => ({ label: k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), property: k }));
                // Validar que todas las propiedades de headers existan en los datos
                cols = cols.filter(h => data[0].hasOwnProperty(h.property));
                // Calcular anchos proporcionales
                const totalWidth = cols.reduce((acc, h) => acc + (h.width || 1), 0);
                const colWidths = cols.map(h => h.width ? Math.floor((h.width / totalWidth) * pageWidth) : Math.floor(pageWidth / cols.length));
                let tableY = doc.y + 10;
                // Encabezado rojo
                doc.rect(doc.page.margins.left, tableY, pageWidth, 22).fill('#F71C1C');
                doc.fillColor('white').font('Helvetica-Bold').fontSize(11);
                let x = doc.page.margins.left;
                cols.forEach((h, i) => {
                    doc.text(h.label, x + 4, tableY + 5, { width: colWidths[i] - 8, align: 'center', continued: false });
                    x += colWidths[i];
                });
                // Filas de datos
                let rowY = tableY + 22;
                data.forEach((row, idx) => {
                    doc.font('Helvetica').fontSize(10);
                    const cellHeights = cols.map((h, i) => {
                        const text = String(row[h.property] ?? '');
                        return doc.heightOfString(text, { width: colWidths[i] - 8, align: 'center' });
                    });
                    const maxCellHeight = Math.max(...cellHeights, 20);
                    if (idx % 2 === 0) {
                        doc.rect(doc.page.margins.left, rowY, pageWidth, maxCellHeight + 8).fill('#232733');
                    } else {
                        doc.rect(doc.page.margins.left, rowY, pageWidth, maxCellHeight + 8).fill('#181B20');
                    }
                    x = doc.page.margins.left;
                    doc.fillColor('white').font('Helvetica').fontSize(10);
                    cols.forEach((h, i) => {
                        let text = String(row[h.property] ?? '');
                        // Formato especial para la columna Fecha
                        if (h.property.toLowerCase().includes('fecha')) {
                            const date = new Date(text);
                            if (!isNaN(date.getTime())) {
                                const day = String(date.getDate()).padStart(2, '0');
                                const month = String(date.getMonth() + 1).padStart(2, '0');
                                const year = date.getFullYear();
                                let hours = date.getHours();
                                const minutes = String(date.getMinutes()).padStart(2, '0');
                                const ampm = hours >= 12 ? 'PM' : 'AM';
                                hours = hours % 12;
                                hours = hours ? hours : 12;
                                text = `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
                            }
                        }
                        // Formato especial para columnas de costo/valor/monto/precio
                        const costoKeys = ['costo', 'precio', 'valor', 'monto', 'total', 'total_ventas', 'total_pagado', 'monto_comision', 'precio_servicio_aplicado'];
                        if (costoKeys.some(ck => h.property.toLowerCase().includes(ck))) {
                            const num = Number(text.replace(/[^\d.-]/g, ''));
                            if (!isNaN(num)) {
                                text = `$${num.toLocaleString('es-CO')}`;
                            }
                        }
                        const cellHeight = doc.heightOfString(text, { width: colWidths[i] - 8, align: 'center' });
                        const yOffset = rowY + 5 + ((maxCellHeight - cellHeight) / 2);
                        doc.text(text, x + 4, yOffset, { width: colWidths[i] - 8, align: 'center', continued: false });
                        x += colWidths[i];
                    });
                    rowY += maxCellHeight + 8;
                    if (rowY > doc.page.height - doc.page.margins.bottom - 30) {
                        doc.addPage();
                        rowY = doc.y;
                    }
                });
            } else {
                doc.moveDown(2);
                doc.font('Helvetica').fontSize(12).fillColor('black').text('No hay datos para mostrar.');
            }
            doc.end();
            return;
        } else {
            return res.status(400).json({ error: 'Formato no soportado' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error exportando reporte' });
    }
};