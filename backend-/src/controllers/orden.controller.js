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
} from "../services/notificationRouter.service.js";
import { enviarNotificacionPorCambioEstado } from "../services/orderStatusNotification.service.js";

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
    cantidad_cascos = 0,
    fecha = null
  } = req.body;

  // 🔍 DEBUG: Log COMPLETO qué datos se reciben
  console.log('📥 [CREATE ORDEN] Datos recibidos:');
  console.log(`  - placa_vehiculo: ${placa_vehiculo}`);
  console.log(`  - nombre_cliente: ${nombre_cliente}`);
  console.log(`  - id_rifa: ${id_rifa} (tipo: ${typeof id_rifa}) ⚠️ CRÍTICO`);
  console.log(`  - fecha: ${fecha}`);
  console.log(`  - hora: ${req.body.hora}`);
  console.log(`  - Full req.body.id_rifa: ${JSON.stringify(req.body.id_rifa)}`);
  console.log(`  - Payload completo: ${JSON.stringify({
    placa_vehiculo, nombre_cliente, id_rifa, fecha,
    servicios: servicios?.length, estado: req.body.estado
  })}`);

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

    if (horaFinal !== null && fecha) {
      ordenQuery = `
        INSERT INTO public.orden (
          cedula_cliente, nombre_cliente, correo_cliente, telefono_cliente, direccion_cliente,
          placa_vehiculo, marca_vehiculo, modelo_vehiculo, tipo_vehiculo,
          metodo_pago, caja, id_user_encargado, id_rifa, notas, sede, deja_casco, cantidad_cascos, fecha, hora
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
        RETURNING id_orden
      `;
      ordenValues = [
        cedula_cliente, nombre_cliente, correo_cliente, telefono_cliente, direccion_cliente,
        placa_vehiculo, marca_vehiculo, modelo_vehiculo, tipo_vehiculo,
        metodo_pago, caja, id_user_encargado, id_rifa, notas, sedeFinal, deja_casco, cantidad_cascos, fecha, horaFinal
      ];
    } else if (fecha) {
      // Con fecha pero sin hora → PostgreSQL usa DEFAULT para hora (Bogotá)
      ordenQuery = `
        INSERT INTO public.orden (
          cedula_cliente, nombre_cliente, correo_cliente, telefono_cliente, direccion_cliente,
          placa_vehiculo, marca_vehiculo, modelo_vehiculo, tipo_vehiculo,
          metodo_pago, caja, id_user_encargado, id_rifa, notas, sede, deja_casco, cantidad_cascos, fecha
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        RETURNING id_orden
      `;
      ordenValues = [
        cedula_cliente, nombre_cliente, correo_cliente, telefono_cliente, direccion_cliente,
        placa_vehiculo, marca_vehiculo, modelo_vehiculo, tipo_vehiculo,
        metodo_pago, caja, id_user_encargado, id_rifa, notas, sedeFinal, deja_casco, cantidad_cascos, fecha
      ];
    } else if (horaFinal !== null) {
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
      // Sin fecha ni hora → PostgreSQL usa DEFAULTs
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

    // ✅ CREAR BOLETA SI PARTICIPA EN RIFA
    if (id_rifa) {
      // Verificar si ya existe boleta para esta placa en este evento
      const boletaExiste = await client.query(
        `SELECT id_boleta FROM rifa WHERE id_evento_rifa = $1 AND UPPER(placa_vehiculo) = UPPER($2) LIMIT 1`,
        [id_rifa, placa_vehiculo]
      );

      if (boletaExiste.rows.length === 0) {
        // No existe, crear nueva boleta
        const numeroBoleta = `BL-${idOrden}`;
        await client.query(
          `INSERT INTO rifa (id_evento_rifa, numero_boleta, nombre, telefono, placa_vehiculo)
           VALUES ($1, $2, $3, $4, $5)`,
          [id_rifa, numeroBoleta, nombre_cliente, telefono_cliente, placa_vehiculo]
        );
        console.log(`✅ Boleta creada para orden ${idOrden}: ${numeroBoleta}`);
      }
    }

    await client.query("COMMIT");

    // 📱 SMS DE BIENVENIDA
    if (telefono_cliente && nombre_cliente && placa_vehiculo) {
      enviarNotificacionInicioServicio(
        telefono_cliente,
        nombre_cliente,
        0,
        placa_vehiculo,
        idOrden
      ).catch((err) => {
        console.error("Error enviando SMS de ingreso:", err);
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
  const body = req.body || {};

  console.log(`📝 updateOrden: ID=${id}, Body type:`, typeof body, 'Keys:', Object.keys(body));

  const {
    cedula_cliente, nombre_cliente, correo_cliente, telefono_cliente, direccion_cliente,
    placa_vehiculo, marca_vehiculo, modelo_vehiculo, tipo_vehiculo,
    metodo_pago, caja, id_user_encargado, estado, id_rifa,
    fecha, hora, notas, servicios, deja_casco, cantidad_cascos
  } = body;

  const client = await pool.connect();

  try {
      // ✅ PRIMERO: Obtener datos ACTUALES de la orden
      const ordenActualResult = await client.query(
        `SELECT cedula_cliente, nombre_cliente, correo_cliente, telefono_cliente, direccion_cliente,
                placa_vehiculo, marca_vehiculo, modelo_vehiculo, tipo_vehiculo,
                metodo_pago, caja, id_user_encargado, estado, fecha, hora, notas, cantidad_cascos
         FROM public.orden WHERE id_orden = $1`,
        [id]
      );

      if (!ordenActualResult.rows[0]) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }

      const ordenActual = ordenActualResult.rows[0];

      // ✅ Usar valores enviados O valores actuales de la BD
      const cedula_final = cedula_cliente !== undefined ? cedula_cliente : ordenActual.cedula_cliente;
      const nombre_final = nombre_cliente !== undefined ? nombre_cliente : ordenActual.nombre_cliente;
      const correo_final = correo_cliente !== undefined ? correo_cliente : ordenActual.correo_cliente;
      const telefono_final = telefono_cliente !== undefined ? telefono_cliente : ordenActual.telefono_cliente;
      const direccion_final = direccion_cliente !== undefined ? direccion_cliente : ordenActual.direccion_cliente;
      const placa_final = placa_vehiculo !== undefined ? placa_vehiculo : ordenActual.placa_vehiculo;
      const marca_final = marca_vehiculo !== undefined ? marca_vehiculo : ordenActual.marca_vehiculo;
      const modelo_final = modelo_vehiculo !== undefined ? modelo_vehiculo : ordenActual.modelo_vehiculo;
      const tipo_final = tipo_vehiculo !== undefined ? tipo_vehiculo : ordenActual.tipo_vehiculo;
      const pago_final = metodo_pago !== undefined ? metodo_pago : ordenActual.metodo_pago;
      const caja_final = caja !== undefined ? caja : ordenActual.caja;
      const user_final = id_user_encargado !== undefined ? id_user_encargado : ordenActual.id_user_encargado;
      const estado_final = estado !== undefined ? estado : ordenActual.estado;
      const fecha_final = (fecha !== undefined && fecha !== '') ? fecha : ordenActual.fecha;
      const hora_final = (hora && hora !== '') ? limpiarHora(hora) : ordenActual.hora;
      const notas_final = notas !== undefined ? notas : ordenActual.notas;

      // Debug: Log si estado no fue enviado
      if (estado === undefined) {
        console.log(`ℹ️ updateOrden: estado no enviado, usando valor actual: ${ordenActual.estado}`);
      }

    await client.query("BEGIN");
    const estadoAnterior = ordenActual.estado;
    const tipoVehiculoActual = tipo_final;
    const cantidadCascosActual = cantidad_cascos ?? (ordenActual.cantidad_cascos || 0);

    // OBTENER TOTAL ACTUAL DE LA ORDEN
    const totalResult = await client.query(
      `SELECT COALESCE(SUM(d.cantidad * d.precio_servicio_aplicado), 0) as total
       FROM public.detalle_orden_venta d
       WHERE d.id_orden = $1`,
      [id]
    );
    const valorTotalActual = totalResult.rows[0]?.total || 0;

    // ✅ Construir UPDATE dinámicamente: solo incluir cantidad_cascos, deja_casco, id_rifa si se envían
    let updateQuery = `
      UPDATE public.orden SET
        cedula_cliente = $1, nombre_cliente = $2, correo_cliente = $3, telefono_cliente = $4, direccion_cliente = $5,
        placa_vehiculo = $6, marca_vehiculo = $7, modelo_vehiculo = $8, tipo_vehiculo = $9,
        metodo_pago = $10, caja = $11, id_user_encargado = $12, estado = $13,
        fecha = $14, hora = $15, notas = $16`;
    const values = [
      cedula_final, nombre_final, correo_final, telefono_final, direccion_final,
      placa_final, marca_final, modelo_final, tipo_final,
      pago_final, caja_final, user_final, estado_final,
      fecha_final, hora_final, notas_final
    ];

    // ✅ Agregar id_rifa si viene
    let paramIndex = values.length + 1;
    if (id_rifa !== undefined && id_rifa !== null) {
      updateQuery += `, id_rifa = $${paramIndex}`;
      values.push(id_rifa);
      paramIndex++;
    }

    // ✅ Solo actualizar deja_casco si viene en el request
    if (deja_casco !== undefined && deja_casco !== null) {
      updateQuery += `, deja_casco = $${paramIndex}`;
      values.push(deja_casco);
      paramIndex++;
    }

    // ✅ Solo actualizar cantidad_cascos si viene en el request
    if (cantidad_cascos !== undefined && cantidad_cascos !== null) {
      updateQuery += `, cantidad_cascos = $${paramIndex}`;
      values.push(cantidad_cascos);
      paramIndex++;
    }

    updateQuery += ` WHERE id_orden = $${paramIndex}`;
    values.push(id);

    console.log(`🔄 Ejecutando UPDATE:`, { query: updateQuery.substring(0, 100), valuesCount: values.length });
    await client.query(updateQuery, values);
    console.log(`✅ UPDATE exitoso para orden ${id}`);

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

    // 📱 DISPARAR NOTIFICACIÓN AUTOMÁTICA SI CAMBIÓ EL ESTADO
    // Normalizar estadoAnterior: si es "null" (string) o null/undefined, tratar como vacío
    const estadoAnteriorNormalizado = (estadoAnterior && estadoAnterior !== 'null') ? estadoAnterior : null;

    console.log(`\n📊 ═══ NOTIFICACIÓN SMS ═══`);
    console.log(`📊 updateOrden - Orden #${id}:`);
    console.log(`   📝 Estado anterior (raw): "${estadoAnterior}" (type: ${typeof estadoAnterior})`);
    console.log(`   📝 Estado anterior (norm): "${estadoAnteriorNormalizado}"`);
    console.log(`   📝 Estado nuevo (enviado): "${estado}" (type: ${typeof estado})`);
    console.log(`   📝 ¿Cambió el estado? ${estadoAnteriorNormalizado !== estado}`);

    // Enviar notificación si: estado cambió Y estado nuevo está definido
    if (estado !== undefined && estadoAnteriorNormalizado !== estado) {
      console.log(`✅ ¡Enviar notificación! Cambio: "${estadoAnteriorNormalizado}" → "${estado}"`);
      console.log(`✅ [NOTIFICACIÓN AUTOMÁTICA] Estado cambió: ${estadoAnterior} → ${estado}`);
      console.log(`🧢 Datos para notificación: tipo=${tipoVehiculoActual}, cascos=${cantidadCascosActual}`);

      const ordenDatos = {
        nombre_cliente: nombre_final,
        telefono_cliente: telefono_final,
        placa_vehiculo: placa_final,
        tipo_vehiculo: tipoVehiculoActual,
        cantidad_cascos: cantidadCascosActual,
        valorTotal: valorTotalActual,
        id_orden: id,
        id_boleta: ordenActual.id_boleta  // ✅ Agregado para SMS con boleta correcta
      };

      // Obtener id_rifa: usar el del request si viene, si no usar el actual de BD
      const id_rifa_final = id_rifa !== undefined ? id_rifa : ordenActual.id_rifa;

      enviarNotificacionPorCambioEstado(
        estadoAnterior,
        estado,
        ordenDatos,
        id_rifa_final // ✅ Pasar id_rifa para SMS con rifa
      ).catch(err => {
        console.error('⚠️ Error enviando notificación automática:', err);
      });
    } else {
      console.log(`⚠️ NO se envió SMS:`);
      if (!estadoAnterior) console.log(`   - estadoAnterior es vacío`);
      if (estado === undefined) console.log(`   - estado es undefined`);
      if (estadoAnterior === estado) console.log(`   - estados iguales: ${estadoAnterior}`);
    }

    res.json({ message: "Orden actualizada correctamente" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Error actualizando orden" });
  } finally {
    client.release();
  }
}

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
  const { nombre, telefono, total, placa } = req.body;
  try {
    await enviarNotificacionOrdenListaSinRifa(telefono, nombre, total, placa);
    res.json({ message: "Notificación enviada" });
  } catch (error) {
    console.error("Error enviando notificación:", error);
    res.status(500).json({ error: "Error enviando notificación" });
  }
};

export const notificarModificacion = async (req, res) => {
  const { nombre, telefono, placa, total } = req.body;
  try {
    const detallesCambio = placa
      ? `🚗 Placa: ${placa}\n💰 Nuevo total: $${total?.toLocaleString?.('es-CO') || total || 0}`
      : `💰 Nuevo total: $${total?.toLocaleString?.('es-CO') || total || 0}`;

    await enviarNotificacionModificacion(telefono, nombre, detallesCambio);
    res.json({ message: "Notificación de modificación enviada" });
  } catch (error) {
    console.error("Error enviando notificación:", error);
    res.status(500).json({ error: "Error enviando notificación" });
  }
};