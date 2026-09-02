import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  user: 'postgres',
  password: 'postgres',
  host: 'localhost',
  port: 5432,
  database: 'the_detailer'
});

async function buscar() {
  try {
    const result = await pool.query(`
      SELECT 
        id_venta,
        cliente_nombre,
        telefono_cliente,
        numero_rifa,
        id_rifa,
        id_boleta,
        fecha_sorteo,
        fecha,
        hora,
        total
      FROM venta_mostrador 
      WHERE id_venta = 28
    `);
    
    if (result.rows.length > 0) {
      console.log('\n✅ RECIBO 28 ENCONTRADO:\n');
      const row = result.rows[0];
      console.log(`ID Venta: ${row.id_venta}`);
      console.log(`Cliente: ${row.cliente_nombre}`);
      console.log(`Teléfono: ${row.telefono_cliente}`);
      console.log(`Total: $${row.total}`);
      console.log(`Fecha: ${row.fecha}`);
      console.log(`Hora: ${row.hora}`);
      console.log(`\n🎰 INFORMACIÓN DE RIFA:`);
      console.log(`Número de Boleta: ${row.numero_rifa || 'No tiene'}`);
      console.log(`ID Rifa: ${row.id_rifa || 'No tiene'}`);
      console.log(`ID Boleta: ${row.id_boleta || 'No tiene'}`);
      console.log(`Fecha Sorteo: ${row.fecha_sorteo || 'No tiene'}`);
    } else {
      console.log('❌ Recibo 28 no encontrado');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

buscar();
