import { Router } from 'express';
import { getMensajes, updateMensaje } from '../controllers/mensaje.controller.js';
import { verifyToken } from '../controllers/auth.controller.js';

const router = Router();

router.get('/', verifyToken, getMensajes);
router.put('/', verifyToken, updateMensaje);

export default router;