import { pool } from '../config/db.js';

export const logMessage = async (messageData) => {
  try {
    const {
      phoneNumber,
      messageBody,
      status,
      twilioSid = null,
      notificationType = null,
      errorDetails = null,
      userId = null,
      orderId = null
    } = messageData;

    const query = `
      INSERT INTO mensaje_audit_log
      (numero_telefono, contenido_mensaje, estado, sid_twilio, error_detalles,
       id_usuario, id_orden, tipo_notificacion)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id_log
    `;

    const values = [
      phoneNumber,
      messageBody,
      status,
      twilioSid,
      errorDetails ? JSON.stringify(errorDetails) : null,
      userId,
      orderId,
      notificationType
    ];

    await pool.query(query, values);
  } catch (error) {
    // Silently log to console - don't block message sending on audit failure
    console.error('Message audit logging failed:', error.message);
  }
};

export const getMessageHistory = async (phoneNumber, limit = 50) => {
  const query = `
    SELECT id_log, numero_telefono, contenido_mensaje, estado,
           timestamp_envio, sid_twilio, tipo_notificacion
    FROM mensaje_audit_log
    WHERE numero_telefono = $1
    ORDER BY timestamp_envio DESC
    LIMIT $2
  `;

  try {
    const result = await pool.query(query, [phoneNumber, limit]);
    return result.rows;
  } catch (error) {
    console.error('Error retrieving message history:', error.message);
    return [];
  }
};

export const getMessageStats = async (filters = {}) => {
  let query = 'SELECT estado, COUNT(*) as count FROM mensaje_audit_log';
  const values = [];
  let whereConditions = [];

  if (filters.status) {
    whereConditions.push(`estado = $${values.length + 1}`);
    values.push(filters.status);
  }

  if (filters.startDate) {
    whereConditions.push(`timestamp_envio >= $${values.length + 1}`);
    values.push(filters.startDate);
  }

  if (filters.endDate) {
    whereConditions.push(`timestamp_envio <= $${values.length + 1}`);
    values.push(filters.endDate);
  }

  if (whereConditions.length > 0) {
    query += ' WHERE ' + whereConditions.join(' AND ');
  }

  query += ' GROUP BY estado';

  try {
    const result = await pool.query(query, values);
    return result.rows;
  } catch (error) {
    console.error('Error retrieving message stats:', error.message);
    return [];
  }
};
