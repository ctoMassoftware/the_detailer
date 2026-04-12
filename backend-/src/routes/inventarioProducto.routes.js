import { Router } from 'express';
import {
  getProductos,
  createProducto,
  updateProducto,
  deleteProducto
} from '../controllers/inventarioProducto.controller.js';
import { verifyToken } from '../controllers/auth.controller.js';

const router = Router();

router.get('/', verifyToken, getProductos);
router.post('/', verifyToken, createProducto);
router.put('/:id', verifyToken, updateProducto);
router.delete('/:id', verifyToken, deleteProducto);

export default router;