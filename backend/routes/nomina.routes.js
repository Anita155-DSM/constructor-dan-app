import { Router } from 'express';
import verificarToken from '../middlewares/auth.middleware.js';
import asyncWrap from '../utils/asyncWrap.js';
import {
  listarSemanas, obtenerSemanaActual, guardarNomina,
  listarFrecuentes, eliminarFrecuente,
} from '../controllers/nomina.controller.js';

// ─── /api/obras/:obraId/nomina ───────────────────────────────────────────────
export const nominaRouter = Router({ mergeParams: true });
nominaRouter.use(verificarToken);
nominaRouter.get('/',       asyncWrap(listarSemanas));
nominaRouter.get('/actual', asyncWrap(obtenerSemanaActual));
nominaRouter.post('/',      asyncWrap(guardarNomina));

// ─── /api/peones-frecuentes ──────────────────────────────────────────────────
export const frecuentesRouter = Router();
frecuentesRouter.use(verificarToken);
frecuentesRouter.get('/',           asyncWrap(listarFrecuentes));
frecuentesRouter.delete('/:peonId', asyncWrap(eliminarFrecuente));
