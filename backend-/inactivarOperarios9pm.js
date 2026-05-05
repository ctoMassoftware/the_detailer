import { pool } from '../config/db.js';

export async function inactivarOperarios() {
  try {
    const result = await pool.query(
      "UPDATE usuarios SET estado_operario = false WHERE LOWER(rol) = 'operario' AND estado_operario = true"
    );
    console.log(`✅ [CRON] Operarios inactivados correctamente a las 9PM: ${result.rowCount}`);
  } catch (error) {
    console.error('❌ [CRON] Error al inactivar operarios:', error);
  }
  
}