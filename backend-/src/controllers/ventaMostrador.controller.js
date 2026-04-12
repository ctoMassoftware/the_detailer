import { pool } from '../config/db.js';
import { enviarReciboMostrador } from '../services/whatsapp.service.js'; // Ajusta la ruta a tu service

export const registrarVentaMostrador = async (req, res) => {
    const { id: id_user_vendedor, sede } = req.user; 
    const { cliente_nombre, telefono_cliente, metodo_pago, total, productos } = req.body;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Insertar Cabecera
        const insertVenta = `
            INSERT INTO venta_mostrador (cliente_nombre, telefono_cliente, metodo_pago, total, sede, id_user_vendedor)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_venta, fecha, hora
        `;
        const ventaRes = await client.query(insertVenta, [
            cliente_nombre || 'Cliente General', telefono_cliente, metodo_pago, total, sede, id_user_vendedor
        ]);
        const idVenta = ventaRes.rows[0].id_venta;

        // 2. Insertar Detalles y Descontar Inventario
        for (let prod of productos) {
            
            await client.query(`
                INSERT INTO detalle_venta_mostrador (id_venta, id_producto_venta, cantidad_vendida, precio_unitario, subtotal)
                VALUES ($1, $2, $3, $4, $5)
            `, [idVenta, prod.id_producto_venta, prod.cantidad, prod.precio_venta, (prod.cantidad * prod.precio_venta)]);

            // Descontar inventario validando stock mínimo (La columna de tu DB se llama 'cantidad')
            const stockRes = await client.query(`
                UPDATE inventario_venta 
                SET cantidad = cantidad - $1 
                WHERE id_producto_venta = $2 AND cantidad >= $1 RETURNING cantidad
            `, [prod.cantidad, prod.id_producto_venta]);

            if (stockRes.rowCount === 0) {
                throw new Error(`Stock insuficiente para el producto: ${prod.nombre_producto}`);
            }
        }

        await client.query('COMMIT');

        // 3. Disparar WhatsApp (No bloquea la respuesta si el API de Twilio demora)
        if (telefono_cliente) {
            enviarReciboMostrador(cliente_nombre, telefono_cliente, sede, total, productos).catch(console.error);
        }

        res.status(201).json({ message: 'Venta registrada con éxito', id_venta: idVenta });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en venta de mostrador:', error);
        res.status(500).json({ error: error.message || 'Error al procesar la venta' });
    } finally {
        client.release();
    }
};

export const getHistorialMostrador = async (req, res) => {
    const { rol, sede: sedeUsuario } = req.user;
    const { fecha, sede: sedeFiltroQuery } = req.query;

    const fechaFiltro = fecha || new Date().toISOString().split('T')[0];
    const esAdminGlobal = rol === 'SUPER_ADMIN' || rol === 'ADMIN';

    let sqlSedeFiltro = '';
    let params = [fechaFiltro];

    if (!esAdminGlobal) {
        sqlSedeFiltro = 'AND v.sede = $2';
        params.push(sedeUsuario);
    } else if (esAdminGlobal && sedeFiltroQuery) {
        sqlSedeFiltro = 'AND v.sede = $2';
        params.push(sedeFiltroQuery);
    }

    try {
        const query = `
            SELECT v.*, u.nombre as vendedor_nombre 
            FROM venta_mostrador v
            LEFT JOIN usuarios u ON v.id_user_vendedor = u.id_user
            WHERE v.fecha = $1 ${sqlSedeFiltro}
            ORDER BY v.hora DESC
        `;
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error obteniendo historial:', error);
        res.status(500).json({ error: 'Error al consultar el cuaderno de recibos' });
    }
};