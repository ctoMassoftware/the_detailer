-- ===================================================================
-- FIND BOLETA FOR ORDEN 362
-- ===================================================================

-- 1. OBTENER DATOS DE LA ORDEN 362
SELECT 
  '=== ORDEN 362 ===' as seccion,
  o.id_orden,
  o.nombre_cliente,
  o.placa_vehiculo,
  o.id_boleta,
  o.id_rifa,
  o.estado
FROM orden o
WHERE o.id_orden = 362;

-- 2. SI TIENE ID_BOLETA, BUSCAR EL NUMERO
SELECT 
  '=== BOLETA ASIGNADA ===' as seccion,
  r.id_boleta,
  r.numero_boleta,
  r.nombre,
  r.placa_vehiculo
FROM rifa r
WHERE r.id_boleta = (SELECT o.id_boleta FROM orden o WHERE o.id_orden = 362 AND o.id_boleta IS NOT NULL)
LIMIT 1;

-- 3. SI NO TIENE ID_BOLETA, MOSTRAR NULL
SELECT 
  CASE 
    WHEN (SELECT o.id_boleta FROM orden o WHERE o.id_orden = 362) IS NULL 
    THEN 'SIN ASIGNAR - NULL'
    ELSE 'TIENE ASIGNADA'
  END as "BOLETA 362"
FROM orden
WHERE id_orden = 362;

-- 4. VERIFICAR TODA LA FILA
SELECT 
  '=== FILA COMPLETA ===' as seccion,
  o.id_orden,
  o.id_boleta,
  COALESCE((SELECT numero_boleta FROM rifa WHERE id_boleta = o.id_boleta), 'SIN BOLETA') as numero_boleta,
  o.id_rifa,
  o.nombre_cliente,
  o.estado,
  o.fecha
FROM orden o
WHERE o.id_orden = 362;
