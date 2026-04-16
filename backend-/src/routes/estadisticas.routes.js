import { Router } from 'express';
import { getResumenDashboard, getVentasDiariasMes, getReporteOperativo } from '../controllers/estadisticas.controller.js';
import { verifyToken } from '../controllers/auth.controller.js';

const router = Router();


router.get('/dashboard', verifyToken, getResumenDashboard);
router.get('/ventas-diarias-mes', verifyToken, getVentasDiariasMes);
router.get('/reporte-operativo', verifyToken, getReporteOperativo);

// Exportar reportes (ventas, inventario, pagos, comisiones) en CSV, Excel o PDF
import { exportarReporte } from '../controllers/estadisticas.controller.js';
router.get('/exportar', verifyToken, exportarReporte);

export default router;