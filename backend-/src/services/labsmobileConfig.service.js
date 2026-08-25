import { pool } from '../config/db.js';

/**
 * Obtener credenciales de LabsMobile desde la BD
 * @returns {Promise<Object|null>} Credenciales o null si no existen
 */
export const getLabsMobileCredentialsFromDB = async () => {
  try {
    const result = await pool.query(
      `SELECT username, api_token, sender
       FROM config_labsmobile
       WHERE activo = true
       ORDER BY actualizado_at DESC
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      username: row.username,
      apiToken: row.api_token,
      sender: row.sender
    };
  } catch (error) {
    console.error('❌ Error obteniendo credenciales de BD:', error.message);
    return null;
  }
};

/**
 * Actualizar credenciales de LabsMobile en la BD
 * @param {string} username
 * @param {string} apiToken
 * @param {string} sender
 * @returns {Promise<boolean>} true si fue exitoso
 */
export const updateLabsMobileCredentials = async (username, apiToken, sender = 'DETAILER') => {
  try {
    await pool.query(
      `UPDATE config_labsmobile
       SET username = $1, api_token = $2, sender = $3, actualizado_at = CURRENT_TIMESTAMP
       WHERE activo = true`,
      [username, apiToken, sender]
    );

    console.log('✅ Credenciales LabsMobile actualizadas en BD');
    return true;
  } catch (error) {
    console.error('❌ Error actualizando credenciales:', error.message);
    return false;
  }
};

/**
 * Resolver credenciales: parámetro → BD → variables de entorno
 * @param {Object} credentialsParam - Credenciales opcionales del parámetro
 * @param {Object} dbCredentials - Credenciales de la BD (pre-obtenidas)
 * @returns {Object} Credenciales a usar
 */
export const resolveCredentials = (credentialsParam = null, dbCredentials = null) => {
  // 1. Si se pasan credenciales como parámetro, usar esas
  if (credentialsParam?.username && credentialsParam?.apiToken) {
    return credentialsParam;
  }

  // 2. Si hay credenciales de BD, usar esas
  if (dbCredentials?.username && dbCredentials?.apiToken) {
    return dbCredentials;
  }

  // 3. Fallback a variables de entorno
  return {
    username: process.env.LABSMOBILE_USERNAME,
    apiToken: process.env.LABSMOBILE_API_TOKEN,
    sender: process.env.LABSMOBILE_SENDER || 'DETAILER'
  };
};
