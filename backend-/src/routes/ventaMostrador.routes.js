import { Router } from 'express';
import { 
    registrarVentaMostrador, 
    getHistorialMostrador 
} from '../controllers/ventaMostrador.controller.js';
import { verifyToken } from '../controllers/auth.controller.js';

const router = Router();

// POST: Para la Card 1 (Registrar venta y descontar stock)
router.post('/', verifyToken, registrarVentaMostrador);

// GET: Para la Card 2 (Historial / Cuaderno de recibos)
router.get('/historial', verifyToken, getHistorialMostrador);

export default router;