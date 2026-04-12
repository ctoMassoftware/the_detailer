import { pool } from '../config/db.js';

export const getResumenDashboard = async (req, res) => {
    const { rol, sede: sedeUsuario } = req.user; 
    const { fecha, sede: sedeFiltroQuery } = req.query; 

    const fechaFiltro = fecha || new Date().toISOString().split('T')[0];

    try {
        const client = await pool.connect();
        try {
            const esAdminGlobal = rol === 'SUPER_ADMIN' || rol === 'ADMIN';
            
            // Variables dinámicas para los filtros SQL
            let queryParamsSede = [];
            let filtroSedeUsuarios = '';
            let filtroSedeOrden = '';
            let filtroSedeMostrador = '';
            let queryParamsStats = [];

            if (!esAdminGlobal) {
                queryParamsSede = [sedeUsuario];
                filtroSedeUsuarios = 'AND sede = $1';
                filtroSedeOrden = 'AND o.sede = $2'; // $1 será la fecha
                filtroSedeMostrador = 'AND v.sede = $2'; 
                queryParamsStats = [sedeUsuario];
            } else if (esAdminGlobal && sedeFiltroQuery) {
                queryParamsSede = [sedeFiltroQuery];
                filtroSedeUsuarios = 'AND sede = $1';
                filtroSedeOrden = 'AND o.sede = $2'; 
                filtroSedeMostrador = 'AND v.sede = $2'; 
                queryParamsStats = [sedeFiltroQuery];
            }

            // 1. OBTENER SEDES Y SUS OPERARIOS (Punto de partida corregido)
            // Extraemos las sedes válidas directamente de los usuarios, así nunca faltan
            const sedesQuery = `
                SELECT 
                    sede as sede_nombre,
                    COUNT(CASE WHEN LOWER(rol) = 'operario' AND estado_operario = true THEN 1 END) as operarios_activos
                FROM public.usuarios
                WHERE sede IS NOT NULL AND sede != 'GLOBAL'
                ${filtroSedeUsuarios}
                GROUP BY sede
            `;
            const sedesResult = await client.query(sedesQuery, queryParamsSede);

            // Parámetros para las consultas de fecha (con o sin filtro de sede)
            const paramsHome = esAdminGlobal && !sedeFiltroQuery ? [fechaFiltro] : [fechaFiltro, queryParamsSede[0]];

            // 2. Métricas de Sede (Lavados de hoy)
            const metricasSedesQuery = `
                SELECT 
                    o.sede as sede_nombre,
                    COUNT(DISTINCT o.id_orden) as total_servicios,
                    COALESCE(SUM(d.cantidad * d.precio_servicio_aplicado) * 0.60, 0) as comision_lavadero
                FROM public.orden o
                LEFT JOIN public.detalle_orden_venta d ON o.id_orden = d.id_orden
                WHERE DATE(o.fecha) = $1 
                  AND o.estado != 'ANULADA'
                  AND o.sede IS NOT NULL 
                  AND o.sede != 'GLOBAL'
                ${filtroSedeOrden}
                GROUP BY o.sede
            `;
            const metricasResult = await client.query(metricasSedesQuery, paramsHome);

            // 3. GANANCIA NETA de Mostrador de hoy
            const mostradorQuery = `
                SELECT 
                    v.sede as sede_nombre, 
                    COALESCE(SUM(d.cantidad_vendida * (d.precio_unitario - COALESCE(i.costo, 0))), 0) as ventas_mostrador
                FROM public.venta_mostrador v
                JOIN public.detalle_venta_mostrador d ON v.id_venta = d.id_venta
                JOIN public.inventario_venta i ON d.id_producto_venta = i.id_producto_venta
                WHERE v.fecha = $1 
                  AND v.sede IS NOT NULL 
                  AND v.sede != 'GLOBAL'
                ${filtroSedeMostrador}
                GROUP BY v.sede
            `;
            const mostradorResult = await client.query(mostradorQuery, paramsHome);

            // CONSOLIDAR DATOS: Partimos de todas las sedes encontradas
            const sedesUnicas = new Set([
                ...sedesResult.rows.map(r => r.sede_nombre),
                ...metricasResult.rows.map(r => r.sede_nombre),
                ...mostradorResult.rows.map(r => r.sede_nombre)
            ]);

            const metricasMapeadas = Array.from(sedesUnicas).map(sede_nombre => {
                // Buscamos los datos de cada sección, si no existen en los lavados de hoy, rellenamos con 0
                const datosSede = sedesResult.rows.find(r => r.sede_nombre === sede_nombre) || { operarios_activos: 0 };
                const datosLavado = metricasResult.rows.find(r => r.sede_nombre === sede_nombre) || {
                    total_servicios: 0,
                    comision_lavadero: 0
                };
                const datosMostrador = mostradorResult.rows.find(m => m.sede_nombre === sede_nombre) || {
                    ventas_mostrador: 0
                };

                const ops = parseInt(datosSede.operarios_activos);
                const comision = parseFloat(datosLavado.comision_lavadero);
                const gananciaMostrador = parseFloat(datosMostrador.ventas_mostrador); 

                return {
                    sede_nombre: sede_nombre,
                    total_servicios: parseInt(datosLavado.total_servicios),
                    operarios_activos: ops,
                    comision_lavadero: comision,
                    ventas_mostrador: gananciaMostrador,
                    ganancia_total_dia: comision + gananciaMostrador
                };
            });

            // 4. Ventas Financieras Generales
            let filtroGeneralesOrden = '';
            if (!esAdminGlobal) {
                filtroGeneralesOrden = 'AND o.sede = $1';
            } else if (esAdminGlobal && sedeFiltroQuery) {
                filtroGeneralesOrden = 'AND o.sede = $1';
            }

            const ventasQuery = `
                SELECT 
                    COALESCE(SUM(CASE WHEN DATE(o.fecha) = CURRENT_DATE THEN d.cantidad * d.precio_servicio_aplicado ELSE 0 END), 0) as dia,
                    COALESCE(SUM(CASE WHEN o.fecha >= date_trunc('week', CURRENT_DATE) THEN d.cantidad * d.precio_servicio_aplicado ELSE 0 END), 0) as semana,
                    COALESCE(SUM(CASE WHEN o.fecha >= date_trunc('month', CURRENT_DATE) THEN d.cantidad * d.precio_servicio_aplicado ELSE 0 END), 0) as mes
                FROM public.orden o
                LEFT JOIN public.detalle_orden_venta d ON o.id_orden = d.id_orden
                WHERE o.estado != 'ANULADA' ${filtroGeneralesOrden}
            `;
            const ventasResult = await client.query(ventasQuery, queryParamsStats);

            // 5. Top Servicios
            const topServiciosQuery = `
                SELECT 
                    s.nombre_servicio,
                    s.tipo,
                    SUM(d.cantidad) as total_vendido,
                    SUM(d.cantidad * d.precio_servicio_aplicado) as total_ingresos
                FROM public.detalle_orden_venta d
                JOIN public.orden o ON d.id_orden = o.id_orden
                JOIN public.servicio s ON d.id_servicio = s.id_servicio
                WHERE o.estado != 'ANULADA' ${filtroGeneralesOrden}
                GROUP BY s.id_servicio, s.nombre_servicio, s.tipo
                ORDER BY total_vendido DESC
                LIMIT 5
            `;
            const topResult = await client.query(topServiciosQuery, queryParamsStats);

            res.json({
                fecha_consultada: fechaFiltro,
                metricas_sedes: metricasMapeadas,
                ventas: {
                    dia: parseFloat(ventasResult.rows[0].dia),
                    semana: parseFloat(ventasResult.rows[0].semana),
                    mes: parseFloat(ventasResult.rows[0].mes)
                },
                top_servicios: topResult.rows
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
    const { rol, sede: sedeUsuario } = req.user;
    const { sede: sedeFiltroQuery } = req.query; 
    
    const esAdminGlobal = rol === 'SUPER_ADMIN' || rol === 'ADMIN';
    
    let sqlSedeFiltro = '';
    let queryParams = [];

    if (!esAdminGlobal) {
        sqlSedeFiltro = 'AND o.sede = $1';
        queryParams = [sedeUsuario];
    } else if (esAdminGlobal && sedeFiltroQuery) {
        sqlSedeFiltro = 'AND o.sede = $1';
        queryParams = [sedeFiltroQuery];
    }

    try {
        const query = `
            SELECT 
                to_char(o.fecha, 'YYYY-MM-DD') as fecha,
                SUM(d.cantidad * d.precio_servicio_aplicado) as total
            FROM public.orden o
            JOIN public.detalle_orden_venta d ON o.id_orden = d.id_orden
            WHERE o.fecha >= date_trunc('month', CURRENT_DATE) AND o.estado != 'ANULADA' ${sqlSedeFiltro}
            GROUP BY o.fecha
            ORDER BY o.fecha ASC
        `;
        const result = await pool.query(query, queryParams);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo gráfica de ventas' });
    }
};