import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// 1. IMPORTACIONES DE CONFIGURACIÓN Y SCRIPTS
import { pool } from './config/db.js';
import { initDB } from './config/initDB.js';
import { seedUsuarios } from './scripts/crearUsuarios.js';
import { validateTwilioConfig } from './config/twilio.config.js';

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
import testRoutes from './routes/test.routes.js'; // 👈 RUTA DE PRUEBA WHATSAPP
import messagesRouter from './routes/messages.routes.js';
import notificacionesRoutes from './routes/notificaciones.routes.js'; // 👈 RUTA DE NOTIFICACIONES AUTOMÁTICAS
import smsRoutes from './routes/sms.routes.js'; // 👈 RUTA DE SMS DINÁMICO
import recibosRoutes from './routes/recibos.routes.js'; // 👈 RUTA DE RECIBOS CON TOKEN
import adminRoutes from './routes/admin.routes.js'; // 👈 RUTA DE ADMIN (MIGRATIONS, ETC)
import metodosPageRoutes from './routes/metodos-pago.routes.js'; // 👈 RUTA DE MÉTODOS DE PAGO
import debugRoutes from './routes/debug.routes.js'; // 👈 RUTA DE DEBUG/ANÁLISIS

// Configuración de variables de entorno
dotenv.config();

// Validate configuration on startup
try {
  validateTwilioConfig();
  console.log('✓ Twilio configuration validated');
} catch (error) {
  console.error('✗ Configuration Error:', error.message);
  process.exit(1);
}

const app = express();

// 3. MIDDLEWARES
const allowedOrigins = [
    'https://thedetailer-produccion.netlify.app',
    'http://localhost:4200',
    'https://www.the-detailer.co',
    'https://the-detailer.co',
    'http://the-detailer.co'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`CORS rechazado para origen: ${origin}`);
            callback(new Error('No permitido por CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 200,
    maxAge: 3600
}));

app.use(express.json({
    strict: false,
    verify: (req, res, buf) => {
        if (buf.toString().trim() === '') {
            throw new Error('Empty body');
        }
    }
}));

app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        console.warn('⚠️ JSON Parse Error:', err.message);
        return res.status(400).json({ error: 'Invalid JSON' });
    }
    next(err);
});

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
app.use('/api/test', testRoutes); // 👈 ENDPOINT DE PRUEBA WHATSAPP
app.use('/api/messages', messagesRouter);
app.use('/api/notificaciones', notificacionesRoutes); // 👈 ENDPOINT DE NOTIFICACIONES AUTOMÁTICAS
app.use('/api/sms', smsRoutes); // 👈 ENDPOINT DE SMS DINÁMICO
app.use('/api/recibos', recibosRoutes); // 👈 ENDPOINT DE RECIBOS CON TOKEN
app.use('/api/admin', adminRoutes); // 👈 ENDPOINT DE ADMIN (SUPER_ADMIN ONLY)
app.use('/api/metodos-pago', metodosPageRoutes); // 👈 ENDPOINT DE MÉTODOS DE PAGO
app.use('/api/debug', debugRoutes); // 👈 ENDPOINT DE DEBUG/ANÁLISIS

const PORT = process.env.PORT || 3000;

// 5. FUNCIÓN DE ARRANQUE DEL SERVIDOR CON REINTENTOS
const startServer = async (attempt = 1, maxAttempts = 5) => {
    try {
        console.log(`\n🚀 Intento ${attempt}/${maxAttempts} de iniciar servidor...`);

        // Verificamos la conexión con el pool (reintentamos si falla)
        await pool.query('SELECT NOW()');
        console.log("✅ Base de datos conectada correctamente");

        // Inicializamos las tablas de la base de datos
        console.log("🔄 Inicializando base de datos...");
        await initDB();
        console.log("✅ Base de datos inicializada");

        // Ejecutamos el seed para asegurar que existan los usuarios
        console.log("🔄 Verificando usuarios iniciales...");
        await seedUsuarios();
        console.log("✅ Verificación de usuarios completada");

        // Levantamos el servidor
        app.listen(PORT, () => {
            console.log(`\n${'═'.repeat(50)}`);
            console.log(`🚀 ¡SERVIDOR INICIADO EXITOSAMENTE!`);
            console.log(`${'═'.repeat(50)}`);
            console.log(`📍 Puerto: ${PORT}`);
            console.log(`🔗 Local: http://localhost:${PORT}`);
            console.log(`${'═'.repeat(50)}\n`);
        });

    } catch (error) {
        console.error(`\n❌ Error en intento ${attempt}/${maxAttempts}:`, error.message);

        if (attempt < maxAttempts) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Backoff exponencial
            console.log(`⏳ Reintentando en ${delay}ms...\n`);
            setTimeout(() => startServer(attempt + 1, maxAttempts), delay);
        } else {
            console.error("\n❌ FATAL: No se pudo conectar a la base de datos después de", maxAttempts, "intentos");
            console.error("   Verifica que la base de datos esté disponible en:", process.env.DB_HOST);
            process.exit(1);
        }
    }
};

startServer();