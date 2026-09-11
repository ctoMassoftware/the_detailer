-- Migración: Agregar columnas de rifa a las tablas orden y venta_mostrador
-- Propósito: Soportar la asignación de boletas de rifa a órdenes y ventas

-- 1. Agregar columnas a tabla ORDEN
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orden' AND column_name='id_boleta') THEN
        ALTER TABLE orden ADD COLUMN id_boleta INTEGER REFERENCES rifa(id_boleta) ON DELETE SET NULL;
        RAISE NOTICE 'Columna id_boleta agregada a tabla orden';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orden' AND column_name='numero_rifa') THEN
        ALTER TABLE orden ADD COLUMN numero_rifa VARCHAR(10);
        RAISE NOTICE 'Columna numero_rifa agregada a tabla orden';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orden' AND column_name='fecha_sorteo') THEN
        ALTER TABLE orden ADD COLUMN fecha_sorteo DATE;
        RAISE NOTICE 'Columna fecha_sorteo agregada a tabla orden';
    END IF;
END $$;

-- 2. Agregar columnas a tabla VENTA_MOSTRADOR
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='venta_mostrador' AND column_name='id_rifa') THEN
        ALTER TABLE venta_mostrador ADD COLUMN id_rifa INTEGER REFERENCES evento_rifa(id_evento) ON DELETE SET NULL;
        RAISE NOTICE 'Columna id_rifa agregada a tabla venta_mostrador';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='venta_mostrador' AND column_name='id_boleta') THEN
        ALTER TABLE venta_mostrador ADD COLUMN id_boleta INTEGER REFERENCES rifa(id_boleta) ON DELETE SET NULL;
        RAISE NOTICE 'Columna id_boleta agregada a tabla venta_mostrador';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='venta_mostrador' AND column_name='numero_rifa') THEN
        ALTER TABLE venta_mostrador ADD COLUMN numero_rifa VARCHAR(10);
        RAISE NOTICE 'Columna numero_rifa agregada a tabla venta_mostrador';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='venta_mostrador' AND column_name='fecha_sorteo') THEN
        ALTER TABLE venta_mostrador ADD COLUMN fecha_sorteo DATE;
        RAISE NOTICE 'Columna fecha_sorteo agregada a tabla venta_mostrador';
    END IF;
END $$;
