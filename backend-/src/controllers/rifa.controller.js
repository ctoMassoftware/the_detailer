import { pool } from '../config/db.js';
import { enviarNotificacionOrdenTerminada } from '../services/whatsapp.service.js';

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
  const { numero_boleta, nombre, telefono, placa_vehiculo, total_pagar, preferencia_recibo } = req.body;

  const numeroFormatted = numero_boleta.toString().padStart(3, '0');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

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

    await client.query('COMMIT');
    
    // 👇 SOLUCIÓN: Solo se envía el WhatsApp si la preferencia NO es físico 👇
    if (telefono && preferencia_recibo !== 'FISICO') {
      enviarNotificacionOrdenTerminada(
          nombre, 
          telefono, 
          placa_vehiculo, 
          numeroFormatted, 
          total_pagar || '0'
      ).catch(err => console.error('Error enviando WhatsApp:', err));
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