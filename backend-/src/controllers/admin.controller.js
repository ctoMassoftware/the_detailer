import { pool } from '../config/db.js';

// ============================================================
// MIGRATION: Ejecutar migration de rifas securizadas
// ============================================================
// SOLO SUPER_ADMIN puede ejecutar esto
// Safe: usa CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS

export const executeMigrationRifasSecured = async (req, res) => {
  const { rol } = req.user || {};

  // Proteger: Solo SUPER_ADMIN
  if (rol !== 'SUPER_ADMIN') {
    return res.status(403).json({
      error: 'Solo SUPER_ADMIN puede ejecutar migraciones',
      rol_actual: rol
    });
  }

  const client = await pool.connect();

  try {
    console.log('🔄 Iniciando migration de rifas securizadas...');

    // ============================================================
    // PASO 1: Agregar columna 'sede' a evento_rifa (SI NO EXISTE)
    // ============================================================
    console.log('  1️⃣ Agregando columna sede a evento_rifa...');
    await client.query(`
      ALTER TABLE evento_rifa
      ADD COLUMN IF NOT EXISTS sede VARCHAR(100) DEFAULT 'GLOBAL';
    `);
    console.log('     ✅ Columna sede creada (o ya existe)');

    // ============================================================
    // PASO 2: Crear índices para búsqueda rápida
    // ============================================================
    console.log('  2️⃣ Creando índices de rendimiento...');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_evento_rifa_sede ON evento_rifa(sede);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_evento_rifa_estado_sede ON evento_rifa(estado, sede);`);
    console.log('     ✅ Índices creados');

    // ============================================================
    // PASO 3: Crear tabla rifa_asignacion_audit (AUDITORÍA)
    // ============================================================
    console.log('  3️⃣ Creando tabla de auditoría...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS rifa_asignacion_audit (
        id SERIAL PRIMARY KEY,
        id_evento_rifa INTEGER NOT NULL,
        id_orden INTEGER NOT NULL,
        numero_boleta VARCHAR(10),
        fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        usuario_asigno VARCHAR(100),
        sede VARCHAR(100),
        FOREIGN KEY (id_evento_rifa) REFERENCES evento_rifa(id_evento) ON DELETE CASCADE,
        FOREIGN KEY (id_orden) REFERENCES orden(id_orden) ON DELETE CASCADE
      );
    `);
    console.log('     ✅ Tabla de auditoría creada');

    // Índices para auditoría
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rifa_asignacion_audit_orden ON rifa_asignacion_audit(id_orden);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rifa_asignacion_audit_evento ON rifa_asignacion_audit(id_evento_rifa);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rifa_asignacion_audit_sede ON rifa_asignacion_audit(sede);`);
    console.log('     ✅ Índices de auditoría creados');

    // ============================================================
    // PASO 4: Agregar columna sede a tabla rifa
    // ============================================================
    console.log('  4️⃣ Agregando columna sede a tabla rifa...');
    await client.query(`
      ALTER TABLE rifa
      ADD COLUMN IF NOT EXISTS sede VARCHAR(100) DEFAULT 'GLOBAL';
    `);
    console.log('     ✅ Columna sede en rifa creada');

    // Índice para rifa
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rifa_sede ON rifa(sede);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rifa_evento_sede ON rifa(id_evento_rifa, sede);`);
    console.log('     ✅ Índices de rifa creados');

    // ============================================================
    // PASO 5: Crear tabla rifa_numero_disponible (CONTROL DE BOLETAS)
    // ============================================================
    console.log('  5️⃣ Creando tabla de control de números...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS rifa_numero_disponible (
        id SERIAL PRIMARY KEY,
        id_evento_rifa INTEGER NOT NULL,
        numero_boleta VARCHAR(10),
        disponible BOOLEAN DEFAULT TRUE,
        asignado_a_orden INTEGER,
        sede VARCHAR(100),
        fecha_asignacion TIMESTAMP,
        FOREIGN KEY (id_evento_rifa) REFERENCES evento_rifa(id_evento) ON DELETE CASCADE,
        UNIQUE (id_evento_rifa, numero_boleta)
      );
    `);
    console.log('     ✅ Tabla de números disponibles creada');

    // Índices para disponibilidad
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rifa_numero_disponible ON rifa_numero_disponible(id_evento_rifa, disponible, sede);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rifa_numero_sede ON rifa_numero_disponible(sede);`);
    console.log('     ✅ Índices de disponibilidad creados');

    // ============================================================
    // PASO 6: Generar números disponibles (000-999) para rifas existentes
    // ============================================================
    console.log('  6️⃣ Generando números disponibles (000-999) para rifas existentes...');

    const rifasExistentes = await client.query(`
      SELECT DISTINCT id_evento_rifa FROM rifa;
    `);

    for (const rifa of rifasExistentes.rows) {
      const idEvento = rifa.id_evento_rifa;

      // Obtener sede de la rifa
      const sedeRifa = await client.query(`
        SELECT sede FROM evento_rifa WHERE id_evento = $1;
      `, [idEvento]);

      const sede = sedeRifa.rows[0]?.sede || 'GLOBAL';

      // Insertar números 000-999
      for (let i = 0; i < 1000; i++) {
        const numero = String(i).padStart(3, '0');

        // Verificar si el número ya existe
        const existe = await client.query(
          `SELECT 1 FROM rifa_numero_disponible WHERE id_evento_rifa = $1 AND numero_boleta = $2;`,
          [idEvento, numero]
        );

        if (existe.rows.length === 0) {
          // Verificar si ya está asignado en la tabla rifa
          const yaAsignado = await client.query(
            `SELECT 1 FROM rifa WHERE id_evento_rifa = $1 AND numero_boleta = $2;`,
            [idEvento, numero]
          );

          await client.query(
            `INSERT INTO rifa_numero_disponible (id_evento_rifa, numero_boleta, disponible, sede)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT DO NOTHING;`,
            [idEvento, numero, yaAsignado.rows.length === 0, sede]
          );
        }
      }

      console.log(`     ✅ Rifa ${idEvento}: 1000 números generados (Sede: ${sede})`);
    }

    // ============================================================
    // PASO 7: Crear vista para reportes
    // ============================================================
    console.log('  7️⃣ Creando vista para reportes...');
    await client.query(`
      CREATE OR REPLACE VIEW vw_rifas_disponibles_sede AS
      SELECT
        er.id_evento,
        er.fecha_sorteo,
        er.descripcion_premios,
        er.encargado,
        er.estado,
        er.sede,
        COUNT(CASE WHEN rnd.disponible = TRUE THEN 1 END) as numeros_disponibles,
        COUNT(CASE WHEN rnd.disponible = FALSE THEN 1 END) as numeros_asignados,
        1000 - COUNT(CASE WHEN rnd.disponible = FALSE THEN 1 END) as numeros_totales_restantes
      FROM evento_rifa er
      LEFT JOIN rifa_numero_disponible rnd ON er.id_evento = rnd.id_evento_rifa
      GROUP BY er.id_evento, er.fecha_sorteo, er.descripcion_premios, er.encargado, er.estado, er.sede;
    `);
    console.log('     ✅ Vista de reportes creada');

    // ============================================================
    // VERIFICACIÓN FINAL
    // ============================================================
    console.log('  8️⃣ Verificando integridad...');

    const tablas = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('evento_rifa', 'rifa', 'rifa_asignacion_audit', 'rifa_numero_disponible');
    `);

    const columnaSede = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'evento_rifa' AND column_name = 'sede';
    `);

    const indiceCount = await client.query(`
      SELECT COUNT(*) as cantidad FROM pg_indexes
      WHERE schemaname = 'public'
      AND (indexname LIKE 'idx_%rifa%' OR indexname LIKE 'idx_%numero%');
    `);

    const numerosCount = await client.query(`
      SELECT COUNT(*) as cantidad FROM rifa_numero_disponible;
    `);

    console.log('     ✅ Verificación completada:');
    console.log(`        - Tablas encontradas: ${tablas.rows.length}`);
    console.log(`        - Columna 'sede' en evento_rifa: ${columnaSede.rows.length > 0 ? '✅' : '❌'}`);
    console.log(`        - Índices creados: ${indiceCount.rows[0].cantidad}`);
    console.log(`        - Números disponibles generados: ${numerosCount.rows[0].cantidad}`);

    console.log('\n✅ MIGRATION COMPLETADA EXITOSAMENTE\n');

    res.json({
      success: true,
      message: 'Migration de rifas securizadas completada exitosamente',
      detalles: {
        tablas_creadas: tablas.rows.length,
        columna_sede_evento_rifa: columnaSede.rows.length > 0,
        indices_creados: indiceCount.rows[0].cantidad,
        numeros_disponibles_generados: numerosCount.rows[0].cantidad,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('\n❌ ERROR EN MIGRATION:\n', error.message);
    res.status(500).json({
      success: false,
      error: 'Error ejecutando migration',
      detalles: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    client.release();
  }
};

// ============================================================
// VERIFICAR ESTADO DE MIGRATION
// ============================================================
export const checkMigrationStatus = async (req, res) => {
  try {
    const verificaciones = {};

    // Verificar tabla evento_rifa con columna sede
    try {
      const resultado = await pool.query(
        `SELECT COUNT(*) FROM information_schema.columns
         WHERE table_name = 'evento_rifa' AND column_name = 'sede';`
      );
      verificaciones.evento_rifa_sede = resultado.rows[0].count > 0;
    } catch (e) {
      verificaciones.evento_rifa_sede = false;
    }

    // Verificar tabla rifa_asignacion_audit
    try {
      const resultado = await pool.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'rifa_asignacion_audit');`
      );
      verificaciones.rifa_asignacion_audit = resultado.rows[0].exists;
    } catch (e) {
      verificaciones.rifa_asignacion_audit = false;
    }

    // Verificar tabla rifa_numero_disponible
    try {
      const resultado = await pool.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'rifa_numero_disponible');`
      );
      verificaciones.rifa_numero_disponible = resultado.rows[0].exists;
    } catch (e) {
      verificaciones.rifa_numero_disponible = false;
    }

    // Verificar índices
    try {
      const resultado = await pool.query(
        `SELECT COUNT(*) as cantidad FROM pg_indexes
         WHERE schemaname = 'public' AND indexname LIKE 'idx_%rifa%';`
      );
      verificaciones.indices_rifa = resultado.rows[0].cantidad;
    } catch (e) {
      verificaciones.indices_rifa = 0;
    }

    // Verificar números disponibles
    try {
      const resultado = await pool.query(`SELECT COUNT(*) as cantidad FROM rifa_numero_disponible;`);
      verificaciones.numeros_disponibles = resultado.rows[0].cantidad;
    } catch (e) {
      verificaciones.numeros_disponibles = 0;
    }

    const allCompleted = Object.values(verificaciones).every(v => v !== false && v > 0);

    res.json({
      migration_status: allCompleted ? 'COMPLETADA ✅' : 'INCOMPLETA ⚠️',
      verificaciones,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error verificando migration:', error);
    res.status(500).json({
      error: 'Error verificando status de migration',
      detalles: error.message
    });
  }
};
