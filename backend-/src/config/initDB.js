import { pool } from './db.js';

export const initDB = async () => {
    console.log("🔄 Verificando tablas en la base de datos...");

    const sql = `
        -- 1. TABLA USUARIOS
        CREATE TABLE IF NOT EXISTS usuarios (
            id_user SERIAL PRIMARY KEY,
            nombre VARCHAR(100),
            apellido VARCHAR(100),
            telefono VARCHAR(50),
            domicilio TEXT,
            correo VARCHAR(150) UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            rol VARCHAR(50), -- 'ADMIN', 'OPERARIO', 'SUPER_ADMIN'
            estado_operario BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- 2. TABLA SERVICIOS
        CREATE TABLE IF NOT EXISTS servicio (
            id_servicio SERIAL PRIMARY KEY,
            nombre_servicio VARCHAR(100) NOT NULL,
            tipo VARCHAR(50),
            descripcion TEXT,
            precio_automovil NUMERIC(12, 2) DEFAULT 0,
            precio_campero NUMERIC(12, 2) DEFAULT 0,
            precio_camioneta NUMERIC(12, 2) DEFAULT 0,
            precio_moto NUMERIC(12, 2) DEFAULT 0,
            aplica_automovil BOOLEAN DEFAULT TRUE,
            aplica_campero BOOLEAN DEFAULT TRUE,
            aplica_camioneta BOOLEAN DEFAULT TRUE,
            aplica_moto BOOLEAN DEFAULT TRUE,
            activo BOOLEAN DEFAULT TRUE
        );

        -- 3. TABLA MENSAJES AUTOMÁTICOS
        CREATE TABLE IF NOT EXISTS mensaje_automatico (
            id_mensaje SERIAL PRIMARY KEY,
            tipo_mensaje VARCHAR(100) UNIQUE NOT NULL,
            contenido TEXT
        );

        -- 4. INVENTARIO DE INSUMOS
        CREATE TABLE IF NOT EXISTS inventario_producto (
            id_producto SERIAL PRIMARY KEY,
            nombre_producto VARCHAR(150) NOT NULL,
            proveedor VARCHAR(100),
            categoria VARCHAR(100),
            ubicacion VARCHAR(100),
            costo NUMERIC(12, 2) DEFAULT 0,
            cantidad INTEGER DEFAULT 0,
            stock_minimo INTEGER DEFAULT 5
        );

        -- 5. INVENTARIO DE VENTAS
        CREATE TABLE IF NOT EXISTS inventario_venta (
            id_producto_venta SERIAL PRIMARY KEY,
            nombre_producto VARCHAR(150) NOT NULL,
            proveedor VARCHAR(100),
            categoria VARCHAR(100),
            ubicacion VARCHAR(100),
            costo NUMERIC(12, 2) DEFAULT 0,
            precio_venta NUMERIC(12, 2) DEFAULT 0,
            cantidad INTEGER DEFAULT 0,
            stock_minimo INTEGER DEFAULT 5
        );

        -- 6. EVENTOS DE RIFA
        CREATE TABLE IF NOT EXISTS evento_rifa (
            id_evento SERIAL PRIMARY KEY,
            fecha_sorteo DATE,
            descripcion_premios TEXT,
            encargado VARCHAR(100),
            estado BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- 7. BOLETAS DE RIFA
        CREATE TABLE IF NOT EXISTS rifa (
            id_boleta SERIAL PRIMARY KEY,
            id_evento_rifa INTEGER REFERENCES evento_rifa(id_evento) ON DELETE CASCADE,
            numero_boleta VARCHAR(10) NOT NULL,
            nombre VARCHAR(150),
            telefono VARCHAR(50),
            placa_vehiculo VARCHAR(20)
        );

        -- 8. ORDENES (CABECERA)
        CREATE TABLE IF NOT EXISTS orden (
            id_orden SERIAL PRIMARY KEY,
            cedula_cliente VARCHAR(50),
            nombre_cliente VARCHAR(150),
            correo_cliente VARCHAR(150),
            telefono_cliente VARCHAR(50),
            direccion_cliente TEXT,
            placa_vehiculo VARCHAR(20),
            marca_vehiculo VARCHAR(50),
            modelo_vehiculo VARCHAR(50),
            tipo_vehiculo VARCHAR(50),
            metodo_pago VARCHAR(50),
            caja VARCHAR(50),
            estado VARCHAR(50) DEFAULT 'FINALIZADA',
            id_user_encargado INTEGER REFERENCES usuarios(id_user), 
            id_rifa INTEGER REFERENCES evento_rifa(id_evento),
            notas TEXT,
            fecha DATE DEFAULT CURRENT_DATE,
            hora TIME DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::time,
            sede VARCHAR(50)
        );

        -- 9. DETALLE DE ORDEN
        CREATE TABLE IF NOT EXISTS detalle_orden_venta (
            id_detalle SERIAL PRIMARY KEY,
            id_orden INTEGER REFERENCES orden(id_orden) ON DELETE CASCADE,
            id_servicio INTEGER REFERENCES servicio(id_servicio),
            cantidad INTEGER DEFAULT 1,
            precio_servicio_aplicado NUMERIC(12, 2) NOT NULL
        );

        -- 10. VENTA DE MOSTRADOR (CABECERA)
        CREATE TABLE IF NOT EXISTS venta_mostrador (
            id_venta SERIAL PRIMARY KEY,
            cliente_nombre VARCHAR(150) DEFAULT 'Cliente General',
            telefono_cliente VARCHAR(50),
            metodo_pago VARCHAR(50),
            total NUMERIC(12, 2) NOT NULL,
            sede VARCHAR(50) NOT NULL,
            id_user_vendedor INTEGER REFERENCES usuarios(id_user),
            fecha DATE DEFAULT CURRENT_DATE,
            hora TIME DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::time
        );

        -- 11. DETALLE DE VENTA DE MOSTRADOR
        CREATE TABLE IF NOT EXISTS detalle_venta_mostrador (
            id_detalle SERIAL PRIMARY KEY,
            id_venta INTEGER REFERENCES venta_mostrador(id_venta) ON DELETE CASCADE,
            id_producto_venta INTEGER REFERENCES inventario_venta(id_producto_venta),
            cantidad_vendida INTEGER NOT NULL,
            precio_unitario NUMERIC(12, 2) NOT NULL,
            subtotal NUMERIC(12, 2) NOT NULL
        );
        
        -- 12. GANADORES DE RIFA
        CREATE TABLE IF NOT EXISTS rifa_ganador (
            id SERIAL PRIMARY KEY,
            id_evento_rifa INTEGER REFERENCES evento_rifa(id_evento) ON DELETE CASCADE,
            id_boleta INTEGER REFERENCES rifa(id_boleta) ON DELETE SET NULL,
            fecha_ganador TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            nombre_ganador VARCHAR(150),
            telefono_ganador VARCHAR(50),
            placa_vehiculo VARCHAR(20),
            numero_boleta VARCHAR(10)
        );
    `;

    try {
        await pool.query(sql);
        console.log("✅ Tablas creadas/sincronizadas correctamente.");

        // MIGRACIONES AUTOMÁTICAS
        const migraciones = [
            "ALTER TABLE servicio ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE",
            "ALTER TABLE servicio ADD COLUMN IF NOT EXISTS precio_moto NUMERIC(12, 2) DEFAULT 0",
            "ALTER TABLE servicio ADD COLUMN IF NOT EXISTS aplica_automovil BOOLEAN DEFAULT TRUE",
            "ALTER TABLE servicio ADD COLUMN IF NOT EXISTS aplica_campero BOOLEAN DEFAULT TRUE",
            "ALTER TABLE servicio ADD COLUMN IF NOT EXISTS aplica_camioneta BOOLEAN DEFAULT TRUE",
            "ALTER TABLE servicio ADD COLUMN IF NOT EXISTS aplica_moto BOOLEAN DEFAULT TRUE",
            
            // FIX: Cambiamos el default de 'GLOBAL' a 'GALAN' para evitar que se sigan creando mal
            "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS sede VARCHAR(50) DEFAULT 'GALAN'",
            "ALTER TABLE inventario_producto ADD COLUMN IF NOT EXISTS sede VARCHAR(50)",
            "ALTER TABLE inventario_venta ADD COLUMN IF NOT EXISTS sede VARCHAR(50)",
            // NUEVO: Asegura que la columna sede exista en orden
            "ALTER TABLE orden ADD COLUMN IF NOT EXISTS sede VARCHAR(50)",

            "ALTER TABLE inventario_producto ADD COLUMN IF NOT EXISTS stock_minimo INTEGER DEFAULT 5",
            "ALTER TABLE inventario_venta ADD COLUMN IF NOT EXISTS stock_minimo INTEGER DEFAULT 5",

            // ✅ FIX ZONA HORARIA: Cambia el DEFAULT de hora a hora de Bogotá (UTC-5)
            // Esto corrige que Railway (UTC) guardaba la hora 5 horas adelantada
            `ALTER TABLE orden ALTER COLUMN hora SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::time`,
            `ALTER TABLE venta_mostrador ALTER COLUMN hora SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::time`,
        ];
        
        for (const sql of migraciones) {
            try {
                await pool.query(sql);
            } catch (e) {
                console.log("Nota migración:", e.message);
            }
        }
        console.log("✅ Columnas de servicio, sedes, semaforización y zona horaria verificadas.");

        // LIMPIEZA DE DATOS PARA EL DASHBOARD
        // Convierte los nulos y 'GLOBAL' a 'GALAN' en las tablas principales
        console.log("🧹 Normalizando datos de sedes...");
        await pool.query("UPDATE usuarios SET sede = 'GALAN' WHERE sede IS NULL OR sede = 'GLOBAL'");
        await pool.query("UPDATE orden SET sede = 'GALAN' WHERE sede IS NULL OR sede = 'GLOBAL'");
        await pool.query("UPDATE venta_mostrador SET sede = 'GALAN' WHERE sede IS NULL OR sede = 'GLOBAL'");

    } catch (error) {
        console.error("❌ Error creando tablas:", error);
    }
};