import { Router } from 'express';
import verificarToken from '../middlewares/auth.middleware.js';
import asyncWrap from '../utils/asyncWrap.js';
import {
  obtenerPresupuesto,
  crearPresupuesto,
  aprobarPresupuesto,
  simularRebaja,
  calcularMateriales,
} from '../controllers/presupuesto.controller.js';

const router = Router({ mergeParams: true });
router.use(verificarToken);

// ✅ CRÍTICO: rutas con path específico SIEMPRE antes del router.route('/')
// Si van después, Express nunca las alcanza porque '/' las intercepta primero.

// PATCH /api/obras/:obraId/presupuesto/aprobar
router.patch('/aprobar', asyncWrap(aprobarPresupuesto));

// POST /api/obras/:obraId/presupuesto/simular-rebaja
router.post('/simular-rebaja', asyncWrap(simularRebaja));

// POST /api/obras/:obraId/presupuesto/calcular-materiales
router.post('/calcular-materiales', asyncWrap(calcularMateriales));

// GET y POST en /  — van AL FINAL
router.route('/')
  .get(asyncWrap(obtenerPresupuesto))
  .post(asyncWrap(crearPresupuesto));

export default router;
