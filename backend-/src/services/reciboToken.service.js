import { pool } from '../config/db.js';
import crypto from 'crypto';

/**
 * Generar token seguro para descarga de recibo
 * @param {number} idOrden
 * @param {string} placaVehiculo
 * @returns {Promise<string>} Token único o null si falla
 */
export const generarTokenRecibo = async (idOrden, placaVehiculo) => {
  try {
    // Generar token aleatorio (32 bytes = 64 caracteres hex)
    const token = crypto.randomBytes(32).toString('hex');

    // Crear hash del token para almacenar (nunca guardar token en texto plano)
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Insertar en BD
    await pool.query(
      `INSERT INTO recibo_token (id_orden, placa_vehiculo, token_hash)
       VALUES ($1, $2, $3)`,
      [idOrden, placaVehiculo, tokenHash]
    );

    console.log(`✓ Token generado para orden ${idOrden}`);
    return token; // Retornar token sin hash (para enviar en SMS)
  } catch (error) {
    console.error('❌ CRÍTICO: Error generando token para orden', idOrden);
    console.error('   Mensaje:', error.message);
    console.error('   Código:', error.code);
    console.error('   Stack:', error.stack);
    return null;
  }
};

/**
 * Validar token y retornar datos de orden
 * @param {string} token - Token enviado en URL
 * @param {string} placa - Placa del vehículo (para validación adicional)
 * @returns {Promise<Object|null>} Datos de orden o null si inválido
 */
export const validarTokenRecibo = async (token, placa = null) => {
  try {
    // Hash del token enviado
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Buscar token válido - NO requiere que descargado_at sea NULL
    // Solo verifica que esté activo y no expirado
    const result = await pool.query(
      `SELECT rt.id_orden, rt.placa_vehiculo, o.nombre_cliente, o.correo_cliente
       FROM recibo_token rt
       JOIN orden o ON rt.id_orden = o.id_orden
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

    // Validar placa (seguridad adicional) - case-insensitive
    if (placa && String(row.placa_vehiculo).toUpperCase() !== String(placa).toUpperCase()) {
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
