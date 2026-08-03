import { Router } from 'express';
import verificarToken from '../middlewares/auth.middleware.js';
import asyncWrap from '../utils/asyncWrap.js';
import {
  listarObras,
  obtenerObra,
  crearObra,
  editarObra,
  cambiarEstado,
  eliminarObra,
} from '../controllers/obra.controller.js';

const router = Router();

// Todas las rutas de obras requieren estar autenticado
router.use(verificarToken);

// GET  /api/obras          → listar todas las obras del usuario
// POST /api/obras          → crear una obra nueva
router.route('/')
  .get(asyncWrap(listarObras))
  .post(asyncWrap(crearObra));

// GET    /api/obras/:id    → ver detalle de una obra
// PUT    /api/obras/:id    → editar datos de una obra
// DELETE /api/obras/:id    → eliminar una obra
router.route('/:id')
  .get(asyncWrap(obtenerObra))
  .put(asyncWrap(editarObra))
  .delete(asyncWrap(eliminarObra));

// PATCH /api/obras/:id/estado  → solo cambiar el estado (activa/pausada/terminada)
// Separado del PUT para que el frontend tenga un botón simple
router.patch('/:id/estado', asyncWrap(cambiarEstado));

export default router;
