import jwt from 'jsonwebtoken';

/**
 * Middleware to verify JWT token from Authorization header
 * Extracts token from "Bearer <token>" format
 * Sets req.user with decoded token data
 */
export const isAuthenticated = (req, res, next) => {
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

export default isAuthenticated;
