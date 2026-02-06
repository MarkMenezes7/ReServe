const express = require('express');
const { db, dbRun, dbGet, dbAll } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// GET /api/chat/conversations/:userId
router.get('/conversations/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const conversations = await dbAll(`
      SELECT DISTINCT c.id as claimId, c.listingId, c.ngoId, c.status,
        l.foodName, l.donorId,
        CASE WHEN l.donorId = ? THEN u_ngo.name ELSE u_donor.name END as counterpartName,
        CASE WHEN l.donorId = ? THEN u_ngo.organizationName ELSE u_donor.organizationName END as counterpartOrg,
        CASE WHEN l.donorId = ? THEN c.ngoId ELSE l.donorId END as counterpartId,
        (SELECT content FROM messages WHERE claimId = c.id ORDER BY createdAt DESC LIMIT 1) as lastMessage,
        (SELECT createdAt FROM messages WHERE claimId = c.id ORDER BY createdAt DESC LIMIT 1) as lastMessageAt,
        (SELECT COUNT(*) FROM messages WHERE claimId = c.id AND receiverId = ? AND isRead = 0) as unreadCount
      FROM claims c
      JOIN listings l ON c.listingId = l.id
      JOIN users u_ngo ON c.ngoId = u_ngo.id
      JOIN users u_donor ON l.donorId = u_donor.id
      WHERE (l.donorId = ? OR c.ngoId = ?)
      ORDER BY lastMessageAt DESC
    `, [userId, userId, userId, userId, userId, userId]);
    res.json(conversations);
  } catch (error) {
    console.error('Conversations error:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// GET /api/chat/messages/:claimId
router.get('/messages/:claimId', async (req, res) => {
  try {
    const messages = await dbAll(`
      SELECT m.*, u.name as senderName
      FROM messages m
      JOIN users u ON m.senderId = u.id
      WHERE m.claimId = ?
      ORDER BY m.createdAt ASC
    `, [req.params.claimId]);
    res.json(messages);
  } catch (error) {
    console.error('Messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/chat/messages
router.post('/messages', async (req, res) => {
  try {
    const { claimId, receiverId, content, messageType, imageUrl } = req.body;
    const senderId = req.user.userId;

    if (!claimId || !receiverId || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await dbRun(
      `INSERT INTO messages (claimId, senderId, receiverId, content, messageType, imageUrl)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [claimId, senderId, receiverId, content, messageType || 'text', imageUrl || null]
    );

    const message = {
      id: result.lastID,
      claimId,
      senderId,
      receiverId,
      content,
      messageType: messageType || 'text',
      imageUrl: imageUrl || null,
      isRead: 0,
      createdAt: new Date().toISOString(),
    };

    const io = req.app.get('io');
    if (io) {
      io.to(`claim_${claimId}`).emit('newMessage', message);
    }

    res.status(201).json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// PATCH /api/chat/messages/:claimId/read
router.patch('/messages/:claimId/read', async (req, res) => {
  try {
    const { claimId } = req.params;
    const userId = req.user.userId;

    await dbRun(
      'UPDATE messages SET isRead = 1 WHERE claimId = ? AND receiverId = ? AND isRead = 0',
      [claimId, userId]
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`claim_${claimId}`).emit('messagesRead', { claimId, userId });
    }

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

module.exports = router;
