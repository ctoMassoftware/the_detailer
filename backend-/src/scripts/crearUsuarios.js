import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';

export const seedUsuarios = async () => {
    const usuarios = [
        { 
            nombre: 'Jefe', 
            apellido: 'Supremo', 
            correo: 'admin@thedetailer.com', 
            pass: 'Admin2025', 
            rol: 'SUPER_ADMIN', 
            sede: 'GLOBAL' 
        },
        { 
            nombre: 'Sede', 
            apellido: 'Galán', 
            correo: 'galan@thedetailer.com', 
            pass: 'Galan2025', 
            rol: 'ADMIN_SEDE', 
            sede: 'GALAN' 
        },
        { 
            nombre: 'Sede', 
            apellido: 'Centenario', 
            correo: 'centenario@thedetailer.com', 
            pass: 'Centenario2025', 
            rol: 'ADMIN_SEDE', 
            sede: 'CENTENARIO' 
        }
    ];

    try {
        console.log("🔄 Iniciando verificación de usuarios maestros...");

        for (const u of usuarios) {
            // Buscamos si el usuario existe
            const check = await pool.query('SELECT id_user, rol, sede FROM usuarios WHERE correo = $1', [u.correo]);
            
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(u.pass, salt);

            if (check.rows.length === 0) {
                // Caso 1: El usuario no existe, lo creamos de cero
                await pool.query(`
                    INSERT INTO usuarios (nombre, apellido, correo, password_hash, rol, sede, estado_operario)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [u.nombre, u.apellido, u.correo, hash, u.rol, u.sede, false]);
                
                console.log(`✅ CREADO: ${u.correo} (${u.rol})`);
            } else {
                // Caso 2: El usuario existe. ACTUALIZAMOS para asegurar que la contraseña y el rol sean los correctos
                // Esto soluciona el problema de que no te dejaba entrar con los datos nuevos
                await pool.query(`
                    UPDATE usuarios 
                    SET password_hash = $1, rol = $2, sede = $3, nombre = $4, apellido = $5
                    WHERE correo = $6
                `, [hash, u.rol, u.sede, u.nombre, u.apellido, u.correo]);

                console.log(`🔄 ACTUALIZADO: ${u.correo} (Datos refrescados)`);
            }
        }
        console.log("✅ Proceso de seed completado exitosamente.");
    } catch (error) {
        console.error("❌ Error crítico en seedUsuarios:", error);
    }
};