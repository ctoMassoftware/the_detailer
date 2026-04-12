import { Router } from 'express';
import { getResumenDashboard, getVentasDiariasMes } from '../controllers/estadisticas.controller.js';
import { verifyToken } from '../controllers/auth.controller.js';

const router = Router();

router.get('/dashboard', verifyToken, getResumenDashboard);

router.get('/ventas-mes', verifyToken, getVentasDiariasMes);

export default router;