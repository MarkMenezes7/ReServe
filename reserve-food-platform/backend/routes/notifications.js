const express = require('express');
const { db, dbRun, dbGet, dbAll } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// GET /api/notifications/:userId
router.get('/:userId', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const notifications = await dbAll(
      'SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?',
      [req.params.userId, limit, offset]
    );
    res.json(notifications);
  } catch (error) {
    console.error('Notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/:userId/unread
router.get('/:userId/unread', async (req, res) => {
  try {
    const result = await dbGet(
      'SELECT COUNT(*) as count FROM notifications WHERE userId = ? AND isRead = 0',
      [req.params.userId]
    );
    res.json({ count: result.count });
  } catch (error) {
    console.error('Unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
  try {
    await dbRun('UPDATE notifications SET isRead = 1 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// PATCH /api/notifications/:userId/read-all
router.patch('/:userId/read-all', async (req, res) => {
  try {
    await dbRun('UPDATE notifications SET isRead = 1 WHERE userId = ? AND isRead = 0', [req.params.userId]);
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

module.exports = router;
