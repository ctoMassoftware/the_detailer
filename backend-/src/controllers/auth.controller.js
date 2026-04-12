import { pool } from '../config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const register = async (req, res) => {
    // Añadimos 'sede' al body, con 'GLOBAL' por defecto si no se envía
    const { nombre, apellido, correo, password, rol, sede } = req.body;
    const userSede = sede || 'GLOBAL';

    try {
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const response = await pool.query(
            'INSERT INTO usuarios (nombre, apellido, correo, password_hash, rol, sede) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [nombre, apellido, correo, password_hash, rol, userSede]
        );

        res.json({ message: 'Usuario creado exitosamente', user: response.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al registrar usuario (probablemente el correo ya existe)' });
    }
};

export const login = async (req, res) => {
    const { correo, password } = req.body;

    try {
        const result = await pool.query('SELECT * FROM usuarios WHERE correo = $1', [correo]);
        
        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Usuario no encontrado' });
        }

        const user = result.rows[0];

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(400).json({ error: 'Contraseña incorrecta' });
        }

        // 1. Incluir la SEDE en el Token
        const token = jwt.sign(
            { id: user.id_user, rol: user.rol, nombre: user.nombre, sede: user.sede }, 
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        // 2. Enviar la SEDE al frontend
        res.json({
            message: 'Bienvenido',
            token: token,
            user: {
                id: user.id_user,
                nombre: user.nombre,
                rol: user.rol,
                sede: user.sede // ¡Nuevo!
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
};

export const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization']; 
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(403).json({ error: 'Acceso denegado: Token no proporcionado' });
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Token inválido o expirado' });
    }
};