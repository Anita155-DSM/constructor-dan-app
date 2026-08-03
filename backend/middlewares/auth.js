import jwt from 'jsonwebtoken';

export const verificarToken = (req, res, next) => {
  // Buscamos el token en las cookies
  const tokenCookie = req.cookies.token;
  const authHeader = req.headers.authorization;
  const tokenBearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = tokenCookie || tokenBearer;

  if (!token) {
    return res.status(401).json({ 
      ok: false, 
      msg: 'Acceso denegado. No se encontró ningún token.' 
    });
  }

  try {
    // Verificamos el token con nuestra clave secreta
    const verificado = jwt.verify(token, process.env.JWT_SECRET || 'FirmaSecretaSuperSegura123');
    
    // Inyectamos los datos del usuario en la petición (req) para usarlo en los controladores
    req.usuario = verificado; 
    
    next(); // Continuar a la ruta
  } catch (error) {
    return res.status(403).json({ 
      ok: false, 
      msg: 'Token inválido o expirado.' 
    });
  }
};