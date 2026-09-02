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
  historialGanadores,
  actualizarRifa,
  asignarBoletaAOrden,
  getBoletasDisponibles
} from '../controllers/rifa.controller.secured.js';
import { verifyToken } from '../controllers/auth.controller.js';
import { pool } from '../config/db.js';

const router = Router();

// 🔍 Endpoint de diagnóstico sin autenticación
router.get('/debug/estado', async (req, res) => {
  try {
    const result = await pool.query('SELECT id_evento, fecha_sorteo, descripcion_premios, encargado, estado FROM evento_rifa ORDER BY id_evento DESC');
    const activas = result.rows.filter(r => r.estado === true);
    res.json({
      debug: true,
      totalRifas: result.rows.length,
      rifasActivas: activas.length,
      rifas: result.rows,
      problema: activas.length !== 1 ? `⚠️ Hay ${activas.length} rifas activas (debe ser 1)` : '✅ Estado correcto'
    });
  } catch (error) {
    console.error('Error en debug rifa:', error);
    res.status(500).json({ error: error.message });
  }
});

// 🔧 Endpoint para REPARAR: Mantener UNA sola rifa activa
router.post('/debug/reparar', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Desactivar todas las rifas
    await client.query('UPDATE evento_rifa SET estado = false WHERE estado = true');

    // Activar solo la más reciente
    const result = await client.query(
      `UPDATE evento_rifa
       SET estado = true
       WHERE id_evento = (SELECT id_evento FROM evento_rifa ORDER BY id_evento DESC LIMIT 1)
       RETURNING id_evento, fecha_sorteo, descripcion_premios`
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      mensaje: 'Rifa única restaurada correctamente',
      rifaActiva: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error reparando rifas:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

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

// Actualizar rifa
router.put('/:id', verifyToken, actualizarRifa);

// Asignar boleta a orden (NUEVO - SEGURIZADO)
router.post('/asignar-boleta', verifyToken, asignarBoletaAOrden);

// Obtener boletas disponibles
router.get('/disponibles/:id_evento', verifyToken, getBoletasDisponibles);

router.delete('/eliminar/:id', verifyToken, eliminarRifa);

export default router;