-- Agregar flag con_rifa_desde_inicio a venta_mostrador (similar a orden)
-- Para saber si la venta fue creada CON rifa o SIN rifa (nunca mostrar boleta si fue sin rifa)

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='venta_mostrador' AND column_name='con_rifa_desde_inicio'
  ) THEN
    ALTER TABLE venta_mostrador
    ADD COLUMN con_rifa_desde_inicio BOOLEAN DEFAULT FALSE;

    -- Auto-actualizar ventas existentes que tienen rifa
    UPDATE venta_mostrador
    SET con_rifa_desde_inicio = TRUE
    WHERE id_rifa IS NOT NULL;

    RAISE NOTICE 'Columna con_rifa_desde_inicio agregada a venta_mostrador';
  ELSE
    RAISE NOTICE 'Columna con_rifa_desde_inicio ya existe en venta_mostrador';
  END IF;
END $$;
