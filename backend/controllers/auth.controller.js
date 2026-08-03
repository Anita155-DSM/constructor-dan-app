import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Usuario from '../models/Usuario.js';

// ─── Registro ─────────────────────────────────────────────────────────────────
export const register = async (req, res) => {
  try {
    const { nombre, email, password } = req.body;

    if (!nombre || !email || !password)
      return res.status(400).json({ ok: false, msg: 'Todos los campos son obligatorios.' });

    if (password.length < 6)
      return res.status(400).json({ ok: false, msg: 'La contraseña debe tener al menos 6 caracteres.' });

    const existe = await Usuario.findOne({ where: { email: email.toLowerCase() } });
    if (existe)
      return res.status(409).json({ ok: false, msg: 'Ya existe una cuenta con ese correo.' });

    const hash = await bcrypt.hash(password, 10);
    const usuario = await Usuario.create({
      nombre: nombre.trim(),
      email: email.toLowerCase().trim(),
      password_hash: hash, // 👈 CAMBIO AQUÍ (password_hash)
    });

    const token = generarToken(usuario);
    setTokenCookie(res, token);

    return res.status(201).json({
      ok: true,
      token,
      usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email },
    });
  } catch (err) {
    console.error('Error en register:', err);
    return res.status(500).json({ ok: false, msg: 'Error interno del servidor.' });
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ ok: false, msg: 'Correo y contraseña son obligatorios.' });

    const usuario = await Usuario.findOne({ where: { email: email.toLowerCase().trim() } });
    if (!usuario)
      return res.status(401).json({ ok: false, msg: 'Correo o contraseña incorrectos.' });

    // 👈 CAMBIO AQUÍ: Usamos usuario.password_hash en vez de usuario.password
    const valido = await bcrypt.compare(password, usuario.password_hash);
    if (!valido)
      return res.status(401).json({ ok: false, msg: 'Correo o contraseña incorrectos.' });

    const token = generarToken(usuario);
    setTokenCookie(res, token);

    return res.json({
      ok: true,
      token,
      usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email },
    });
  } catch (err) {
    console.error('Error en login:', err);
    return res.status(500).json({ ok: false, msg: 'Error interno del servidor.' });
  }
};

// ─── Logout ───────────────────────────────────────────────────────────────────
export const logout = (req, res) => {
  res.clearCookie('token');
  return res.json({ ok: true, msg: 'Sesión cerrada.' });
};

// ─── Helpers privados ─────────────────────────────────────────────────────────
function generarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, nombre: usuario.nombre, email: usuario.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function setTokenCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 días en ms
  });
}
