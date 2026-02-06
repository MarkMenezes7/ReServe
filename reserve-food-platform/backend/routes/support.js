const express = require('express');
const { db, dbRun, dbGet, dbAll } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/support/impact-stats (public)
router.get('/impact-stats', async (req, res) => {
  try {
    const foodSaved = await dbGet("SELECT COALESCE(SUM(l.quantity), 0) as total FROM claims c JOIN listings l ON c.listingId = l.id WHERE c.status = 'collected'");
    const donors = await dbGet("SELECT COUNT(*) as count FROM users WHERE userType = 'donor'");
    const ngos = await dbGet("SELECT COUNT(*) as count FROM users WHERE userType = 'ngo'");
    const collections = await dbGet("SELECT COUNT(*) as count FROM claims WHERE status = 'collected'");
    const cities = await dbGet('SELECT COUNT(DISTINCT city) as count FROM users WHERE city IS NOT NULL');

    const total = foodSaved.total || 0;
    res.json({
      foodRescued: total,
      mealsProvided: Math.floor(total * 2.5),
      registeredDonors: donors.count,
      activeNGOs: ngos.count,
      totalCollections: collections.count,
      citiesCovered: cities.count || 1,
      co2Saved: Math.floor(total * 2.5),
      waterConserved: Math.floor(total * 100),
    });
  } catch (error) {
    console.error('Impact stats error:', error);
    res.status(500).json({ error: 'Failed to fetch impact stats' });
  }
});

// GET /api/support/gratitude-wall (public)
router.get('/gratitude-wall', async (req, res) => {
  try {
    const entries = await dbAll(
      'SELECT id, displayName, message, tier, createdAt FROM gratitude_wall WHERE isVisible = 1 ORDER BY createdAt DESC LIMIT 50'
    );
    res.json(entries);
  } catch (error) {
    console.error('Gratitude wall error:', error);
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
});

// POST /api/support/gratitude-wall (authenticated)
router.post('/gratitude-wall', authenticateToken, async (req, res) => {
  try {
    const { displayName, message, amount, tier } = req.body;
    const userId = req.user.userId;

    const result = await dbRun(
      'INSERT INTO gratitude_wall (userId, displayName, message, amount, tier) VALUES (?, ?, ?, ?, ?)',
      [userId, displayName, message || null, amount || null, tier || null]
    );
    res.status(201).json({ message: 'Added to wall of gratitude', id: result.lastID });
  } catch (error) {
    console.error('Gratitude wall add error:', error);
    res.status(500).json({ error: 'Failed to add entry' });
  }
});

// POST /api/support/contact (public)
router.post('/contact', async (req, res) => {
  try {
    const { name, email, organization, interestType, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    await dbRun(
      'INSERT INTO contact_messages (name, email, organization, interestType, subject, message) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, organization || null, interestType || null, subject || null, message]
    );

    res.status(201).json({ message: 'Message sent successfully. We will get back to you soon!' });
  } catch (error) {
    console.error('Contact error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;
