import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    // 🔧 Timeouts para evitar cuelgues en Railway
    connectionTimeoutMillis: 5000, // 5 segundos para conectarse
    idleTimeoutMillis: 30000,      // 30 segundos antes de cerrar conexión ociosa
    max: 20                         // Máximo 20 conexiones simultáneas
});