import { pool } from "../config/db.js";

export const getOperarios = async (req, res) => {
  const { rol, sede: sedeUsuario } = req.user;
  const { sede: sedeFiltro } = req.query;

  try {
    // � mostrarmos todos los operarios (activos + inactivos) pero respetando permisos de sede
    let query =
      "SELECT id_user, nombre, telefono, domicilio, estado_operario, correo, sede FROM usuarios WHERE LOWER(rol) = 'operario'";
    let params = [];

    // permiso por sede:
    // - SUPER_ADMIN puede ver cualquier sede; si pasa ?sede=XXX aplica filtrado
    // - ADMIN (jefatura) ve su propia sede por defecto, pero también puede solicitar otra sede usando el parámetro
    // - resto de roles (ADMIN_SEDE u operario) siempre quedan limitados a la sede del usuario
    if (rol === "SUPER_ADMIN") {
      if (sedeFiltro) {
        query += " AND sede = $1";
        params.push(sedeFiltro);
      }
    } else if (rol === "ADMIN") {
      if (sedeFiltro) {
        query += " AND sede = $1";
        params.push(sedeFiltro);
      } else {
        query += " AND sede = $1";
        params.push(sedeUsuario);
      }
    } else {
      // ADMIN_SEDE y demás
      query += " AND sede = $1";
      params.push(sedeUsuario);
    }

    query += " ORDER BY id_user ASC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener operarios" });
  }
};

export const createOperario = async (req, res) => {
  const { rol, sede: sedeUsuario } = req.user;
  const { nombre, telefono, domicilio, sede } = req.body;

  const sedeFinal = rol === "SUPER_ADMIN" && sede ? sede : sedeUsuario;

  try {
    const result = await pool.query(
      `INSERT INTO usuarios (nombre, telefono, domicilio, rol, estado_operario, correo, password_hash, sede) 
       VALUES ($1, $2, $3, 'Operario', true, $4, 'no-login', $5) RETURNING id_user, nombre, telefono, domicilio, estado_operario`,
      [
        nombre,
        telefono,
        domicilio,
        `operario_${Date.now()}@nologin.local`,
        sedeFinal,
      ],
    );
    res.json({ message: "Operario creado", data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear operario" });
  }
};

export const updateOperario = async (req, res) => {
  const { id } = req.params;
  const { nombre, telefono, domicilio, estado_operario } = req.body;

  try {
    // Si solo mandamos el estado_operario (desde el toggle), actualizamos solo eso
    if (nombre === undefined) {
      const result = await pool.query(
        `UPDATE usuarios SET estado_operario = $1 WHERE id_user = $2 RETURNING *`,
        [estado_operario, id],
      );
      return res.json({ message: "Estado actualizado", data: result.rows[0] });
    }

    // Actualización completa desde el modal
    const result = await pool.query(
      `UPDATE usuarios SET nombre = $1, telefono = $2, domicilio = $3 
       WHERE id_user = $4 RETURNING id_user, nombre, telefono, domicilio, estado_operario`,
      [nombre, telefono, domicilio, id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Operario no encontrado" });
    }

    res.json({ message: "Operario actualizado", data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar operario" });
  }
};

export const deleteOperario = async (req, res) => {
  const { id } = req.params;

  try {
    // 👈 Como Inactivo ahora es para ausencias, Borrar debe ser permanente (HARD DELETE)
    const result = await pool.query(
      "DELETE FROM usuarios WHERE id_user = $1 RETURNING *",
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Operario no encontrado" });
    }

    res.json({ message: "Operario eliminado permanentemente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al eliminar operario" });
  }
};
