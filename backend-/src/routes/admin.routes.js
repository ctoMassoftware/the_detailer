import { Router } from 'express';
import { executeMigrationRifasSecured, checkMigrationStatus } from '../controllers/admin.controller.js';
import { verifyToken } from '../controllers/auth.controller.js';

const router = Router();

/**
 * ADMIN ENDPOINTS - SUPER_ADMIN ONLY
 *
 * ADVERTENCIA: Estos endpoints ejecutan operaciones críticas en la BD
 * Solo SUPER_ADMIN tiene acceso
 */

/**
 * Ejecutar migration de rifas securizadas
 * POST /api/admin/migration/rifas-secured
 *
 * SAFE: No destruye ni borra nada
 * - ADD COLUMN IF NOT EXISTS (no sobrescribe si existe)
 * - CREATE TABLE IF NOT EXISTS (no sobrescribe si existe)
 * - Genera números 000-999 para rifas existentes
 * - Crea índices para rendimiento
 * - Crea tabla de auditoría
 */
router.post('/migration/rifas-secured', verifyToken, executeMigrationRifasSecured);

/**
 * Verificar estado de migration
 * GET /api/admin/migration/status
 *
 * Retorna:
 * - Estado general (COMPLETADA/INCOMPLETA)
 * - Estado de cada tabla/columna
 * - Contador de índices
 * - Contador de números disponibles
 */
router.get('/migration/status', verifyToken, checkMigrationStatus);

export default router;
