import { Router } from 'express';
import asyncWrap from '../utils/asyncWrap.js';
import { register, login, logout } from '../controllers/auth.controller.js';

const router = Router();

router.post('/register', asyncWrap(register));
router.post('/login',    asyncWrap(login));
router.post('/logout',   asyncWrap(logout));

export default router;
