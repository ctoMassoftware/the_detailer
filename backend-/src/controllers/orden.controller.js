import { pool } from "../config/db.js";
import { DateTime } from "luxon";
import {
  enviarNotificacionInicioServicio,
  enviarNotificacionSimple,
  enviarNotificacionModificacion
} from "../services/whatsapp.service.js";

// ✅ Convierte cualquier formato de hora a "HH:mm" en zona horaria Bogotá
// Soporta: "HH:mm", "HH:mm:ss", ISO UTC ("2025-04-22T19:30:00Z"), y strings de pg (TIME)
function toBogotaTimeString(hora) {
  if (!hora) return null;

  // Si ya viene como "HH:mm" o "HH:mm:ss" (string puro de PostgreSQL TIME)
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(hora)) {
    // Viene de pg como hora UTC, convertimos asumiendo que es UTC
    return DateTime.fromISO(`1970-01-01T${hora}`, { zone: 'utc' })
      .setZone('America/Bogota')
      .toFormat('HH:mm');
  }

  // Si viene como ISO UTC: '2025-04-22T19:30:00Z' (desde el frontend)
  return DateTime.fromISO(hora, { zone: 'utc' })
    .setZone('America/Bogota')
    .toFormat('HH:mm');
}

// ✅ Convierte la hora que devuelve PostgreSQL (TIME en UTC) a hora Bogotá
function pgTimeToBogoata(horaStr) {
  if (!horaStr) return null;
  // pg devuelve TIME como "19:30:00" (UTC), lo convertimos a Bogotá
  const clean = String(horaStr).slice(0, 8); // asegura "HH:mm:ss"
  return DateTime.fromISO(`1970-01-01T${clean}`, { zone: 'utc' })
    .setZone('America/Bogota')
    .toFormat('HH:mm');
}

export const createOrden = async (req, res) => {
  const { rol, sede: sedeUsuario } = req.user || {};

  const {
    cedula_cliente,
    nombre_cliente,
    correo_cliente,
    telefono_cliente,
    direccion_cliente,

    placa_vehiculo,
    marca_vehiculo,
    modelo_vehiculo,
    tipo_vehiculo,

    metodo_pago,
    caja,
    id_user_encargado,

    id_rifa,
    notas,
    servicios,

    sede
  } = req.body;

  const sedeFinal = rol === "SUPER_ADMIN" && sede ? sede : sedeUsuario || "GLOBAL";
  const client = await pool.connect();

  // ✅ Convierte la hora recibida del frontend a hora Bogotá antes de guardar
  let horaBogota = null;
  if (req.body.hora) {
    horaBogota = toBogotaTimeString(req.body.hora);
  }
  // Si no viene hora, el DEFAULT de PostgreSQL ya está configurado en hora Bogotá (ver initDB.js)

  try {
    await client.query("BEGIN");

    const ordenQuery = `
      INSERT INTO public.orden (
        cedula_cliente,
        nombre_cliente,
        correo_cliente,
        telefono_cliente,
        direccion_cliente,
        placa_vehiculo,
        marca_vehiculo,
        modelo_vehiculo,
        tipo_vehiculo,
        metodo_pago,
        caja,
        id_user_encargado,
        id_rifa,
        notas,
        sede,
        hora
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING id_orden
    `;

    const ordenValues = [
      cedula_cliente,
      nombre_cliente,
      correo_cliente,
      telefono_cliente,
      direccion_cliente,
      placa_vehiculo,
      marca_vehiculo,
      modelo_vehiculo,
      tipo_vehiculo,
      metodo_pago,
      caja,
      id_user_encargado,
      id_rifa,
      notas,
      sedeFinal,
      horaBogota  // null → PostgreSQL usará el DEFAULT (hora Bogotá automática)
    ];

    const ordenResult = await client.query(ordenQuery, ordenValues);
    const idOrden = ordenResult.rows[0].id_orden;

    // GUARDAR SERVICIOS
    if (servicios && servicios.length > 0) {
      const detalleQuery = `
        INSERT INTO public.detalle_orden_venta
        (id_orden, id_servicio, cantidad, precio_servicio_aplicado)
        VALUES ($1,$2,$3,$4)
      `;
      for (const serv of servicios) {
        await client.query(detalleQuery, [
          idOrden,
          serv.id_servicio,
          serv.cantidad,
          serv.precio
        ]);
      }
    }

    await client.query("COMMIT");

    // WHATSAPP DE BIENVENIDA
    if (telefono_cliente && nombre_cliente && placa_vehiculo) {
      enviarNotificacionInicioServicio(
        nombre_cliente,
        telefono_cliente,
        placa_vehiculo
      ).catch((err) => {
        console.error("Error enviando WhatsApp de ingreso:", err);
      });
    }

    res.status(201).json({
      message: "Orden creada exitosamente",
      id_orden: idOrden
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creando orden:", error);
    res.status(500).json({ error: "Error al crear la orden" });
  } finally {
    client.release();
  }
};

export const getOrdenes = async (req, res) => {
  const { rol, sede: sedeUsuario } = req.user || {};
  const { sede: sedeFiltro } = req.query;

  try {
    let baseQuery = `
      SELECT
        o.*,
        u.nombre as nombre_operario,
        COALESCE(SUM(d.cantidad * d.precio_servicio_aplicado),0) as total_orden,
        COALESCE(
          json_agg(
            json_build_object(
              'id_servicio', d.id_servicio,
              'servicio', s.nombre_servicio,
              'cantidad', d.cantidad,
              'precio_unitario', d.precio_servicio_aplicado,
              'subtotal', (d.cantidad * d.precio_servicio_aplicado)
            )
          ) FILTER (WHERE d.id_servicio IS NOT NULL),
          '[]'::json
        ) as lista_servicios
      FROM public.orden o
      LEFT JOIN public.detalle_orden_venta d ON o.id_orden = d.id_orden
      LEFT JOIN public.servicio s ON d.id_servicio = s.id_servicio
      LEFT JOIN public.usuarios u ON o.id_user_encargado = u.id_user
    `;

    let whereClause = "";
    let params = [];

    if (rol !== "SUPER_ADMIN") {
      whereClause = " WHERE o.sede = $1";
      params.push(sedeUsuario);
    } else if (sedeFiltro) {
      whereClause = " WHERE o.sede = $1";
      params.push(sedeFiltro);
    }

    const finalQuery = `
      ${baseQuery}
      ${whereClause}
      GROUP BY o.id_orden, u.id_user, u.nombre
      ORDER BY o.id_orden DESC
    `;

    const result = await pool.query(finalQuery, params);

    // ✅ Convierte la hora de cada orden de UTC a hora Bogotá antes de enviar al frontend
    const rows = result.rows.map(row => ({
      ...row,
      hora: pgTimeToBogoata(row.hora)
    }));

    res.json(rows);

  } catch (error) {
    console.error("Error en getOrdenes:", error);
    res.status(500).json({ error: "Error obteniendo órdenes" });
  }
};

export const updateOrden = async (req, res) => {
  const { id } = req.params;
  const {
    cedula_cliente, nombre_cliente, correo_cliente, telefono_cliente, direccion_cliente,
    placa_vehiculo, marca_vehiculo, modelo_vehiculo, tipo_vehiculo,
    metodo_pago, caja, id_user_encargado, estado,
    fecha, hora, notas, servicios
  } = req.body;

  // ✅ Convierte la hora recibida del frontend a hora Bogotá antes de guardar
  let horaBogota = null;
  if (hora) {
    horaBogota = toBogotaTimeString(hora);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const updateQuery = `
      UPDATE public.orden SET
        cedula_cliente = $1, nombre_cliente = $2, correo_cliente = $3, telefono_cliente = $4, direccion_cliente = $5,
        placa_vehiculo = $6, marca_vehiculo = $7, modelo_vehiculo = $8, tipo_vehiculo = $9,
        metodo_pago = $10, caja = $11, id_user_encargado = $12, estado = $13,
        fecha = $14, hora = $15, notas = $16
      WHERE id_orden = $17
    `;
    const values = [
      cedula_cliente, nombre_cliente, correo_cliente, telefono_cliente, direccion_cliente,
      placa_vehiculo, marca_vehiculo, modelo_vehiculo, tipo_vehiculo,
      metodo_pago, caja, id_user_encargado, estado,
      fecha, horaBogota, notas, id
    ];

    await client.query(updateQuery, values);

    if (servicios !== undefined) {
      await client.query("DELETE FROM public.detalle_orden_venta WHERE id_orden = $1", [id]);
      if (servicios && servicios.length > 0) {
        const detalleQuery = `
          INSERT INTO public.detalle_orden_venta
          (id_orden, id_servicio, cantidad, precio_servicio_aplicado)
          VALUES ($1,$2,$3,$4)
        `;
        for (const serv of servicios) {
          await client.query(detalleQuery, [id, serv.id_servicio, serv.cantidad, serv.precio]);
        }
      }
    }
    await client.query("COMMIT");
    res.json({ message: "Orden actualizada correctamente" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Error actualizando orden" });
  } finally {
    client.release();
  }
};

export const deleteOrden = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM public.detalle_orden_venta WHERE id_orden = $1", [id]);
    await pool.query("DELETE FROM public.orden WHERE id_orden = $1", [id]);
    res.json({ message: "Orden eliminada" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error eliminando orden" });
  }
};

export const notificarOrdenLista = async (req, res) => {
  const { nombre, telefono, placa, total } = req.body;
  try {
    await enviarNotificacionSimple(nombre, telefono, placa, total);
    res.json({ message: "Notificación enviada" });
  } catch (error) {
    console.error("Error enviando notificación:", error);
    res.status(500).json({ error: "Error enviando notificación" });
  }
};

export const notificarModificacion = async (req, res) => {
  const { nombre, telefono, placa, total } = req.body;
  try {
    await enviarNotificacionModificacion(nombre, telefono, placa, total);
    res.json({ message: "Notificación de modificación enviada" });
  } catch (error) {
    console.error("Error enviando notificación:", error);
    res.status(500).json({ error: "Error enviando notificación" });
  }
};