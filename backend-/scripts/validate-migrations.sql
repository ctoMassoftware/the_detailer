-- 🔍 VALIDACIÓN DE MIGRACIONES PRE-DEPLOY
-- Script para verificar que las migraciones están listas antes de aplicarlas

\echo '════════════════════════════════════════════════════════════════'
\echo '🔍 VALIDANDO MIGRACIONES PENDIENTES'
\echo '════════════════════════════════════════════════════════════════'

-- 1️⃣ VALIDAR TABLA venta_mostrador
\echo ''
\echo '1️⃣ Verificando tabla venta_mostrador...'
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name='venta_mostrador'
ORDER BY ordinal_position;

\echo ''
\echo '✓ Verificando si columna id_rifa EXISTE:'
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='venta_mostrador' AND column_name='id_rifa'
    ) THEN '✅ EXISTE'
    ELSE '❌ NO EXISTE - Se creará en migración'
  END as id_rifa_status;

-- 2️⃣ VALIDAR TABLA orden
\echo ''
\echo '2️⃣ Verificando tabla orden...'
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name='orden'
ORDER BY ordinal_position;

\echo ''
\echo '✓ Verificando si columna con_rifa_desde_inicio EXISTE:'
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='orden' AND column_name='con_rifa_desde_inicio'
    ) THEN '✅ EXISTE'
    ELSE '❌ NO EXISTE - Se creará en migración'
  END as con_rifa_desde_inicio_status;

-- 3️⃣ VALIDAR TABLA evento_rifa (referencia)
\echo ''
\echo '3️⃣ Verificando tabla evento_rifa (referencia)...'
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name='evento_rifa' AND column_name IN ('id_evento')
ORDER BY ordinal_position;

-- 4️⃣ VALIDAR TABLA rifa (referencia)
\echo ''
\echo '4️⃣ Verificando tabla rifa (referencia)...'
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name='rifa' AND column_name IN ('id_boleta', 'numero_rifa')
ORDER BY ordinal_position;

-- 5️⃣ VALIDAR DATOS EXISTENTES
\echo ''
\echo '5️⃣ Estadísticas de datos ANTES de migración...'
\echo ''
\echo '📊 Órdenes en BD:'
SELECT COUNT(*) as total_ordenes FROM orden;

\echo ''
\echo '📊 Órdenes con id_rifa:'
SELECT COUNT(*) as ordenes_con_rifa FROM orden WHERE id_rifa IS NOT NULL;

\echo ''
\echo '📊 Ventas mostrador en BD:'
SELECT COUNT(*) as total_ventas FROM venta_mostrador;

\echo ''
\echo '📊 Ventas con id_rifa:'
SELECT COUNT(*) as ventas_con_rifa FROM venta_mostrador WHERE id_rifa IS NOT NULL;

-- 6️⃣ VALIDAR RIFA TABLE
\echo ''
\echo '📊 Boletas en tabla rifa:'
SELECT COUNT(*) as total_boletas FROM rifa;

\echo ''
\echo '📊 Boletas con número_rifa:'
SELECT COUNT(*) as boletas_con_numero FROM rifa WHERE numero_rifa IS NOT NULL;

-- 7️⃣ BUSCAR DUPLICADOS
\echo ''
\echo '7️⃣ Verificando duplicados de números de boleta...'
SELECT
  numero_boleta,
  id_evento_rifa,
  COUNT(*) as cantidad_duplicados
FROM rifa
WHERE numero_rifa IS NOT NULL
GROUP BY numero_rifa, id_evento_rifa
HAVING COUNT(*) > 1
ORDER BY numero_boleta;

\echo ''
\echo '✓ Si la consulta anterior no retornó filas = ✅ NO HAY DUPLICADOS'

-- 8️⃣ VALIDAR REFERENCIAS
\echo ''
\echo '8️⃣ Verificando integridad de referencias...'
\echo ''
\echo '✓ Órdenes con id_rifa que NO existe en evento_rifa:'
SELECT COUNT(*) as referencia_rota FROM orden
WHERE id_rifa IS NOT NULL
AND id_rifa NOT IN (SELECT id_evento FROM evento_rifa);

\echo ''
\echo '✓ Órdenes con id_boleta que NO existe en rifa:'
SELECT COUNT(*) as referencia_rota FROM orden
WHERE id_boleta IS NOT NULL
AND id_boleta NOT IN (SELECT id_boleta FROM rifa);

-- 9️⃣ RESUMEN FINAL
\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo '📋 RESUMEN DE VALIDACIÓN'
\echo '════════════════════════════════════════════════════════════════'

\echo ''
\echo '✅ Si todas las consultas completaron sin errores:'
\echo '   → Las migraciones están listas para ejecutarse'
\echo ''
\echo '❌ Si hay errores de referencia rota:'
\echo '   → Debe revisarse la integridad de BD ANTES de migrar'
\echo ''
\echo '🔄 Para ejecutar migraciones automáticamente:'
\echo '   → Reiniciar backend en Railway (triggea redeploy)'
\echo ''
\echo '🔧 Para ejecutar migraciones manualmente:'
\echo '   → psql <connection> < backend-/src/database/migrations/add_rifa_columns_to_orden_venta.sql'
\echo '   → psql <connection> < backend-/src/database/migrations/add_con_rifa_desde_inicio_to_orden.sql'
\echo ''
\echo '════════════════════════════════════════════════════════════════'
