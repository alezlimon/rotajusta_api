// Middleware de autenticación JWT.
// Responsabilidad única: validar token, decodificar usuario y verificar permisos.

const jwt = require('jsonwebtoken');
const { AUTH_CONFIG } = require('../config/constants');

// Extrae el token del header Authorization: Bearer <token>
const extractToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
};

// Valida el token usando JWT_SECRET
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (_) {
    return null;
  }
};

// Middleware público: valida JWT y adjunta usuario autenticado a req.user
const authenticate = (req, _, next) => {
  const token = extractToken(req.headers.authorization);
  if (!token) return next({ status: 401, message: 'Token requerido' });

  const decoded = verifyToken(token);
  if (!decoded) return next({ status: 401, message: 'Token inválido o expirado' });

  req.user = decoded;
  next();
};

// Middleware para verificar rol específico (ej: MANAGER)
const requireRole = (requiredRole) => (req, _, next) => {
  if (req.user?.role !== requiredRole) {
    return next({ status: 403, message: `Requiere rol: ${requiredRole}` });
  }
  next();
};

// Helper para generar tokens (para testing / login endpoint en el futuro)
const generateToken = (userData) => {
  const payload = {
    id: userData.id,
    email: userData.email,
    role: userData.role,
  };
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  });
};

module.exports = { authenticate, requireRole, generateToken };
