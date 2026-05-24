const bcrypt = require('bcrypt');
const { pool } = require('../config/db');
const { generateToken } = require('../middleware/auth');

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const validateCredentials = ({ email, password }) => {
  if (!email || !password) return 'Email y password son obligatorios';
  if (!isValidEmail(email)) return 'Formato de email inválido';
  return null;
};

const findUserByEmail = async (email) => {
  const query = 'SELECT id, nombre, email, password_hash, rol FROM usuarios WHERE email = $1 LIMIT 1';
  const { rows } = await pool.query(query, [email]);
  return rows[0] || null;
};

const isValidPassword = (password, hash) => bcrypt.compare(password, hash);

const toAuthPayload = (user) => ({
  id: user.id,
  nombre: user.nombre,
  email: user.email,
  role: user.rol,
});

const findUserById = async (id) => {
  const query = 'SELECT id, nombre, email, rol, saldo_puntos_actual FROM usuarios WHERE id = $1 LIMIT 1';
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
};

const findEmployees = async () => {
  const query = 'SELECT id, nombre, email, rol FROM usuarios WHERE rol = $1 ORDER BY nombre ASC';
  const { rows } = await pool.query(query, ['EMPLOYEE']);
  return rows;
};

const toProfilePayload = (user) => ({
  id: user.id,
  nombre: user.nombre,
  email: user.email,
  role: user.rol,
  saldo_puntos_actual: user.saldo_puntos_actual,
});

const login = async (req, res) => {
  const { email, password } = req.body;
  const error = validateCredentials({ email, password });
  if (error) return res.status(400).json({ error });

  try {
    const user = await findUserByEmail(email);
    const validPassword = user && await isValidPassword(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ error: 'Credenciales inválidas' });

    const token = generateToken(toAuthPayload(user));
    return res.status(200).json({ token, user: toAuthPayload(user) });
  } catch (_) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const me = async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    return res.status(200).json({ user: toProfilePayload(user) });
  } catch (_) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const toEmployeePayload = (user) => ({
  id: user.id,
  nombre: user.nombre,
  email: user.email,
  role: user.rol,
});

const employees = async (req, res) => {
  try {
    const users = await findEmployees();
    return res.status(200).json({ employees: users.map(toEmployeePayload) });
  } catch (_) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { login, me, employees };
