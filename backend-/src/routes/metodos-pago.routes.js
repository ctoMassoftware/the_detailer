import { Router } from 'express';
import { pool } from '../config/db.js';

const router = Router();

/**
 * GET /api/metodos-pago
 * Obtener todos los métodos de pago activos
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_metodo, nombre, descripcion, activo, orden
       FROM metodos_pago
       ORDER BY orden ASC`
    );

    res.json({
      success: true,
      metodos: result.rows
    });
  } catch (error) {
    console.error('Error obteniendo métodos de pago:', error);
    res.status(500).json({ error: 'Error obteniendo métodos de pago' });
  }
});

/**
 * GET /api/metodos-pago/activos
 * Obtener solo los métodos de pago ACTIVOS (para UI)
 */
router.get('/activos', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_metodo, nombre, descripcion
       FROM metodos_pago
       WHERE activo = true
       ORDER BY orden ASC`
    );

    res.json({
      success: true,
      metodos: result.rows.map(m => ({
        id: m.id_metodo,
        nombre: m.nombre,
        descripcion: m.descripcion
      }))
    });
  } catch (error) {
    console.error('Error obteniendo métodos de pago activos:', error);
    res.status(500).json({ error: 'Error obteniendo métodos de pago' });
  }
});

/**
 * PUT /api/metodos-pago/:id
 * Activar/desactivar método de pago (solo admin)
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { activo } = req.body;

    if (typeof activo !== 'boolean') {
      return res.status(400).json({ error: 'activo debe ser boolean' });
    }

    const result = await pool.query(
      `UPDATE metodos_pago
       SET activo = $1, fecha_actualizacion = CURRENT_TIMESTAMP
       WHERE id_metodo = $2
       RETURNING *`,
      [activo, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Método de pago no encontrado' });
    }

    res.json({
      success: true,
      mensaje: `Método de pago ${activo ? 'activado' : 'desactivado'}`,
      metodo: result.rows[0]
    });
  } catch (error) {
    console.error('Error actualizando método de pago:', error);
    res.status(500).json({ error: 'Error actualizando método de pago' });
  }
});

/**
 * GET /api/metodos-pago/nombre/:nombre
 * Verificar si un método de pago está activo
 */
router.get('/nombre/:nombre', async (req, res) => {
  try {
    const { nombre } = req.params;

    const result = await pool.query(
      `SELECT id_metodo, nombre, activo
       FROM metodos_pago
       WHERE LOWER(nombre) = LOWER($1)`,
      [nombre]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Método de pago no encontrado' });
    }

    res.json({
      success: true,
      metodo: result.rows[0]
    });
  } catch (error) {
    console.error('Error verificando método de pago:', error);
    res.status(500).json({ error: 'Error verificando método de pago' });
  }
});

export default router;
