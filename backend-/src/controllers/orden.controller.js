// Buscar clientes o placas por coincidencia parcial
export const buscarClientesPlacas = async (req, res) => {
  const { query } = req.query;
  if (!query || query.length < 2) {
    return res.status(400).json({ error: 'Query demasiado corta' });
  }
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT DISTINCT nombre_cliente, placa_vehiculo, telefono_cliente, tipo_vehiculo, marca_vehiculo, modelo_vehiculo
       FROM public.orden
       WHERE nombre_cliente ILIKE $1 OR placa_vehiculo ILIKE $1
       ORDER BY nombre_cliente
       LIMIT 10`,
      [`%${query}%`]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error buscando clientes/placas' });
  } finally {
    client.release();
  }
};
import { pool } from "../config/db.js";
import { DateTime } from "luxon";
import {
  enviarNotificacionInicioServicio,
  enviarNotificacionSimple,
  enviarNotificacionModificacion,
  enviarNotificacionOrdenListaSinRifa
} from "../services/whatsapp.service.js";

// ✅ Limpia la hora recibida del frontend a formato "HH:mm"
// El frontend ya manda la hora en Bogotá (hora local del navegador), NO hay que convertir
function limpiarHora(hora) {
  if (!hora) return null;

  // Si viene como "HH:mm" o "HH:mm:ss" → simplemente recortamos a "HH:mm"
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(hora)) {
    return hora.substring(0, 5);
  }

  // Si viene como ISO: "2025-04-22T14:30:00" (sin Z = hora local) → extraemos solo HH:mm
  if (hora.includes('T')) {
    return hora.split('T')[1].substring(0, 5);
  }

  return null;
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
    sede,
    deja_casco = false,
    cantidad_cascos = 0
  } = req.body;

  const sedeFinal = rol === "SUPER_ADMIN" && sede ? sede : sedeUsuario || "GLOBAL";
  const client = await pool.connect();

  // ✅ El frontend manda la hora local de Bogotá, solo la limpiamos
  // Si no viene hora, PostgreSQL usa el DEFAULT (también en hora Bogotá)
  const horaFinal = req.body.hora ? limpiarHora(req.body.hora) : null;

  try {
    await client.query("BEGIN");

    // Si viene hora la incluimos en el INSERT, si no la omitimos para que use el DEFAULT
    let ordenQuery;
    let ordenValues;

    if (horaFinal !== null) {
      ordenQuery = `
        INSERT INTO public.orden (
          cedula_cliente, nombre_cliente, correo_cliente, telefono_cliente, direccion_cliente,
          placa_vehiculo, marca_vehiculo, modelo_vehiculo, tipo_vehiculo,
          metodo_pago, caja, id_user_encargado, id_rifa, notas, sede, deja_casco, cantidad_cascos, hora
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        RETURNING id_orden
      `;
      ordenValues = [
        cedula_cliente, nombre_cliente, correo_cliente, telefono_cliente, direccion_cliente,
        placa_vehiculo, marca_vehiculo, modelo_vehiculo, tipo_vehiculo,
        metodo_pago, caja, id_user_encargado, id_rifa, notas, sedeFinal, deja_casco, cantidad_cascos, horaFinal
      ];
    } else {
      // Sin hora → PostgreSQL usa DEFAULT (hora Bogotá automática)
      ordenQuery = `
        INSERT INTO public.orden (
          cedula_cliente, nombre_cliente, correo_cliente, telefono_cliente, direccion_cliente,
          placa_vehiculo, marca_vehiculo, modelo_vehiculo, tipo_vehiculo,
          metodo_pago, caja, id_user_encargado, id_rifa, notas, sede, deja_casco, cantidad_cascos
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        RETURNING id_orden
      `;
      ordenValues = [
        cedula_cliente, nombre_cliente, correo_cliente, telefono_cliente, direccion_cliente,
        placa_vehiculo, marca_vehiculo, modelo_vehiculo, tipo_vehiculo,
        metodo_pago, caja, id_user_encargado, id_rifa, notas, sedeFinal, deja_casco, cantidad_cascos
      ];
    }

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

    // ✅ La hora ya está guardada en Bogotá, solo formateamos a "HH:mm"
    const rows = result.rows.map(row => ({
      ...row,
      hora: row.hora ? String(row.hora).substring(0, 5) : null
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

  // ✅ El frontend ya manda hora en Bogotá, solo limpiamos el formato
  const horaFinal = hora ? limpiarHora(hora) : null;

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
      fecha, horaFinal, notas, id
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
  console.log('[DEBUG] notificarOrdenLista params:', { nombre, telefono, placa, total });
  try {
    await enviarNotificacionOrdenListaSinRifa(nombre, telefono, placa, total);
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