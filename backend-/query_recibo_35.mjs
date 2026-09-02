import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  user: 'postgres',
  password: 'your_password',
  host: 'localhost',
  port: 5432,
  database: 'the_detailer_db'
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
      WHERE id_venta = 35
    `);

    if (result.rows.length > 0) {
      console.log('\n✅ RECIBO 35 ENCONTRADO:\n');
      const row = result.rows[0];
      console.log(`ID Venta: ${row.id_venta}`);
      console.log(`Cliente: ${row.cliente_nombre}`);
      console.log(`Teléfono: ${row.telefono_cliente}`);
      console.log(`Total: $${row.total}`);
      console.log(`Fecha: ${row.fecha}`);
      console.log(`Hora: ${row.hora}`);
      console.log(`\n🎰 INFORMACIÓN DE RIFA:`);
      console.log(`Número de Boleta: ${row.numero_rifa || 'NO TIENE (NULL)'}`);
      console.log(`ID Rifa: ${row.id_rifa || 'NO TIENE (NULL)'}`);
      console.log(`ID Boleta: ${row.id_boleta || 'NO TIENE (NULL)'}`);
      console.log(`Fecha Sorteo: ${row.fecha_sorteo || 'NO TIENE (NULL)'}`);
      console.log('\n=== ANÁLISIS ===');
      if (row.id_rifa === null) {
        console.log('⚠️  id_rifa es NULL → La boleta nunca se registró en venta_mostrador');
      }
      if (row.numero_rifa === null) {
        console.log('⚠️  numero_rifa es NULL → El UPDATE en tabla rifa no completó');
      }
      if (row.id_boleta === null) {
        console.log('⚠️  id_boleta es NULL → El INSERT en tabla rifa falló');
      }
      if (row.numero_rifa && row.id_rifa && row.id_boleta) {
        console.log('✅ Todos los campos de rifa tienen valores. Problema podría estar en el endpoint de recibos.');
      }
    } else {
      console.log('❌ Recibo 35 no encontrado en la base de datos');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

buscar();
