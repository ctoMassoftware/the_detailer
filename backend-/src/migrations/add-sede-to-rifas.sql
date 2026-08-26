-- ============================================================
-- Migración: Agregar segmentación por SEDE a rifas
-- ============================================================
-- Este script agrega seguridad y segmentación de rifas por sede

-- 1. Agregar columna 'sede' a evento_rifa si no existe
ALTER TABLE evento_rifa
ADD COLUMN IF NOT EXISTS sede VARCHAR(100) DEFAULT 'GLOBAL';

-- 2. Agregar índice para búsqueda rápida por sede
CREATE INDEX IF NOT EXISTS idx_evento_rifa_sede ON evento_rifa(sede);
CREATE INDEX IF NOT EXISTS idx_evento_rifa_estado_sede ON evento_rifa(estado, sede);

-- 3. Crear tabla de auditoría para boletas asignadas (control de asignaciones)
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

-- 4. Crear índice en auditoría
CREATE INDEX IF NOT EXISTS idx_rifa_asignacion_audit_orden ON rifa_asignacion_audit(id_orden);
CREATE INDEX IF NOT EXISTS idx_rifa_asignacion_audit_evento ON rifa_asignacion_audit(id_evento_rifa);
CREATE INDEX IF NOT EXISTS idx_rifa_asignacion_audit_sede ON rifa_asignacion_audit(sede);

-- 5. Agregar columna 'sede' a tabla 'rifa' para control granular
ALTER TABLE rifa
ADD COLUMN IF NOT EXISTS sede VARCHAR(100) DEFAULT 'GLOBAL';

-- 6. Crear índice para rifa por sede
CREATE INDEX IF NOT EXISTS idx_rifa_sede ON rifa(sede);
CREATE INDEX IF NOT EXISTS idx_rifa_evento_sede ON rifa(id_evento_rifa, sede);

-- 7. Crear tabla de control de números disponibles
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

-- 8. Crear índices de disponibilidad
CREATE INDEX IF NOT EXISTS idx_rifa_numero_disponible ON rifa_numero_disponible(id_evento_rifa, disponible, sede);
CREATE INDEX IF NOT EXISTS idx_rifa_numero_sede ON rifa_numero_disponible(sede);

-- ============================================================
-- Insertar números disponibles para rifas existentes (si aplica)
-- ============================================================
-- Esto generará números 000-999 para cada rifa activa
-- Solo si no existen registros previos

INSERT INTO rifa_numero_disponible (id_evento_rifa, numero_boleta, disponible, sede)
SELECT DISTINCT
    r.id_evento_rifa,
    LPAD(gs.num::text, 3, '0')::VARCHAR(10),
    NOT EXISTS (
        SELECT 1 FROM rifa WHERE id_evento_rifa = r.id_evento_rifa
        AND numero_boleta = LPAD(gs.num::text, 3, '0')
    ),
    COALESCE(er.sede, 'GLOBAL')
FROM rifa r
CROSS JOIN LATERAL generate_series(0, 999) gs(num)
JOIN evento_rifa er ON r.id_evento_rifa = er.id_evento
ON CONFLICT (id_evento_rifa, numero_boleta) DO NOTHING;

-- ============================================================
-- Crear vista para rifas disponibles por sede
-- ============================================================
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

-- ============================================================
-- Logs de cambios
-- ============================================================
COMMIT;
SELECT 'Migración completada: Seguridad y segmentación por sede agregadas' as status;
