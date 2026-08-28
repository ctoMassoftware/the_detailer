-- Crear tabla de métodos de pago
CREATE TABLE IF NOT EXISTS metodos_pago (
  id_metodo SERIAL PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL UNIQUE,
  descripcion VARCHAR(200),
  activo BOOLEAN DEFAULT true,
  orden INT DEFAULT 0,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar métodos de pago por defecto para Colombia
INSERT INTO metodos_pago (nombre, descripcion, activo, orden) VALUES
  ('Efectivo', 'Pago en efectivo', true, 1),
  ('Transferencia', 'Transferencia bancaria', true, 2),
  ('Tarjeta', 'Tarjeta de crédito/débito', false, 3),
  ('Cheque', 'Pago con cheque', false, 4),
  ('PSE', 'Pagos electrónicos PSE', false, 5)
ON CONFLICT (nombre) DO NOTHING;

-- Crear tabla de auditoría para cambios en métodos de pago
CREATE TABLE IF NOT EXISTS auditoria_metodos_pago (
  id SERIAL PRIMARY KEY,
  id_metodo INT REFERENCES metodos_pago(id_metodo),
  accion VARCHAR(50),
  cambios JSONB,
  usuario_id INT,
  fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
