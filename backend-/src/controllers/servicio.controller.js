import { pool } from '../config/db.js';

export const getServicios = async (req, res) => {
    try {
        const response = await pool.query('SELECT * FROM public.servicio WHERE activo = true ORDER BY id_servicio ASC');
        res.status(200).json(response.rows);
    } catch (error) {
        console.error('Error getServicios:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};


export const createServicio = async (req, res) => {
    const { nombre_servicio, tipo, descripcion, precio_automovil, precio_campero, precio_camioneta, precio_moto, aplica_automovil, aplica_campero, aplica_camioneta, aplica_moto } = req.body;

    try {
        const query = `
            INSERT INTO public.servicio 
            (nombre_servicio, tipo, descripcion, precio_automovil, precio_campero, precio_camioneta, precio_moto, aplica_automovil, aplica_campero, aplica_camioneta, aplica_moto, activo)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true) RETURNING *
        `;
        const values = [
            nombre_servicio,
            tipo,
            descripcion,
            precio_automovil || 0,
            precio_campero || 0,
            precio_camioneta || 0,
            precio_moto || 0,
            aplica_automovil !== undefined ? aplica_automovil : true,
            aplica_campero !== undefined ? aplica_campero : true,
            aplica_camioneta !== undefined ? aplica_camioneta : true,
            aplica_moto !== undefined ? aplica_moto : true
        ];

        const response = await pool.query(query, values);
        res.status(201).json(response.rows[0]);
    } catch (error) {
        console.error('Error createServicio:', error);
        res.status(500).json({ error: 'Error al crear servicio' });
    }
};


export const updateServicio = async (req, res) => {
    const id = parseInt(req.params.id);
    const { nombre_servicio, tipo, descripcion, precio_automovil, precio_campero, precio_camioneta, precio_moto, aplica_automovil, aplica_campero, aplica_camioneta, aplica_moto } = req.body;

    try {
        const query = `
            UPDATE public.servicio 
            SET nombre_servicio = $1, 
                tipo = $2, 
                descripcion = $3, 
                precio_automovil = $4, 
                precio_campero = $5, 
                precio_camioneta = $6,
                precio_moto = $7,
                aplica_automovil = $8,
                aplica_campero = $9,
                aplica_camioneta = $10,
                aplica_moto = $11
            WHERE id_servicio = $12
        `;
        const values = [
            nombre_servicio,
            tipo,
            descripcion,
            precio_automovil || 0,
            precio_campero || 0,
            precio_camioneta || 0,
            precio_moto || 0,
            aplica_automovil !== undefined ? aplica_automovil : true,
            aplica_campero !== undefined ? aplica_campero : true,
            aplica_camioneta !== undefined ? aplica_camioneta : true,
            aplica_moto !== undefined ? aplica_moto : true,
            id
        ];

        await pool.query(query, values);
        res.json({ message: 'Servicio actualizado correctamente' });
    } catch (error) {
        console.error('Error updateServicio:', error);
        res.status(500).json({ error: 'Error al actualizar' });
    }
};

export const deleteServicio = async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        // SOFT DELETE: No eliminamos el registro, solo lo desactivamos.
        await pool.query('UPDATE public.servicio SET activo = false WHERE id_servicio = $1', [id]);
        res.json({ message: 'Servicio eliminado correctamente (Soft Delete)' });
    } catch (error) {
        // El error de FK ya no debería ocurrir con UPDATE, pero lo dejamos por seguridad o logs
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar' });
    }
};