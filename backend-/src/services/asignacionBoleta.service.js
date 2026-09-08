/**
 * Servicio centralizado para asignación de boletas de rifa
 * Usado por: órdenes y ventas de mostrador
 */

/**
 * Obtener la próxima boleta disponible para un evento
 * @param {Object} client - Cliente de BD (transacción)
 * @param {number} id_evento_rifa - ID del evento de rifa
 * @param {string} placa_vehiculo - Placa del vehículo (opcional, para órdenes)
 * @returns {Object} { id_boleta, numero_boleta } o null si no hay disponible
 */
export const obtenerProxBoletaDisponible = async (client, id_evento_rifa, placa_vehiculo = null, id_rifa_filter = null) => {
  try {
    const query = `
      SELECT r.id_boleta, r.numero_boleta
      FROM rifa r
      WHERE r.id_evento_rifa = $1
        AND r.id_boleta NOT IN (
          SELECT DISTINCT id_boleta
          FROM orden
          WHERE id_boleta IS NOT NULL AND id_rifa = $2
          UNION
          SELECT DISTINCT id_boleta
          FROM venta_mostrador
          WHERE id_boleta IS NOT NULL AND id_rifa = $2
        )
        AND r.numero_boleta ~ '^[0-9]+$'
        ${placa_vehiculo ? 'AND UPPER(r.placa_vehiculo) = UPPER($3)' : ''}
      ORDER BY CAST(r.numero_boleta AS INTEGER) DESC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;

    const params = [id_evento_rifa, id_rifa_filter || id_evento_rifa];
    if (placa_vehiculo) params.push(placa_vehiculo);

    const result = await client.query(query, params);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('❌ Error obteniendo próxima boleta disponible:', error.message);
    throw error;
  }
};

/**
 * Obtener el próximo número de boleta disponible (máximo + 1)
 * @param {Object} client - Cliente de BD
 * @param {number} id_evento_rifa - ID del evento
 * @returns {string} Número de boleta como string (ej: "070")
 */
export const obtenerProxNumeroBoleta = async (client, id_evento_rifa) => {
  try {
    const result = await client.query(`
      SELECT COALESCE(MAX(CAST(numero_boleta AS INTEGER)), 0) as max_numero
      FROM rifa
      WHERE id_evento_rifa = $1
        AND numero_boleta ~ '^[0-9]+$'
    `, [id_evento_rifa]);

    const maxNumero = result.rows[0]?.max_numero || 0;
    const proximoNumero = maxNumero + 1;
    return proximoNumero.toString().padStart(3, '0');
  } catch (error) {
    console.error('❌ Error obteniendo próximo número de boleta:', error.message);
    throw error;
  }
};

/**
 * Asignar boleta a una orden o venta
 * @param {Object} client - Cliente de BD
 * @param {string} tipoRegistro - 'orden' o 'venta_mostrador'
 * @param {number} id_registro - id_orden o id_venta
 * @param {number} id_boleta - ID de la boleta a asignar
 * @param {string} numero_boleta - Número de la boleta
 * @param {Date} fecha_sorteo - Fecha del sorteo
 * @returns {boolean} true si se asignó correctamente
 */
export const asignarBoleta = async (client, tipoRegistro, id_registro, id_boleta, numero_boleta, fecha_sorteo = null) => {
  try {
    const tabla = tipoRegistro === 'orden' ? 'orden' : 'venta_mostrador';
    const colId = tipoRegistro === 'orden' ? 'id_orden' : 'id_venta';

    const resultado = await client.query(`
      UPDATE ${tabla}
      SET
        id_boleta = $1,
        numero_rifa = $2
        ${fecha_sorteo ? ', fecha_sorteo = $3' : ''}
      WHERE ${colId} = $${fecha_sorteo ? '4' : '3'}
      RETURNING id_boleta, numero_rifa
    `, fecha_sorteo
      ? [id_boleta, numero_boleta, fecha_sorteo, id_registro]
      : [id_boleta, numero_boleta, id_registro]
    );

    if (resultado.rows.length === 0) {
      throw new Error(`No se pudo asignar boleta a ${tipoRegistro} ${id_registro}`);
    }

    console.log(`✅ Boleta #${numero_boleta} asignada a ${tipoRegistro} ${id_registro}`);
    return true;
  } catch (error) {
    console.error(`❌ Error asignando boleta:`, error.message);
    throw error;
  }
};

/**
 * Crear nueva boleta si no hay disponibles
 * @param {Object} client - Cliente de BD
 * @param {number} id_evento_rifa - ID del evento
 * @param {string} nombre_cliente - Nombre del cliente
 * @param {string} telefono_cliente - Teléfono del cliente
 * @param {string} placa_vehiculo - Placa del vehículo
 * @returns {Object} { id_boleta, numero_boleta }
 */
export const crearBoletaNueva = async (client, id_evento_rifa, nombre_cliente, telefono_cliente, placa_vehiculo) => {
  try {
    const numeroBoleta = await obtenerProxNumeroBoleta(client, id_evento_rifa);

    const resultado = await client.query(`
      INSERT INTO rifa (
        id_evento_rifa, numero_boleta, nombre, telefono, placa_vehiculo
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id_boleta, numero_boleta
    `, [id_evento_rifa, numeroBoleta, nombre_cliente, telefono_cliente, placa_vehiculo]);

    const boleta = resultado.rows[0];
    console.log(`✅ Boleta nueva creada: #${boleta.numero_boleta} para evento ${id_evento_rifa}`);
    return boleta;
  } catch (error) {
    console.error('❌ Error creando boleta nueva:', error.message);
    throw error;
  }
};
