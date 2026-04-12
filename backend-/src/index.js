import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// 1. IMPORTACIONES DE CONFIGURACIÓN Y SCRIPTS
import { pool } from './config/db.js';
import { initDB } from './config/initDB.js'; 
import { seedUsuarios } from './scripts/crearUsuarios.js';

// 2. IMPORTACIONES DE RUTAS
import authRoutes from './routes/auth.routes.js';
import ordenRoutes from './routes/orden.routes.js';
import servicioRoutes from './routes/servicio.routes.js';
import mensajeRoutes from './routes/mensaje.routes.js';
import inventarioVentaRoutes from './routes/inventarioVenta.routes.js';
import inventarioProductoRoutes from './routes/inventarioProducto.routes.js';
import operarioRoutes from './routes/operario.routes.js';
import rifaRoutes from './routes/rifa.routes.js';
import estadisticasRoutes from './routes/estadisticas.routes.js';
import ventaMostradorRoutes from './routes/ventaMostrador.routes.js'; // 👈 NUEVA RUTA MOSTRADOR

// Configuración de variables de entorno
dotenv.config();

const app = express();

// 3. MIDDLEWARES
app.use(cors({
  origin: '*',
  optionsSuccessStatus: 200
}));
app.use(express.json());

// 4. DEFINICIÓN DE RUTAS API
app.use('/api/auth', authRoutes);
app.use('/api/ordenes', ordenRoutes);
app.use('/api/servicios', servicioRoutes);
app.use('/api/mensajes', mensajeRoutes);
app.use('/api/inventario-venta', inventarioVentaRoutes);
app.use('/api/inventario-producto', inventarioProductoRoutes);
app.use('/api/operarios', operarioRoutes);
app.use('/api/rifas', rifaRoutes);
app.use('/api/estadisticas', estadisticasRoutes);
app.use('/api/venta-mostrador', ventaMostradorRoutes); // 👈 NUEVO ENDPOINT MOSTRADOR

const PORT = process.env.PORT || 3000;

// 5. FUNCIÓN DE ARRANQUE DEL SERVIDOR
const startServer = async () => {
    try {
        // Primero inicializamos las tablas de la base de datos
        await initDB();
        
        // Verificamos la conexión con el pool
        await pool.query('SELECT NOW()');
        console.log("✅ Base de datos conectada correctamente");

        // Ejecutamos el seed para asegurar que existan los usuarios (Admin, Galán, Centenario)
        console.log("🔄 Verificando usuarios iniciales...");
        await seedUsuarios(); 
        console.log("✅ Verificación de usuarios completada");

        // Finalmente, levantamos el servidor
        app.listen(PORT, () => {
            console.log(`🚀 Servidor corriendo con éxito en el puerto ${PORT}`);
            console.log(`🔗 Local: http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error("❌ Error fatal al iniciar el servidor:", error);
        process.exit(1); // Cerramos el proceso si hay un error crítico
    }
};

startServer();