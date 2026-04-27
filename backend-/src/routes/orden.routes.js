
import { Router } from 'express';
import { createOrden, getOrdenes, updateOrden, deleteOrden, notificarOrdenLista, notificarModificacion, buscarClientesPlacas } from '../controllers/orden.controller.js';
import { verifyToken } from '../controllers/auth.controller.js';

const router = Router();

router.get('/buscar-clientes-placas', verifyToken, buscarClientesPlacas);

router.post('/', verifyToken, createOrden);
router.get('/', verifyToken, getOrdenes);
router.put('/:id', verifyToken, updateOrden);
router.delete('/:id', verifyToken, deleteOrden);
router.post('/notificar', verifyToken, notificarOrdenLista);
router.post('/notificar-modificacion', verifyToken, notificarModificacion);

export default router;