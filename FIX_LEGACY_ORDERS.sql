-- 🔴 FIX: Corregir órdenes con id_boleta = NULL (creadas antes del fix)
-- Ejecutar en Railway PostgreSQL después del rebuild

-- PASO 1: Ver órdenes con problema
SELECT
  o.id_orden,
  o.nombre_cliente,
  o.placa_vehiculo,
  o.id_rifa,
  o.id_boleta,
  o.estado,
  o.fecha
FROM orden o
WHERE o.id_rifa IS NOT NULL
  AND o.id_boleta IS NULL
ORDER BY o.id_orden DESC;

-- PASO 2: Para cada orden sin boleta pero CON rifa, asignar la primera boleta disponible

-- ⚠️ IMPORTANTE: Este script debe ejecutarse como transacción para evitar duplicados

BEGIN;

-- Crear tabla temporal para órdenes sin boleta
CREATE TEMP TABLE ordenes_sin_boleta AS
SELECT o.id_orden, o.id_rifa, o.fecha
FROM orden o
WHERE o.id_rifa IS NOT NULL
  AND o.id_boleta IS NULL
ORDER BY o.fecha ASC, o.id_orden ASC;

-- Para cada orden, asignar una boleta disponible
DO $$
DECLARE
  orden_record RECORD;
  boleta_record RECORD;
BEGIN
  FOR orden_record IN SELECT * FROM ordenes_sin_boleta LOOP
    -- Buscar primera boleta disponible (no asignada a otra orden)
    SELECT r.id_boleta INTO boleta_record
    FROM rifa r
    WHERE r.id_evento_rifa = orden_record.id_rifa
      AND r.id_boleta NOT IN (
        SELECT DISTINCT id_boleta FROM orden WHERE id_boleta IS NOT NULL
      )
    LIMIT 1;

    -- Si encontramos una boleta disponible, asignarla
    IF boleta_record.id_boleta IS NOT NULL THEN
      UPDATE orden
      SET id_boleta = boleta_record.id_boleta
      WHERE id_orden = orden_record.id_orden;

      RAISE NOTICE 'Orden % -> Boleta %', orden_record.id_orden, boleta_record.id_boleta;
    END IF;
  END LOOP;
END$$;

COMMIT;

-- PASO 3: Validar resultados
SELECT
  o.id_orden,
  o.nombre_cliente,
  o.id_boleta,
  r.numero_boleta,
  o.estado
FROM orden o
LEFT JOIN rifa r ON o.id_boleta = r.id_boleta
WHERE o.id_rifa IS NOT NULL
ORDER BY o.id_orden DESC
LIMIT 10;

-- RESULTADO ESPERADO:
-- Todas las órdenes con id_rifa ahora deben tener id_boleta ≠ NULL
-- numero_boleta debe mostrar el número correcto (no #003)
