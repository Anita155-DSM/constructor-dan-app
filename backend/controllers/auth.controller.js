import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Usuario from '../models/Usuario.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ES_PROD  = process.env.NODE_ENV === 'production' || !!process.env.DATABASE_URL;

// Opciones de la cookie de sesión. En producción el front vive en otro dominio
// (HTTPS), así que la cookie tiene que ser SameSite=None + Secure para viajar.
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: ES_PROD ? 'none' : 'lax',
  secure:   ES_PROD,
  maxAge:   7 * 24 * 60 * 60 * 1000, // 7 días en ms
  path:     '/',
};

// ─── Registro ─────────────────────────────────────────────────────────────────
export const register = async (req, res) => {
  try {
    const { nombre, email, password } = req.body;

    if (!nombre || !email || !password)
      return res.status(400).json({ ok: false, msg: 'Todos los campos son obligatorios.' });

    if (!EMAIL_RE.test(email))
      return res.status(400).json({ ok: false, msg: 'El correo no tiene un formato válido.' });

    if (password.length < 6)
      return res.status(400).json({ ok: false, msg: 'La contraseña debe tener al menos 6 caracteres.' });

    const emailNorm = email.toLowerCase().trim();
    const existe = await Usuario.findOne({ where: { email: emailNorm } });
    if (existe)
      return res.status(409).json({ ok: false, msg: 'Ya existe una cuenta con ese correo.' });

    const hash = await bcrypt.hash(password, 10);
    const usuario = await Usuario.create({
      nombre: nombre.trim(),
      email: emailNorm,
      password_hash: hash,
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
  // clearCookie tiene que recibir las mismas opciones con las que se seteó.
  res.clearCookie('token', { ...COOKIE_OPTS, maxAge: undefined });
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
  res.cookie('token', token, COOKIE_OPTS);
}
