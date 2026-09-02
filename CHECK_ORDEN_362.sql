-- Verificar orden 362
SELECT
  o.id_orden,
  o.nombre_cliente,
  o.placa_vehiculo,
  o.id_boleta,
  r.numero_boleta,
  o.id_rifa,
  o.estado,
  o.fecha
FROM orden o
LEFT JOIN rifa r ON o.id_boleta = r.id_boleta
WHERE o.id_orden = 362;

-- Si id_boleta es NULL, buscar qué boletas están disponibles para su rifa
SELECT
  o.id_rifa,
  COUNT(*) as total_boletas,
  SUM(CASE WHEN o.id_boleta IS NULL THEN 1 ELSE 0 END) as boletas_sin_asignar
FROM orden o
WHERE o.id_orden = 362;

-- Ver todas las boletas del evento de esa orden
SELECT
  r.id_boleta,
  r.numero_boleta,
  r.nombre,
  r.id_evento_rifa
FROM rifa r
WHERE r.id_evento_rifa = (SELECT id_rifa FROM orden WHERE id_orden = 362)
ORDER BY r.numero_boleta ASC
LIMIT 5;
