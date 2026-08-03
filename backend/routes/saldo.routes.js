import { Router } from 'express';
import verificarToken from '../middlewares/auth.middleware.js';
import asyncWrap from '../utils/asyncWrap.js';
import { obtenerSaldo, resumenGeneral } from '../controllers/saldo.controller.js';

// ─── /api/obras/:obraId/saldos ───────────────────────────────────────────────
export const saldosRouter = Router({ mergeParams: true });
saldosRouter.use(verificarToken);
saldosRouter.get('/', asyncWrap(obtenerSaldo));

// ─── /api/resumen ────────────────────────────────────────────────────────────
export const resumenRouter = Router();
resumenRouter.use(verificarToken);
resumenRouter.get('/', asyncWrap(resumenGeneral));
