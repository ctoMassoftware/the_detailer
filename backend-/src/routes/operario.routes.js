import { Router } from 'express';
import {
  getOperarios,
  createOperario,
  updateOperario,
  deleteOperario
} from '../controllers/operario.controller.js';
import { verifyToken } from '../controllers/auth.controller.js';

const router = Router();

router.get('/', verifyToken, getOperarios);
router.post('/', verifyToken, createOperario);
router.put('/:id', verifyToken, updateOperario);
router.delete('/:id', verifyToken, deleteOperario);

export default router;