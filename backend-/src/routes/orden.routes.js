
import { Router } from 'express';
import { createOrden, getOrdenes, updateOrden, deleteOrden, notificarOrdenLista, notificarModificacion, buscarClientesPlacas } from '../controllers/orden.controller.js';
import { verifyToken } from '../controllers/auth.controller.js';
import { pool } from '../config/db.js';

const router = Router();

router.get('/buscar-clientes-placas', verifyToken, buscarClientesPlacas);

router.post('/', verifyToken, createOrden);
router.get('/', verifyToken, getOrdenes);
router.put('/:id', verifyToken, updateOrden);
router.delete('/:id', verifyToken, deleteOrden);
// ❌ DISABLED: SMS "Orden Lista" is sent automatically by orderStatusNotification.service.js when status changes
// router.post('/notificar', verifyToken, notificarOrdenLista);
router.post('/notificar-modificacion', verifyToken, notificarModificacion);

// ✅ NEW: Assign raffle WITHOUT changing status (no SMS triggered)
// PUT /ordenes/:id/asignar-rifa - Only updates id_rifa, does NOT trigger notifications
router.put('/:id/asignar-rifa', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { id_rifa } = req.body;

  if (id_rifa === undefined || id_rifa === null) {
    return res.status(400).json({ error: 'id_rifa es requerido' });
  }

  try {
    const result = await pool.query(
      'UPDATE public.orden SET id_rifa = $1 WHERE id_orden = $2 RETURNING id_orden, id_rifa',
      [id_rifa, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    console.log(`✅ Rifa asignada a orden ${id}: id_rifa=${id_rifa}`);
    res.json({
      success: true,
      mensaje: 'Rifa asignada correctamente (sin SMS disparado)',
      orden: result.rows[0]
    });
  } catch (error) {
    console.error('Error asignando rifa:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;