/**
 * Servicio centralizado para asignación de boletas de rifa
 * Usado por: órdenes y ventas de mostrador
 */

/**
 * Obtener la próxima boleta disponible para un evento (DEPRECATED)
 * Nota: Reemplazado por crear siempre boletas nuevas para evitar race conditions
 */
export const obtenerProxBoletaDisponible = async (client, id_evento_rifa, placa_vehiculo = null, id_rifa_filter = null) => {
  return null; // Siempre retorna null para forzar creación de boleta nueva
};

/**
 * Obtener el próximo número de boleta disponible (máximo ASIGNADO + 1)
 * @param {Object} client - Cliente de BD
 * @param {number} id_evento_rifa - ID del evento
 * @returns {string} Número de boleta como string (ej: "070")
 */
export const obtenerProxNumeroBoleta = async (client, id_evento_rifa) => {
  try {
    const result = await client.query(`
      SELECT COALESCE(MAX(CAST(v.numero_rifa AS INTEGER)), 0) as max_numero
      FROM venta_mostrador v
      WHERE v.id_rifa = $1
        AND v.numero_rifa !~ '[^0-9]'
        AND v.numero_rifa ~ '^[0-9]+$'
      UNION
      SELECT COALESCE(MAX(CAST(o.numero_rifa AS INTEGER)), 0) as max_numero
      FROM orden o
      WHERE o.id_rifa = $1
        AND o.numero_rifa !~ '[^0-9]'
        AND o.numero_rifa ~ '^[0-9]+$'
      ORDER BY max_numero DESC
      LIMIT 1
    `, [id_evento_rifa]);

    const maxNumero = result.rows[0]?.max_numero || 0;
    const proximoNumero = maxNumero + 1;
    return proximoNumero.toString().padStart(3, '0');
  } catch (error) {
    if (error.message?.includes('column o.numero_rifa does not exist') || error.code === '42703') {
      console.warn('⚠️ Columna numero_rifa no existe. Creando...');
      try {
        await client.query(`ALTER TABLE orden ADD COLUMN IF NOT EXISTS numero_rifa VARCHAR(10)`);
        await client.query(`ALTER TABLE venta_mostrador ADD COLUMN IF NOT EXISTS numero_rifa VARCHAR(10)`);
        console.log('✅ Columnas creadas. Reintentando...');
        return obtenerProxNumeroBoleta(client, id_evento_rifa);
      } catch (createError) {
        console.error('❌ Error creando columnas:', createError.message);
        throw error;
      }
    }
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
      WHERE ${colId} = $${fecha_sorteo ? 4 : 3}
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
