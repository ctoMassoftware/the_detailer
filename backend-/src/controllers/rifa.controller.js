// Elegir y guardar ganador manualmente de una rifa
export const elegirGanador = async (req, res) => {
  const { id_evento, id_boleta } = req.body;
  try {
    // Verificar si ya hay ganador para esta rifa
    const existe = await pool.query('SELECT 1 FROM rifa_ganador WHERE id_evento_rifa = $1', [id_evento]);
    if (existe.rows.length > 0) {
      return res.status(400).json({ error: 'Ya existe un ganador para esta rifa.' });
    }
    // Buscar la boleta seleccionada
    const boletaRes = await pool.query('SELECT * FROM rifa WHERE id_boleta = $1 AND id_evento_rifa = $2', [id_boleta, id_evento]);
    if (boletaRes.rows.length === 0) {
      return res.status(404).json({ error: 'Boleta no encontrada para esta rifa.' });
    }
    const ganador = boletaRes.rows[0];
    // Guardar en rifa_ganador
    await pool.query(
      `INSERT INTO rifa_ganador (id_evento_rifa, id_boleta, nombre_ganador, telefono_ganador, placa_vehiculo, numero_boleta)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id_evento, ganador.id_boleta, ganador.nombre, ganador.telefono, ganador.placa_vehiculo, ganador.numero_boleta]
    );
    res.json({ message: 'Ganador registrado', ganador });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al elegir ganador' });
  }
};

// Consultar historial de ganadores
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
    console.error(error);
    res.status(500).json({ error: 'Error al consultar historial de ganadores' });
  }
};
import { pool } from '../config/db.js';
import { enviarNotificacionOrdenTerminada } from '../services/notificationRouter.service.js';

export const crearRifa = async (req, res) => {
  const { fecha, descripcion_premios, encargado } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE evento_rifa SET estado = false WHERE estado = true');

    const result = await client.query(
      `INSERT INTO evento_rifa (fecha_sorteo, descripcion_premios, encargado, estado)
       VALUES ($1, $2, $3, true) RETURNING *`,
      [fecha, descripcion_premios, encargado]
    );

    await client.query('COMMIT');
    res.json({ message: 'Nueva rifa creada y activa', rifa: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al crear la rifa' });
  } finally {
    client.release();
  }
};

export const getRifaActiva = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id_evento, fecha_sorteo, descripcion_premios, encargado FROM evento_rifa WHERE estado = true LIMIT 1'
        );

        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.json(null);
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener rifa activa' });
    }
};

export const actualizarRifa = async (req, res) => {
    const { id } = req.params;
    const { fecha_sorteo, descripcion_premios, encargado, estado } = req.body;

    try {
        let query = 'UPDATE evento_rifa SET';
        const values = [];
        const updates = [];

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
            // Si activamos una rifa, desactivamos todas las demás
            if (estado === true) {
                await pool.query('UPDATE evento_rifa SET estado = false WHERE id_evento != $1', [id]);
            }
            updates.push(`estado = $${values.length + 1}`);
            values.push(estado);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No hay campos para actualizar' });
        }

        query += ' ' + updates.join(', ');
        query += ` WHERE id_evento = $${values.length + 1} RETURNING *`;
        values.push(id);

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Rifa no encontrada' });
        }

        res.json({ message: 'Rifa actualizada correctamente', rifa: result.rows[0] });
    } catch (error) {
        console.error('Error actualizando rifa:', error);
        res.status(500).json({ error: 'Error al actualizar la rifa' });
    }
};

export const getTodasRifas = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM evento_rifa ORDER BY id_evento DESC');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener historial de rifas' });
  }
};

export const registrarBoleta = async (req, res) => {
  const { numero_boleta, nombre, telefono, placa_vehiculo, total_pagar, preferencia_recibo, id_venta } = req.body;

  // ✅ VALIDACIONES CRÍTICAS
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: '❌ Nombre del cliente es requerido para registrar boleta' });
  }

  if (!telefono || !telefono.toString().trim()) {
    return res.status(400).json({ error: '❌ Teléfono del cliente es requerido para registrar boleta' });
  }

  // Validar formato de teléfono (solo números, mínimo 10 dígitos)
  const telefonoLimpio = telefono.toString().replace(/\D/g, '');
  if (telefonoLimpio.length < 10) {
    return res.status(400).json({ error: '❌ Teléfono debe tener al menos 10 dígitos válidos' });
  }

  if (!numero_boleta) {
    return res.status(400).json({ error: '❌ Número de boleta es requerido' });
  }

  const numeroFormatted = numero_boleta.toString().padStart(3, '0');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log(`[TRANSACCIÓN BOLETA] Iniciada: numero=${numero_boleta}, id_venta=${id_venta || 'NO ENVIADO'}, nombre=${nombre}`);

    const eventoActivo = await client.query('SELECT id_evento FROM evento_rifa WHERE estado = true LIMIT 1');
    
    if (eventoActivo.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No hay ninguna rifa activa en este momento.' });
    }

    const idEvento = eventoActivo.rows[0].id_evento;

    const conteo = await client.query('SELECT COUNT(*) FROM rifa WHERE id_evento_rifa = $1', [idEvento]);
    const totalVendidas = parseInt(conteo.rows[0].count);

    if (totalVendidas >= 1000) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Ya no se encuentran números disponibles para esta rifa.' 
      });
    }

    const checkNumero = await client.query(
      'SELECT * FROM rifa WHERE id_evento_rifa = $1 AND numero_boleta = $2',
      [idEvento, numeroFormatted]
    );

    if (checkNumero.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `El número ${numeroFormatted} ya está ocupado. Por favor elija otro.` });
    }

    const insertQuery = `
      INSERT INTO rifa (id_evento_rifa, numero_boleta, nombre, telefono, placa_vehiculo)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await client.query(insertQuery, [idEvento, numeroFormatted, nombre, telefono, placa_vehiculo]);
    const idBoleta = result.rows[0].id_boleta;
    console.log(`✅ Boleta insertada en tabla rifa: id_boleta=${idBoleta}, numero=${numeroFormatted}`);
    console.log(`[TRANSACCIÓN BOLETA] Evaluando placa_vehiculo: valor="${placa_vehiculo}" (tipo: ${typeof placa_vehiculo}, es "N/A"? ${placa_vehiculo === 'N/A'})`);

    // Si es una venta de mostrador (placa_vehiculo === 'N/A'), actualizar venta_mostrador con datos de rifa
    if (placa_vehiculo === 'N/A') {
      console.log(`[TRANSACCIÓN BOLETA] ✅ Condición TRUE - Proceediendo con UPDATE a venta_mostrador para id_venta=${id_venta}`);
      const eventoInfo = await client.query(
        'SELECT fecha_sorteo FROM evento_rifa WHERE id_evento = $1',
        [idEvento]
      );

      if (eventoInfo.rows.length > 0) {
        // ✅ VALIDACIÓN CRÍTICA: id_venta es OBLIGATORIO para vincular boleta a venta
        if (!id_venta) {
          await client.query('ROLLBACK');
          console.error(`❌ id_venta es requerido para vincular boleta a venta. Cliente: ${nombre}`);
          return res.status(400).json({
            error: '❌ ID de venta es requerido para registrar la boleta. Por favor intenta de nuevo.',
            code: 'MISSING_VENTA_ID',
            debug: { numero_boleta: numeroFormatted, nombre, telefono }
          });
        }

        const idVentaToUpdate = id_venta;

        // Actualizar venta_mostrador con datos de boleta
        const updateResult = await client.query(
          `UPDATE venta_mostrador
           SET id_rifa = $1, id_boleta = $2, numero_rifa = $3, fecha_sorteo = $4
           WHERE id_venta = $5`,
          [idEvento, idBoleta, numeroFormatted, eventoInfo.rows[0].fecha_sorteo, idVentaToUpdate]
        );

        // ✅ VALIDACIÓN CRÍTICA: Verificar que el UPDATE actualizó exactamente 1 fila
        if (updateResult.rowCount !== 1) {
          await client.query('ROLLBACK');
          console.error(`❌ UPDATE falló - Venta ${idVentaToUpdate} no existe. Boleta ${numeroFormatted} será huérfana si COMMIT ocurre`);
          return res.status(404).json({
            error: `No se encontró la venta ${idVentaToUpdate} para vincular la boleta. Verifica que la venta exista.`,
            code: 'VENTA_NOT_FOUND',
            debug: {
              id_venta: idVentaToUpdate,
              id_boleta: idBoleta,
              numero_rifa: numeroFormatted,
              rowCount: updateResult.rowCount
            }
          });
        }
        console.log(`✅ Venta ${idVentaToUpdate} actualizada: boleta=${numeroFormatted}, id_boleta=${idBoleta} (${updateResult.rowCount} fila afectada)`);
      }
    }

    await client.query('COMMIT');
    console.log(`[TRANSACCIÓN BOLETA] Completada exitosamente: id_boleta=${idBoleta}, numero=${numeroFormatted}, vinculada a venta ${id_venta || 'N/A'}`);

    // 👇 CORRECCIÓN: preferencia_recibo es un ARRAY, validar si incluye 'SMS' 👇
    // Solo enviar notificación si el cliente solicitó SMS (no solo FISICO)
    if (telefono && preferencia_recibo && Array.isArray(preferencia_recibo) && preferencia_recibo.includes('SMS')) {
      console.log(`📱 Enviando notificación SMS para boleta ${numeroFormatted} a ${telefono}`);
      enviarNotificacionOrdenTerminada(
          nombre,
          telefono,
          placa_vehiculo,
          numeroFormatted,
          total_pagar || '0'
      ).catch(err => console.error('❌ Error enviando notificación:', err));
    }

    res.json({ message: 'Boleta registrada con éxito', boleta: result.rows[0] });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error interno al registrar boleta' });
  } finally {
    client.release();
  }
};

export const verificarNumero = async (req, res) => {
  const { id_evento, numero } = req.params;
  const numeroFormatted = numero.toString().padStart(3, '0');

  try {
    const result = await pool.query(
      'SELECT nombre FROM rifa WHERE id_evento_rifa = $1 AND numero_boleta = $2',
      [id_evento, numeroFormatted]
    );
    
    if (result.rows.length > 0) {
      res.json({ disponible: false, ocupado_por: result.rows[0].nombre });
    } else {
      res.json({ disponible: true });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error verificando número' });
  }
};

export const consultarGanador = async (req, res) => {
  const { numero } = req.params;
  const numeroFormatted = numero.toString().padStart(3, '0');

  try {
    const eventoActivo = await pool.query('SELECT id_evento FROM evento_rifa WHERE estado = true LIMIT 1');
    
    if (eventoActivo.rows.length === 0) {
      return res.status(404).json({ message: 'No hay rifa activa para buscar ganadores.' });
    }

    const idEvento = eventoActivo.rows[0].id_evento;

    const boleta = await pool.query(
      `SELECT nombre, telefono, placa_vehiculo, numero_boleta 
       FROM rifa 
       WHERE id_evento_rifa = $1 AND numero_boleta = $2`,
      [idEvento, numeroFormatted]
    );

    if (boleta.rows.length === 0) {
      return res.status(404).json({ message: 'Este número no ha sido vendido aún.' });
    }

    res.json(boleta.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar ganador' });
  }
};

export const getBoletasPorRifa = async (req, res) => {
  const { idEvento } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM rifa WHERE id_evento_rifa = $1 ORDER BY numero_boleta ASC',
      [idEvento]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener boletas de la rifa' });
  }
};

export const eliminarRifa = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM rifa WHERE id_evento_rifa = $1', [id]);
        const result = await pool.query('DELETE FROM evento_rifa WHERE id_evento = $1', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Rifa no encontrada' });
        }

        res.json({ message: 'Rifa y boletas eliminadas correctamente' });
    } catch (error) {
        console.error('Error en eliminarRifa:', error);
        res.status(500).json({ error: 'Error interno al eliminar la rifa' });
    }
};