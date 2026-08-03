import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import  sequelize  from './config/database.js';

// Capturar errores no manejados para diagnosticar cierres inesperados
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err && err.stack ? err.stack : err);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason && reason.stack ? reason.stack : reason);
});

// Log si alguien llama a process.exit para capturar el stack trace
const _origProcessExit = process.exit.bind(process);
process.exit = (code = 0) => {
  console.error('process.exit called with code:', code);
  console.error(new Error('process.exit stack').stack);
  return _origProcessExit(code);
};

process.on('beforeExit', (code) => {
  console.error('Process beforeExit with code:', code);
});

// Log process shutdown signals to help diagnose unexpected exits
process.on('SIGINT', () => {
  console.error('Process received SIGINT, shutting down...');
});
process.on('SIGTERM', () => {
  console.error('Process received SIGTERM, shutting down...');
});
process.on('exit', (code) => {
  console.error('Process exiting with code:', code);
});

import authRoutes        from './routes/auth.routes.js';
import obraRoutes        from './routes/obra.routes.js';
import presupuestoRoutes from './routes/presupuesto.routes.js';
import { nominaRouter, frecuentesRouter } from './routes/nomina.routes.js';
import { saldosRouter, resumenRouter }    from './routes/saldo.routes.js'; // ← Sprint 5

// Registrar modelos en orden (respeta FK)
import './models/Usuario.js';
import './models/Obra.js';
import './models/Presupuesto.js';
import './models/Nomina.js';
// Saldos no tiene modelo propio — calcula desde las tablas existentes

const app = express();

app.use(cors({
  origin: [
    'http://localhost:3000', 'http://localhost:5173',
    'http://localhost:8081', 'http://localhost:8082',
    'http://127.0.0.1:8081', 'http://127.0.0.1:8082',
    'http://127.0.0.1:19000', 'http://localhost:19000',
  ],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Rutas
app.use('/api/auth',                      authRoutes);
app.use('/api/obras',                     obraRoutes);
app.use('/api/obras/:obraId/presupuesto', presupuestoRoutes);
app.use('/api/obras/:obraId/nomina',      nominaRouter);
app.use('/api/obras/:obraId/saldos',      saldosRouter);     // ← Sprint 5
app.use('/api/peones-frecuentes',         frecuentesRouter);
app.use('/api/resumen',                   resumenRouter);     // ← Sprint 5

// Middleware de manejo de errores: loguea y responde 500 sin cerrar el proceso
app.use((err, req, res, next) => {
  console.error('Express error handler:', err && err.stack ? err.stack : err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: err?.message || 'Error interno del servidor.' });
});

const iniciarServidor = async () => {
  try {
    await sequelize.sync({ force: false });
    console.log('Base de datos conectada y sincronizada.');
    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));

    // Keep-alive: evita que Node salga si el event loop queda vacío (dev only)
    const keepAlive = setInterval(() => {}, 1e9);

    // Limpiar keepAlive en señales de terminación
    process.on('SIGINT', () => {
      clearInterval(keepAlive);
      console.error('Process received SIGINT, shutting down...');
      server.close(() => process.exit(0));
    });
    process.on('SIGTERM', () => {
      clearInterval(keepAlive);
      console.error('Process received SIGTERM, shutting down...');
      server.close(() => process.exit(0));
    });
  } catch (error) {
    console.error('Error al conectar BD:', error);
  }
};

iniciarServidor();
