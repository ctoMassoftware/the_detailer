import { pool } from '../config/db.js';
import { enviarNotificacionOrdenTerminada } from '../services/notificationRouter.service.js';

// ============================================================
// HELPERS DE SEGURIDAD
// ============================================================

async function obtenerSedeUsuario(userId) {
  try {
    const result = await pool.query(
      'SELECT sede FROM usuarios WHERE id_user = $1',
      [userId]
    );
    return result.rows[0]?.sede || 'GLOBAL';
  } catch (error) {
    console.error('Error obteniendo sede del usuario:', error);
    return 'GLOBAL';
  }
}

function validarAccesoRifa(rolUsuario, sedeUsuario, rifaSede) {
  // SUPER_ADMIN accede a todo
  if (rolUsuario === 'SUPER_ADMIN') return true;

  // ADMIN y ADMIN_SEDE solo su sede
  if (rolUsuario === 'ADMIN' || rolUsuario === 'ADMIN_SEDE') {
    return sedeUsuario === rifaSede || rifaSede === 'GLOBAL';
  }

  return false;
}

// ============================================================
// CREAR RIFA (Con sede automática)
// ============================================================

export const crearRifa = async (req, res) => {
  const { fecha, descripcion_premios, encargado } = req.body;
  const { rol } = req.user || {};

  if (rol !== 'SUPER_ADMIN' && rol !== 'ADMIN' && rol !== 'ADMIN_SEDE') {
    return res.status(403).json({ error: 'No tienes permiso para crear rifas' });
  }

  const sedeUsuario = await obtenerSedeUsuario(req.user?.id);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Solo SUPER_ADMIN puede crear rifas globales
    const sede = rol === 'SUPER_ADMIN' ? 'GLOBAL' : sedeUsuario;

    // Desactivar otras rifas de la MISMA sede
    await client.query(
      'UPDATE evento_rifa SET estado = false WHERE estado = true AND sede = $1',
      [sede]
    );

    const result = await client.query(
      `INSERT INTO evento_rifa (fecha_sorteo, descripcion_premios, encargado, estado, sede)
       VALUES ($1, $2, $3, true, $4) RETURNING *`,
      [fecha, descripcion_premios, encargado, sede]
    );

    // Generar números 000-999 disponibles para esta rifa
    for (let i = 0; i < 1000; i++) {
      const numero = String(i).padStart(3, '0');
      await client.query(
        `INSERT INTO rifa_numero_disponible (id_evento_rifa, numero_boleta, disponible, sede)
         VALUES ($1, $2, true, $3)
         ON CONFLICT DO NOTHING`,
        [result.rows[0].id_evento, numero, sede]
      );
    }

    await client.query('COMMIT');

    console.log(`✅ Rifa creada: ${result.rows[0].id_evento} (Sede: ${sede})`);
    res.json({ message: 'Rifa creada exitosamente', rifa: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creando rifa:', error);
    res.status(500).json({ error: 'Error al crear la rifa' });
  } finally {
    client.release();
  }
};

// ============================================================
// OBTENER RIFA ACTIVA (Con seguridad por sede)
// ============================================================

export const getRifaActiva = async (req, res) => {
  const sedeUsuario = await obtenerSedeUsuario(req.user?.id);

  try {
    const result = await pool.query(
      `SELECT id_evento, fecha_sorteo, descripcion_premios, encargado, sede
       FROM evento_rifa
       WHERE estado = true AND (sede = $1 OR sede = 'GLOBAL')
       ORDER BY sede DESC, id_evento DESC
       LIMIT 1`,
      [sedeUsuario]
    );

    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error('Error obteniendo rifa activa:', error);
    res.status(500).json({ error: 'Error al obtener rifa activa' });
  }
};

// ============================================================
// OBTENER TODAS LAS RIFAS (Con seguridad por sede)
// ============================================================

export const getTodasRifas = async (req, res) => {
  const { rol } = req.user || {};
  const sedeUsuario = await obtenerSedeUsuario(req.user?.id);

  try {
    let query = `
      SELECT er.*,
             COUNT(CASE WHEN rnd.disponible = TRUE THEN 1 END)::INT as numeros_disponibles,
             COUNT(CASE WHEN rnd.disponible = FALSE THEN 1 END)::INT as numeros_asignados
      FROM evento_rifa er
      LEFT JOIN rifa_numero_disponible rnd ON er.id_evento = rnd.id_evento_rifa
    `;

    const values = [];

    // Filtrar por sede según el rol
    if (rol === 'SUPER_ADMIN') {
      // SUPER_ADMIN ve todas
      query += ` GROUP BY er.id_evento ORDER BY er.id_evento DESC`;
    } else if (rol === 'ADMIN' || rol === 'ADMIN_SEDE') {
      // ADMIN_SEDE ve su sede + GLOBAL
      query += ` WHERE er.sede = $1 OR er.sede = 'GLOBAL'
                 GROUP BY er.id_evento
                 ORDER BY er.sede DESC, er.id_evento DESC`;
      values.push(sedeUsuario);
    } else {
      return res.status(403).json({ error: 'No tienes permiso' });
    }

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo rifas:', error);
    res.status(500).json({ error: 'Error al obtener rifas' });
  }
};

// ============================================================
// ACTUALIZAR RIFA (Con seguridad por sede)
// ============================================================

export const actualizarRifa = async (req, res) => {
  const { id } = req.params;
  const { fecha_sorteo, descripcion_premios, encargado, estado } = req.body;
  const { rol } = req.user || {};

  if (rol !== 'SUPER_ADMIN' && rol !== 'ADMIN' && rol !== 'ADMIN_SEDE') {
    return res.status(403).json({ error: 'No tienes permiso para actualizar rifas' });
  }

  const sedeUsuario = await obtenerSedeUsuario(req.user?.id);

  try {
    // Validar que la rifa pertenece a su sede
    const rifaCheck = await pool.query(
      'SELECT sede FROM evento_rifa WHERE id_evento = $1',
      [id]
    );

    if (rifaCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Rifa no encontrada' });
    }

    const rifaSede = rifaCheck.rows[0].sede;

    // Validar acceso
    if (!validarAccesoRifa(rol, sedeUsuario, rifaSede)) {
      return res.status(403).json({ error: 'No tienes permiso para actualizar esta rifa' });
    }

    const updates = [];
    const values = [];

    if (fecha_sorteo !== undefined) {
      updates.push(`fecha_sorteo = $${values.length + 1}`);
      values.push(fecha_sorteo);
    }
    if (descripcion_premios !== undefined) {
      updates.push(`descripcion_premios = $${values.length + 1}`);
      values.push(descripcion_premios);
    }
    if (encargado !== undefined) {
      updates.push(`encargado = $${values.length + 1}`);
      values.push(encargado);
    }
    if (estado !== undefined) {
      if (estado === true) {
        // Desactivar otras rifas de la MISMA sede
        await pool.query(
          'UPDATE evento_rifa SET estado = false WHERE id_evento != $1 AND sede = $2',
          [id, rifaSede]
        );
      }
      updates.push(`estado = $${values.length + 1}`);
      values.push(estado);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    let query = 'UPDATE evento_rifa SET ' + updates.join(', ');
    query += ` WHERE id_evento = $${values.length + 1} RETURNING *`;
    values.push(id);

    const result = await pool.query(query, values);

    console.log(`✅ Rifa actualizada: ${id} (Sede: ${rifaSede})`);
    res.json({ message: 'Rifa actualizada correctamente', rifa: result.rows[0] });
  } catch (error) {
    console.error('Error actualizando rifa:', error);
    res.status(500).json({ error: 'Error al actualizar la rifa' });
  }
};

// ============================================================
// ASIGNAR BOLETA A ORDEN (Con seguridad y validación)
// ============================================================

export const asignarBoletaAOrden = async (req, res) => {
  const { id_orden, id_evento_rifa, numero_boleta } = req.body;
  const { rol, id: userId } = req.user || {};

  console.log(`📥 POST /asignar-boleta recibido:`);
  console.log(`   id_orden=${id_orden}, id_evento_rifa=${id_evento_rifa}, numero_boleta=${numero_boleta}`);

  if (!id_orden || !id_evento_rifa || !numero_boleta) {
    console.error(`❌ Parámetros faltantes: id_orden=${id_orden}, id_evento_rifa=${id_evento_rifa}, numero_boleta=${numero_boleta}`);
    return res.status(400).json({ error: 'Faltan parámetros requeridos: id_orden, id_evento_rifa, numero_boleta' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Buscar la boleta en la tabla rifa por número
    const numeroFormatted = String(numero_boleta).padStart(3, '0');
    console.log(`🔍 Buscando boleta #${numeroFormatted} en evento ${id_evento_rifa}...`);

    const boletaQuery = await client.query(
      `SELECT id_boleta FROM rifa
       WHERE id_evento_rifa = $1 AND numero_boleta = $2
       LIMIT 1`,
      [id_evento_rifa, numeroFormatted]
    );

    console.log(`   Resultado: ${boletaQuery.rows.length} boletas encontradas`);
    if (boletaQuery.rows.length > 0) {
      console.log(`   id_boleta encontrado: ${boletaQuery.rows[0].id_boleta}`);
    }

    if (boletaQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      console.error(`❌ Boleta #${numeroFormatted} NO encontrada en evento ${id_evento_rifa}`);
      return res.status(404).json({
        error: `Boleta #${numeroFormatted} no encontrada para el evento ${id_evento_rifa}`
      });
    }

    const idBoleta = boletaQuery.rows[0].id_boleta;

    // 2. Validar que la orden existe
    const ordenCheck = await client.query(
      'SELECT id_orden FROM orden WHERE id_orden = $1',
      [id_orden]
    );

    if (ordenCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    // 3. Actualizar orden con id_boleta
    console.log(`🔄 Ejecutando UPDATE: SET id_boleta=${idBoleta} WHERE id_orden=${id_orden}`);
    const updateResult = await client.query(
      `UPDATE orden SET id_boleta = $1 WHERE id_orden = $2 RETURNING id_orden, id_boleta`,
      [idBoleta, id_orden]
    );

    console.log(`   UPDATE resultado: rowCount=${updateResult.rowCount}, rows=${JSON.stringify(updateResult.rows)}`);

    if (updateResult.rowCount === 0) {
      await client.query('ROLLBACK');
      console.error(`❌ UPDATE no afectó ninguna fila. Orden ${id_orden} podría no existir`);
      return res.status(400).json({
        error: `No se pudo actualizar orden ${id_orden}`,
        debug: { rowCount: updateResult.rowCount }
      });
    }

    await client.query('COMMIT');
    console.log(`✅ COMMIT ejecutado exitosamente`);

    console.log(`✅ Boleta #${numeroFormatted} (id=${idBoleta}) asignada a orden ${id_orden}`);
    res.json({
      success: true,
      message: `Boleta #${numeroFormatted} asignada correctamente`,
      id_orden,
      id_boleta: idBoleta,
      numero_boleta: numeroFormatted,
      updateResult: updateResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error asignando boleta:', error.message);
    res.status(500).json({
      error: 'Error al asignar boleta',
      details: error.message
    });
  } finally {
    client.release();
  }
};

// ============================================================
// OBTENER NÚMEROS DISPONIBLES (Con seguridad)
// ============================================================

export const getBoletasDisponibles = async (req, res) => {
  const { id_evento } = req.params;
  const { rol } = req.user || {};

  const sedeUsuario = await obtenerSedeUsuario(req.user?.id);

  try {
    // Validar acceso a la rifa
    const rifaCheck = await pool.query(
      'SELECT sede FROM evento_rifa WHERE id_evento = $1',
      [id_evento]
    );

    if (rifaCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Rifa no encontrada' });
    }

    if (!validarAccesoRifa(rol, sedeUsuario, rifaCheck.rows[0].sede)) {
      return res.status(403).json({ error: 'No tienes acceso a esta rifa' });
    }

    // Obtener números disponibles (limitado a primeros 100 por rendimiento)
    const result = await pool.query(
      `SELECT numero_boleta, disponible
       FROM rifa_numero_disponible
       WHERE id_evento_rifa = $1
       ORDER BY numero_boleta ASC
       LIMIT 100`,
      [id_evento]
    );

    const disponibles = result.rows.filter(r => r.disponible).map(r => r.numero_boleta);
    const asignados = result.rows.filter(r => !r.disponible).map(r => r.numero_boleta);

    res.json({
      id_evento,
      total_disponibles: disponibles.length,
      total_asignados: asignados.length,
      disponibles: disponibles.slice(0, 50), // Retornar solo los primeros 50
      asignados: asignados.slice(0, 50)
    });
  } catch (error) {
    console.error('Error obteniendo boletas disponibles:', error);
    res.status(500).json({ error: 'Error al obtener boletas disponibles' });
  }
};

// ============================================================
// ELIMINAR RIFA (Con seguridad)
// ============================================================

export const eliminarRifa = async (req, res) => {
  const { id } = req.params;
  const { rol } = req.user || {};

  if (rol !== 'SUPER_ADMIN' && rol !== 'ADMIN') {
    return res.status(403).json({ error: 'Solo SUPER_ADMIN o ADMIN pueden eliminar rifas' });
  }

  const sedeUsuario = await obtenerSedeUsuario(req.user?.id);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Validar acceso
    const rifaCheck = await client.query(
      'SELECT sede FROM evento_rifa WHERE id_evento = $1',
      [id]
    );

    if (rifaCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Rifa no encontrada' });
    }

    if (!validarAccesoRifa(rol, sedeUsuario, rifaCheck.rows[0].sede)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta rifa' });
    }

    // Eliminar en cascada
    await client.query('DELETE FROM rifa_asignacion_audit WHERE id_evento_rifa = $1', [id]);
    await client.query('DELETE FROM rifa_numero_disponible WHERE id_evento_rifa = $1', [id]);
    await client.query('DELETE FROM rifa WHERE id_evento_rifa = $1', [id]);
    await client.query('DELETE FROM evento_rifa WHERE id_evento = $1', [id]);

    await client.query('COMMIT');

    console.log(`✅ Rifa eliminada: ${id}`);
    res.json({ message: 'Rifa eliminada correctamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error eliminando rifa:', error);
    res.status(500).json({ error: 'Error al eliminar la rifa' });
  } finally {
    client.release();
  }
};

// ============================================================
// FUNCIONES HEREDADAS (Compatibilidad)
// ============================================================

export const registrarBoleta = async (req, res) => {
  const { numero_boleta, nombre, telefono, placa_vehiculo } = req.body;

  if (!numero_boleta || !nombre || !telefono || !placa_vehiculo) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos' });
  }

  const numeroFormatted = String(numero_boleta).padStart(3, '0');
  const sedeUsuario = await obtenerSedeUsuario(req.user?.id);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Obtener rifa activa de la sede
    const rifaResult = await client.query(
      `SELECT id_evento FROM evento_rifa
       WHERE estado = true AND (sede = $1 OR sede = 'GLOBAL')
       LIMIT 1`,
      [sedeUsuario]
    );

    if (rifaResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No hay rifa activa en este momento' });
    }

    const idEvento = rifaResult.rows[0].id_evento;

    // Verificar disponibilidad
    const boletaCheck = await client.query(
      `SELECT disponible FROM rifa_numero_disponible
       WHERE id_evento_rifa = $1 AND numero_boleta = $2`,
      [idEvento, numeroFormatted]
    );

    if (boletaCheck.rows.length === 0 || !boletaCheck.rows[0].disponible) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `El número ${numeroFormatted} no está disponible` });
    }

    // Marcar como no disponible
    await client.query(
      `UPDATE rifa_numero_disponible SET disponible = false, fecha_asignacion = NOW()
       WHERE id_evento_rifa = $1 AND numero_boleta = $2`,
      [idEvento, numeroFormatted]
    );

    // Insertar boleta
    const insertResult = await client.query(
      `INSERT INTO rifa (id_evento_rifa, numero_boleta, nombre, telefono, placa_vehiculo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [idEvento, numeroFormatted, nombre, telefono, placa_vehiculo]
    );

    await client.query('COMMIT');

    res.json({ message: 'Boleta registrada con éxito', boleta: insertResult.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error registrando boleta:', error);
    res.status(500).json({ error: 'Error al registrar boleta' });
  } finally {
    client.release();
  }
};

export const verificarNumero = async (req, res) => {
  const { id_evento, numero } = req.params;

  try {
    const result = await pool.query(
      `SELECT disponible FROM rifa_numero_disponible
       WHERE id_evento_rifa = $1 AND numero_boleta = $2`,
      [id_evento, numero]
    );

    if (result.rows.length === 0) {
      return res.json({ disponible: false, error: 'Número no encontrado' });
    }

    res.json({ disponible: result.rows[0].disponible });
  } catch (error) {
    console.error('Error verificando número:', error);
    res.status(500).json({ error: 'Error verificando número' });
  }
};

export const getBoletasPorRifa = async (req, res) => {
  const { idEvento } = req.params;
  const { rol } = req.user || {};

  const sedeUsuario = await obtenerSedeUsuario(req.user?.id);

  try {
    // Validar acceso
    const rifaCheck = await pool.query(
      'SELECT sede FROM evento_rifa WHERE id_evento = $1',
      [idEvento]
    );

    if (rifaCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Rifa no encontrada' });
    }

    if (!validarAccesoRifa(rol, sedeUsuario, rifaCheck.rows[0].sede)) {
      return res.status(403).json({ error: 'No tienes acceso a esta rifa' });
    }

    const result = await pool.query(
      'SELECT * FROM rifa WHERE id_evento_rifa = $1 ORDER BY numero_boleta ASC',
      [idEvento]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo boletas:', error);
    res.status(500).json({ error: 'Error obteniendo boletas' });
  }
};

export const elegirGanador = async (req, res) => {
  const { id_evento, id_boleta } = req.body;

  try {
    const existe = await pool.query(
      'SELECT 1 FROM rifa_ganador WHERE id_evento_rifa = $1',
      [id_evento]
    );

    if (existe.rows.length > 0) {
      return res.status(400).json({ error: 'Ya existe un ganador para esta rifa' });
    }

    const boletaRes = await pool.query(
      'SELECT * FROM rifa WHERE id_boleta = $1 AND id_evento_rifa = $2',
      [id_boleta, id_evento]
    );

    if (boletaRes.rows.length === 0) {
      return res.status(404).json({ error: 'Boleta no encontrada' });
    }

    const ganador = boletaRes.rows[0];

    await pool.query(
      `INSERT INTO rifa_ganador (id_evento_rifa, id_boleta, nombre_ganador, telefono_ganador, placa_vehiculo, numero_boleta)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id_evento, ganador.id_boleta, ganador.nombre, ganador.telefono, ganador.placa_vehiculo, ganador.numero_boleta]
    );

    res.json({ message: 'Ganador registrado', ganador });
  } catch (error) {
    console.error('Error eligiendo ganador:', error);
    res.status(500).json({ error: 'Error al elegir ganador' });
  }
};

export const historialGanadores = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT g.*, e.fecha_sorteo, e.descripcion_premios, e.encargado
       FROM rifa_ganador g
       JOIN evento_rifa e ON g.id_evento_rifa = e.id_evento
       ORDER BY g.fecha_ganador DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error consultando historial:', error);
    res.status(500).json({ error: 'Error al consultar historial' });
  }
};

export const consultarGanador = async (req, res) => {
  const { numero } = req.params;

  try {
    const result = await pool.query(
      `SELECT g.*, e.descripcion_premios, e.fecha_sorteo
       FROM rifa_ganador g
       JOIN evento_rifa e ON g.id_evento_rifa = e.id_evento
       WHERE g.numero_boleta = $1`,
      [numero]
    );

    if (result.rows.length > 0) {
      res.json({ ganador: result.rows[0] });
    } else {
      res.json({ ganador: null });
    }
  } catch (error) {
    console.error('Error consultando ganador:', error);
    res.status(500).json({ error: 'Error consultando ganador' });
  }
};
