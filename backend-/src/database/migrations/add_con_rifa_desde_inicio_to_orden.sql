-- Migración: Agregar flag con_rifa_desde_inicio a tabla orden
-- Propósito: Distinguir entre órdenes creadas con rifa vs sin rifa pero reasignadas después

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='orden' AND column_name='con_rifa_desde_inicio') THEN
        ALTER TABLE orden ADD COLUMN con_rifa_desde_inicio BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Columna con_rifa_desde_inicio agregada a tabla orden';
    END IF;
END $$;

-- Actualizar órdenes existentes con rifa asignada
-- Si tienen id_rifa, asumir que se crearon con rifa (por compatibilidad)
UPDATE orden
SET con_rifa_desde_inicio = TRUE
WHERE id_rifa IS NOT NULL AND con_rifa_desde_inicio = FALSE;
