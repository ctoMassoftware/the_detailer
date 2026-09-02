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

// 🔧 Endpoint masivo: Vincular TODAS las boletas a sus ventas/órdenes
router.post('/debug/vincular-todas-boletas', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Obtener rifa activa
    const rifaActiva = await client.query('SELECT id_evento FROM evento_rifa WHERE estado = true LIMIT 1');
    if (rifaActiva.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No hay rifa activa' });
    }
    const idEvento = rifaActiva.rows[0].id_evento;

    let ventasActualizadas = 0;
    let ordenesActualizadas = 0;
    let boletasNoVinculadas = 0;

    // Obtener TODAS las boletas de la rifa activa
    const boletasRes = await client.query(
      `SELECT id_boleta, numero_boleta, nombre, telefono, placa_vehiculo
       FROM rifa WHERE id_evento_rifa = $1 ORDER BY id_boleta ASC`,
      [idEvento]
    );

    // Para cada boleta, intentar vincularla
    for (const boleta of boletasRes.rows) {
      if (boleta.placa_vehiculo === 'N/A') {
        // Es VENTA DE MOSTRADOR - buscar por nombre + teléfono
        const ventaRes = await client.query(
          `SELECT id_venta FROM venta_mostrador
           WHERE cliente_nombre ILIKE $1 AND telefono_cliente = $2
           ORDER BY fecha DESC LIMIT 1`,
          [boleta.nombre, boleta.telefono]
        );

        if (ventaRes.rows.length > 0) {
          await client.query(
            `UPDATE venta_mostrador
             SET id_rifa = $1, id_boleta = $2, numero_rifa = $3
             WHERE id_venta = $4`,
            [idEvento, boleta.id_boleta, boleta.numero_boleta, ventaRes.rows[0].id_venta]
          );
          ventasActualizadas++;
        } else {
          boletasNoVinculadas++;
        }
      } else {
        // Es ORDEN DE SERVICIO - buscar por placa + nombre + teléfono
        const ordenRes = await client.query(
          `SELECT id_orden FROM public.orden
           WHERE placa_vehiculo = $1 AND nombre_cliente ILIKE $2 AND telefono_cliente = $3
           ORDER BY fecha DESC LIMIT 1`,
          [boleta.placa_vehiculo, boleta.nombre, boleta.telefono]
        );

        if (ordenRes.rows.length > 0) {
          await client.query(
            `UPDATE public.orden
             SET id_rifa = $1
             WHERE id_orden = $2`,
            [idEvento, ordenRes.rows[0].id_orden]
          );
          ordenesActualizadas++;
        } else {
          boletasNoVinculadas++;
        }
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      mensaje: 'Boletas vinculadas a ventas y órdenes',
      resumen: {
        ventasActualizadas,
        ordenesActualizadas,
        boletasNoVinculadas,
        totalBoletas: boletasRes.rows.length
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error vinculando boletas:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// 🔧 Endpoint para asignar boleta a una venta específica
router.post('/debug/asignar-boleta-venta/:id_venta/:numero_boleta', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id_venta, numero_boleta } = req.params;
    const numeroFormatted = numero_boleta.toString().padStart(3, '0');

    await client.query('BEGIN');

    // Obtener la boleta
    const boletaRes = await client.query(
      `SELECT id_boleta, id_evento_rifa, fecha_sorteo FROM rifa
       WHERE numero_boleta = $1 AND id_evento_rifa IN (SELECT id_evento FROM evento_rifa WHERE estado = true)`,
      [numeroFormatted]
    );

    if (boletaRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Boleta ${numeroFormatted} no encontrada en rifa activa` });
    }

    const boleta = boletaRes.rows[0];

    // Asignar a venta
    const updateRes = await client.query(
      `UPDATE venta_mostrador
       SET id_rifa = $1, id_boleta = $2, numero_rifa = $3, fecha_sorteo = $4
       WHERE id_venta = $5
       RETURNING id_venta, numero_rifa`,
      [boleta.id_evento_rifa, boleta.id_boleta, numeroFormatted, boleta.fecha_sorteo, id_venta]
    );

    if (updateRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Venta ${id_venta} no encontrada` });
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      mensaje: `Boleta ${numeroFormatted} asignada a venta ${id_venta}`,
      venta: updateRes.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error asignando boleta:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// 🔧 Endpoint para migrar órdenes de rifas inactivas a la rifa activa
router.post('/debug/migrar-ordenes', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Obtener la rifa activa
    const rifaActiva = await client.query('SELECT id_evento FROM evento_rifa WHERE estado = true LIMIT 1');
    if (rifaActiva.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No hay rifa activa' });
    }

    const idRifaActiva = rifaActiva.rows[0].id_evento;

    // Migrar órdenes de servicio que usan rifas inactivas
    const ordenesActualizadas = await client.query(
      `UPDATE public.orden
       SET id_rifa = $1
       WHERE id_rifa IS NOT NULL
       AND id_rifa != $1
       AND id_rifa IN (SELECT id_evento FROM evento_rifa WHERE estado = false)
       RETURNING id_orden, id_rifa`,
      [idRifaActiva]
    );

    // Migrar ventas de mostrador que usan rifas inactivas
    const ventasActualizadas = await client.query(
      `UPDATE venta_mostrador
       SET id_rifa = $1
       WHERE id_rifa IS NOT NULL
       AND id_rifa != $1
       AND id_rifa IN (SELECT id_evento FROM evento_rifa WHERE estado = false)
       RETURNING id_venta, id_rifa`,
      [idRifaActiva]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      mensaje: 'Órdenes y ventas migradas a rifa activa',
      ordenesActualizadas: ordenesActualizadas.rowCount,
      ventasActualizadas: ventasActualizadas.rowCount,
      rifaActiva: idRifaActiva
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error migrando órdenes:', error);
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