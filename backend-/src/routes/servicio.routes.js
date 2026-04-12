import { Router } from 'express';
import { 
    getServicios, 
    createServicio, 
    updateServicio, 
    deleteServicio 
} from '../controllers/servicio.controller.js';
import { verifyToken } from '../controllers/auth.controller.js';

const router = Router();

router.get('/', verifyToken, getServicios);
router.post('/', verifyToken, createServicio);
router.put('/:id', verifyToken, updateServicio);
router.delete('/:id', verifyToken, deleteServicio);

export default router;