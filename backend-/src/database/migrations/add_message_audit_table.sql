-- Message Audit Log Table
-- Tracks all WhatsApp messages sent via Twilio for compliance and debugging

CREATE TABLE IF NOT EXISTS mensaje_audit_log (
  id_log SERIAL PRIMARY KEY,
  numero_telefono VARCHAR(20) NOT NULL,
  contenido_mensaje TEXT NOT NULL,
  estado VARCHAR(50) NOT NULL, -- 'success', 'failed', 'pending'
  sid_twilio VARCHAR(100),     -- Twilio message SID for tracking
  error_detalles JSONB,        -- Error details if failed
  timestamp_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  id_usuario INTEGER REFERENCES usuarios(id_user) ON DELETE SET NULL,
  id_orden INTEGER REFERENCES orden(id_orden) ON DELETE SET NULL,
  tipo_notificacion VARCHAR(50), -- 'orden_inicio', 'orden_lista', 'orden_terminada', etc.
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for fast lookups by phone and date
CREATE INDEX IF NOT EXISTS idx_mensaje_audit_telefono_fecha
ON mensaje_audit_log(numero_telefono, timestamp_envio DESC);

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_mensaje_audit_estado
ON mensaje_audit_log(estado, timestamp_envio DESC);
