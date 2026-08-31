import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import sequelize from './config/database.js';

// Capturar errores no manejados para diagnosticar cierres inesperados
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err && err.stack ? err.stack : err);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason && reason.stack ? reason.stack : reason);
});

import authRoutes        from './routes/auth.routes.js';
import obraRoutes        from './routes/obra.routes.js';
import presupuestoRoutes from './routes/presupuesto.routes.js';
import { nominaRouter, frecuentesRouter } from './routes/nomina.routes.js';
import { saldosRouter, resumenRouter }    from './routes/saldo.routes.js';

// Registrar modelos en orden (respeta FK)
import './models/Usuario.js';
import './models/Obra.js';
import './models/Presupuesto.js';
import './models/Nomina.js';
// Saldos no tiene modelo propio — calcula desde las tablas existentes

// El JWT_SECRET es obligatorio: sin él no se pueden firmar ni verificar tokens.
if (!process.env.JWT_SECRET) {
  console.error('FATAL: falta la variable de entorno JWT_SECRET.');
  process.exit(1);
}

const app = express();

// Orígenes permitidos: los locales de desarrollo + los que se pasen por env
// (CORS_ORIGINS separados por coma) para no tocar código al desplegar el front.
const ORIGENES_BASE = [
  'https://constructordan.onrender.com',
  'http://localhost:3000', 'http://localhost:5173',
  'http://localhost:8081', 'http://localhost:8082',
  'http://127.0.0.1:8081', 'http://127.0.0.1:8082',
  'http://127.0.0.1:19000', 'http://localhost:19000',
];
const ORIGENES_EXTRA = (process.env.CORS_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);
const ORIGENES_PERMITIDOS = [...new Set([...ORIGENES_BASE, ...ORIGENES_EXTRA])];

app.use(cors({
  origin(origin, cb) {
    // Sin Origin (apps móviles, curl, health checks) → permitir.
    if (!origin || ORIGENES_PERMITIDOS.includes(origin)) return cb(null, true);
    return cb(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Health check — útil para Render y para probar que el server está vivo
app.get(['/', '/api/health'], (req, res) => {
  res.json({ ok: true, servicio: 'constructor-dan-api', ts: new Date().toISOString() });
});

// Rutas
app.use('/api/auth',                      authRoutes);
app.use('/api/obras',                     obraRoutes);
app.use('/api/obras/:obraId/presupuesto', presupuestoRoutes);
app.use('/api/obras/:obraId/nomina',      nominaRouter);
app.use('/api/obras/:obraId/saldos',      saldosRouter);
app.use('/api/peones-frecuentes',         frecuentesRouter);
app.use('/api/resumen',                   resumenRouter);

// Middleware de manejo de errores: loguea y responde sin cerrar el proceso
app.use((err, req, res, next) => {
  console.error('Express error handler:', err && err.stack ? err.stack : err);
  if (res.headersSent) return next(err);
  const esCors = /CORS/.test(err?.message || '');
  res.status(esCors ? 403 : 500).json({ error: err?.message || 'Error interno del servidor.' });
});

const iniciarServidor = async () => {
  try {
    await sequelize.sync({ force: false });
    console.log('Base de datos conectada y sincronizada.');

    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));

    const cerrar = (sig) => {
      console.log(`Recibida señal ${sig}, cerrando servidor...`);
      server.close(() => process.exit(0));
    };
    process.on('SIGINT',  () => cerrar('SIGINT'));
    process.on('SIGTERM', () => cerrar('SIGTERM'));
  } catch (error) {
    console.error('Error al conectar BD:', error);
    process.exit(1);
  }
};

iniciarServidor();
