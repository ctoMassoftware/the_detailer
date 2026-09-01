import { pool } from '../config/db.js';
import crypto from 'crypto';

/**
 * Generar token seguro para descarga de recibo
 * @param {number} idOrden - ID de orden (null si es venta de mostrador)
 * @param {string} placaVehiculo - Placa del vehículo (null si es venta de mostrador)
 * @param {number} idVenta - ID de venta de mostrador (opcional)
 * @returns {Promise<string>} Token único o null si falla
 */
export const generarTokenRecibo = async (idOrden, placaVehiculo, idVenta = null) => {
  try {
    // Validar que al menos tengamos idOrden o idVenta
    if (!idOrden && !idVenta) {
      throw new Error('Se requiere idOrden o idVenta');
    }

    // Generar token aleatorio (32 bytes = 64 caracteres hex)
    const token = crypto.randomBytes(32).toString('hex');

    // Crear hash del token para almacenar (nunca guardar token en texto plano)
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Insertar en BD
    await pool.query(
      `INSERT INTO recibo_token (id_orden, id_venta, placa_vehiculo, token_hash)
       VALUES ($1, $2, $3, $4)`,
      [idOrden || null, idVenta || null, placaVehiculo || null, tokenHash]
    );

    const tipo = idVenta ? `venta ${idVenta}` : `orden ${idOrden}`;
    console.log(`✓ Token generado para ${tipo}`);
    return token; // Retornar token sin hash (para enviar en SMS)
  } catch (error) {
    console.error('❌ CRÍTICO: Error generando token');
    console.error('   Mensaje:', error.message);
    console.error('   Stack:', error.stack);
    return null;
  }
};

/**
 * Validar token y retornar datos de orden o venta
 * @param {string} token - Token enviado en URL
 * @param {string} placa - Placa del vehículo (opcional, solo para órdenes)
 * @returns {Promise<Object|null>} Datos de recibo (orden o venta) o null si inválido
 */
export const validarTokenRecibo = async (token, placa = null) => {
  try {
    // Hash del token enviado
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Buscar token válido (puede ser de orden o venta)
    const result = await pool.query(
      `SELECT rt.id_orden, rt.id_venta, rt.placa_vehiculo, rt.activo, rt.expira_at,
              COALESCE(o.nombre_cliente, v.cliente_nombre) as nombre_cliente,
              COALESCE(o.correo_cliente, '') as correo_cliente,
              CASE WHEN rt.id_orden IS NOT NULL THEN 'orden' ELSE 'venta' END as tipo_recibo
       FROM recibo_token rt
       LEFT JOIN orden o ON rt.id_orden = o.id_orden
       LEFT JOIN venta_mostrador v ON rt.id_venta = v.id_venta
       WHERE rt.token_hash = $1
         AND rt.activo = true
         AND rt.expira_at > CURRENT_TIMESTAMP`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      console.warn('⚠️ Token inválido o expirado');
      return null;
    }

    const row = result.rows[0];

    // Validar placa (seguridad adicional) - solo si es orden
    if (row.tipo_recibo === 'orden' && placa && String(row.placa_vehiculo).toUpperCase() !== String(placa).toUpperCase()) {
      console.warn(`⚠️ Placa no coincide: ${placa} != ${row.placa_vehiculo}`);
      return null;
    }

    return row;
  } catch (error) {
    console.error('❌ Error validando token:', error.message);
    return null;
  }
};

/**
 * Registrar descarga (solo la primera vez)
 * @param {string} token
 * @param {string} ipCliente
 * @returns {Promise<boolean>}
 */
export const marcarTokenComoDescargado = async (token, ipCliente = null) => {
  try {
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Solo marcar si no está descargado aún (primera vez)
    await pool.query(
      `UPDATE recibo_token
       SET descargado_at = COALESCE(descargado_at, CURRENT_TIMESTAMP),
           ip_descarga = COALESCE(ip_descarga, $1),
           descargas_count = COALESCE(descargas_count, 0) + 1
       WHERE token_hash = $2`,
      [ipCliente, tokenHash]
    );

    console.log('✓ Descarga registrada (token sigue siendo válido)');
    return true;
  } catch (error) {
    console.error('❌ Error registrando descarga:', error.message);
    return false;
  }
};

/**
 * Limpiar tokens expirados (ejecutar periódicamente)
 * @returns {Promise<number>} Cantidad de tokens eliminados
 */
export const limpiarTokensExpirados = async () => {
  try {
    const result = await pool.query(
      `DELETE FROM recibo_token
       WHERE expira_at < CURRENT_TIMESTAMP
         AND descargado_at IS NOT NULL`
    );

    console.log(`🧹 ${result.rowCount} tokens expirados eliminados`);
    return result.rowCount;
  } catch (error) {
    console.error('❌ Error limpiando tokens:', error.message);
    return 0;
  }
};
