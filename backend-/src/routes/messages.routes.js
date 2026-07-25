import express from 'express';
import { getMessageHistory, getMessageStats } from '../services/messageLogger.service.js';
import { isAuthenticated } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * GET /api/messages/history/:phone
 * Get message history for a specific phone number
 * Requires authentication
 */
router.get('/history/:phone', isAuthenticated, async (req, res) => {
  try {
    const { phone } = req.params;
    const { limit = 50 } = req.query;

    // Validate phone format
    if (!phone || phone.length < 8) {
      return res.status(400).json({
        error: 'Invalid phone number format'
      });
    }

    const history = await getMessageHistory(phone, parseInt(limit));

    res.status(200).json({
      success: true,
      phone,
      count: history.length,
      messages: history
    });
  } catch (error) {
    console.error('Error fetching message history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch message history'
    });
  }
});

/**
 * GET /api/messages/stats
 * Get message delivery statistics
 * Requires authentication (admin role)
 */
router.get('/stats', isAuthenticated, async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    const stats = await getMessageStats(filters);

    res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching message stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch message statistics'
    });
  }
});

export default router;
