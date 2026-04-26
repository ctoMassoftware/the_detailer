// Script para poner inactivos a todos los operarios a las 9pm
import { pool } from './src/config/db.js';

async function inactivarOperarios() {
  try {
    const result = await pool.query(
      "UPDATE usuarios SET estado_operario = false WHERE LOWER(rol) = 'operario' AND estado_operario = true"
    );
    console.log(`Operarios inactivados: ${result.rowCount}`);
  } catch (error) {
    console.error('Error al inactivar operarios:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

inactivarOperarios();
