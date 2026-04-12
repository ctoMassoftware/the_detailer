import { pool } from '../config/db.js';

export const getMensajes = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM mensaje_automatico');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
};

export const updateMensaje = async (req, res) => {
  const { tipo_mensaje, contenido } = req.body;

  try {
    const update = await pool.query(
      'UPDATE mensaje_automatico SET contenido = $1 WHERE tipo_mensaje = $2 RETURNING *',
      [contenido, tipo_mensaje]
    );

    if (update.rows.length > 0) {
      return res.json({ message: 'Mensaje actualizado', data: update.rows[0] });
    } else {
      const insert = await pool.query(
        'INSERT INTO mensaje_automatico (tipo_mensaje, contenido) VALUES ($1, $2) RETURNING *',
        [tipo_mensaje, contenido]
      );
      return res.json({ message: 'Mensaje creado', data: insert.rows[0] });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al guardar mensaje' });
  }
};