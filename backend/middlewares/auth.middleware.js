import jwt from 'jsonwebtoken';

// Este middleware verifica que el usuario esté logueado antes de
// permitir acceso a rutas protegidas (obras, nómina, etc.)
const verificarToken = (req, res, next) => {
  // El token viene en la cookie httpOnly que seteamos al hacer login
  const tokenCookie = req.cookies?.token;
  const authHeader = req.headers.authorization;
  const tokenBearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = tokenCookie || tokenBearer;

  if (!token) {
    return res.status(401).json({ error: 'No autenticado. Iniciá sesión primero.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'FirmaSecretaSuperSegura123');
    // Adjuntamos el usuario al request para usarlo en los controllers
    req.usuario = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Sesión inválida o expirada.' });
  }
};

export default verificarToken;
