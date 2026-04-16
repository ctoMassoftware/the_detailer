import { Router } from 'express';
import {
  crearRifa,
  getRifaActiva,
  getTodasRifas,
  registrarBoleta,
  verificarNumero,
  consultarGanador,
  getBoletasPorRifa,
  eliminarRifa,
  elegirGanador,
  historialGanadores
} from '../controllers/rifa.controller.js';
import { verifyToken } from '../controllers/auth.controller.js';

const router = Router();

router.post('/crear', verifyToken, crearRifa);
router.get('/activa', verifyToken, getRifaActiva);
router.get('/historial', verifyToken, getTodasRifas);
router.post('/registrar-boleta', verifyToken, registrarBoleta);
router.get('/check/:id_evento/:numero', verifyToken, verificarNumero);
router.get('/ganador/:numero', verifyToken, consultarGanador);
router.get('/:idEvento/boletas', verifyToken, getBoletasPorRifa);

// Elegir ganador aleatorio para una rifa
router.post('/elegir-ganador', verifyToken, elegirGanador);
// Consultar historial de ganadores
router.get('/historial-ganadores', verifyToken, historialGanadores);

router.delete('/eliminar/:id', verifyToken, eliminarRifa);

export default router;