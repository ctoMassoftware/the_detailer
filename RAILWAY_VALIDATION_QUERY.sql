-- 🔍 RAILWAY VALIDATION QUERY - Análisis Completo de Orden 358
-- Ejecuta este script en tu base de datos de Railway (Postgres client)

-- =============================================================================
-- 1. DATOS PRINCIPALES DE LA ORDEN 358
-- =============================================================================
SELECT
  '📋 ORDEN 358' as "=== PASO 1: DATOS ORDEN ===",
  o.id_orden,
  o.nombre_cliente,
  o.telefono_cliente,
  o.placa_vehiculo,
  o.cedula_cliente,
  o.estado,
  o.id_rifa,
  o.id_boleta,
  o.fecha,
  o.metodo_pago
FROM orden o
WHERE o.id_orden = 358;

-- =============================================================================
-- 2. VALIDAR QUE id_boleta NO ES NULL
-- =============================================================================
SELECT
  CASE
    WHEN id_boleta IS NULL THEN '❌ FALLO: id_boleta es NULL'
    ELSE '✅ EXITO: id_boleta tiene valor: ' || id_boleta::text
  END as "VALIDACION 1: id_boleta NOT NULL",
  id_boleta
FROM orden
WHERE id_orden = 358;

-- =============================================================================
-- 3. VERIFICAR QUE LA BOLETA EXISTE EN TABLA rifa
-- =============================================================================
SELECT
  '🎫 BOLETA ASIGNADA' as "=== PASO 2: BOLETA EN TABLA rifa ===",
  r.id_boleta,
  r.numero_boleta,
  r.nombre,
  r.telefono,
  r.placa_vehiculo,
  r.id_evento_rifa,
  r.createdAt
FROM rifa r
WHERE r.id_boleta = (SELECT id_boleta FROM orden WHERE id_orden = 358);

-- =============================================================================
-- 4. VALIDAR QUE NUMERO_BOLETA NO ES #003
-- =============================================================================
SELECT
  CASE
    WHEN r.numero_boleta = '003' THEN '❌ FALLO: Boleta es #003 (duplicada)'
    WHEN r.numero_boleta IS NULL THEN '❌ FALLO: numero_boleta es NULL'
    ELSE '✅ EXITO: numero_boleta es #' || r.numero_boleta
  END as "VALIDACION 2: numero_boleta correcto",
  r.numero_boleta
FROM orden o
LEFT JOIN rifa r ON o.id_boleta = r.id_boleta
WHERE o.id_orden = 358;

-- =============================================================================
-- 5. VERIFICAR EVENTO DE RIFA
-- =============================================================================
SELECT
  '🎊 EVENTO RIFA' as "=== PASO 3: EVENTO RIFA ===",
  er.id_evento,
  er.descripcion_premios,
  er.encargado,
  er.fecha_sorteo,
  er.estado
FROM evento_rifa er
WHERE er.id_evento = (SELECT id_rifa FROM orden WHERE id_orden = 358);

-- =============================================================================
-- 6. VALIDAR ESTADO GENERAL
-- =============================================================================
SELECT
  CASE
    WHEN o.id_rifa IS NULL THEN '❌ No tiene rifa asignada'
    ELSE '✅ Rifa asignada (evento ' || o.id_rifa::text || ')'
  END as "VALIDACION 3: id_rifa",
  CASE
    WHEN o.id_boleta IS NULL THEN '❌ No tiene boleta asignada'
    ELSE '✅ Boleta asignada (ID ' || o.id_boleta::text || ')'
  END as "VALIDACION 4: id_boleta",
  CASE
    WHEN r.numero_boleta IS NULL THEN '❌ Número desconocido'
    ELSE '✅ Número: #' || r.numero_boleta
  END as "VALIDACION 5: numero_boleta",
  o.estado as "Estado orden",
  o.id_orden
FROM orden o
LEFT JOIN rifa r ON o.id_boleta = r.id_boleta
WHERE o.id_orden = 358;

-- =============================================================================
-- 7. COMPARAR CON ÓRDENES SIMILARES (Buscar si hay duplicadas #003)
-- =============================================================================
SELECT
  '🔍 BÚSQUEDA DE DUPLICADOS' as "=== PASO 4: CHECK DUPLICADOS ===",
  o.id_orden,
  o.nombre_cliente,
  o.placa_vehiculo,
  r.numero_boleta,
  o.estado,
  COUNT(*) OVER (PARTITION BY r.numero_boleta) as "cantidad_ordenes_mismo_numero"
FROM orden o
LEFT JOIN rifa r ON o.id_boleta = r.id_boleta
WHERE o.placa_vehiculo = (SELECT placa_vehiculo FROM orden WHERE id_orden = 358)
ORDER BY o.id_orden DESC;

-- =============================================================================
-- 8. VERIFICAR ÚLTIMO ESTADO DE LA ORDEN EN LOGS (si existen)
-- =============================================================================
SELECT
  '📊 RESUMEN FINAL' as "=== RESULTADO FINAL ===",
  CASE
    WHEN o.id_boleta IS NOT NULL AND r.numero_boleta IS NOT NULL AND r.numero_boleta != '003'
    THEN '✅✅✅ FIX EXITOSO: Orden 358 correctamente asignada'
    ELSE '❌ REVISAR: Problemas detectados'
  END as "STATUS",
  o.id_orden,
  o.nombre_cliente,
  '# ' || COALESCE(r.numero_boleta, 'UNKNOWN') as "numero_boleta",
  o.estado,
  o.fecha
FROM orden o
LEFT JOIN rifa r ON o.id_boleta = r.id_boleta
WHERE o.id_orden = 358;

-- =============================================================================
-- INSTRUCCIONES DE USO:
-- 1. Conéctate a tu PostgreSQL de Railway
-- 2. Copia y pega TODO este script
-- 3. Ejecuta (Ctrl+Enter o tu cliente SQL)
-- 4. Revisa los resultados:
--    - Todos los VALIDACION X deben mostrar ✅
--    - Si alguno muestra ❌, el fix NO funcionó
--    - El STATUS debe ser "✅✅✅ FIX EXITOSO"
-- =============================================================================
