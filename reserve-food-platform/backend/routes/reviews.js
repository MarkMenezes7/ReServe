const express = require('express');
const { db, dbRun, dbGet, dbAll } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { createNotification } = require('../utils/notifications');

const router = express.Router();

router.use(authenticateToken);

// POST /api/reviews
router.post('/', async (req, res) => {
  try {
    const { claimId, revieweeId, foodQuality, communication, timeliness, overall, comment, isAnonymous } = req.body;
    const reviewerId = req.user.userId;

    if (!claimId || !revieweeId || !overall) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const claim = await dbGet("SELECT * FROM claims WHERE id = ? AND status = 'collected'", [claimId]);
    if (!claim) {
      return res.status(400).json({ error: 'Can only review collected claims' });
    }

    const existing = await dbGet('SELECT id FROM reviews WHERE claimId = ? AND reviewerId = ?', [claimId, reviewerId]);
    if (existing) {
      return res.status(400).json({ error: 'You have already reviewed this claim' });
    }

    const result = await dbRun(
      `INSERT INTO reviews (claimId, reviewerId, revieweeId, foodQuality, communication, timeliness, overall, comment, isAnonymous)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [claimId, reviewerId, revieweeId, foodQuality || null, communication || null, timeliness || null, overall, comment || null, isAnonymous ? 1 : 0]
    );

    const io = req.app.get('io');
    try {
      await createNotification(io, {
        userId: revieweeId,
        type: 'review_new',
        title: 'New Review Received',
        message: `You received a ${overall}-star review`,
        relatedId: result.lastID,
        relatedType: 'review',
      });
    } catch (e) { /* non-critical */ }

    res.status(201).json({ message: 'Review submitted successfully', id: result.lastID });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// GET /api/reviews/claim/:claimId
router.get('/claim/:claimId', async (req, res) => {
  try {
    const reviews = await dbAll(`
      SELECT r.*, u.name as reviewerName, u.organizationName as reviewerOrg
      FROM reviews r JOIN users u ON r.reviewerId = u.id
      WHERE r.claimId = ? ORDER BY r.createdAt DESC
    `, [req.params.claimId]);

    reviews.forEach(r => {
      if (r.isAnonymous) {
        r.reviewerName = 'Anonymous';
        r.reviewerOrg = null;
      }
    });

    res.json(reviews);
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// GET /api/reviews/user/:userId
router.get('/user/:userId', async (req, res) => {
  try {
    const reviews = await dbAll(`
      SELECT r.*, u.name as reviewerName, u.organizationName as reviewerOrg,
             l.foodName
      FROM reviews r
      JOIN users u ON r.reviewerId = u.id
      JOIN claims c ON r.claimId = c.id
      JOIN listings l ON c.listingId = l.id
      WHERE r.revieweeId = ?
      ORDER BY r.createdAt DESC
    `, [req.params.userId]);

    reviews.forEach(r => {
      if (r.isAnonymous) {
        r.reviewerName = 'Anonymous';
        r.reviewerOrg = null;
      }
    });

    res.json(reviews);
  } catch (error) {
    console.error('Get user reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// GET /api/reviews/user/:userId/stats
router.get('/user/:userId/stats', async (req, res) => {
  try {
    const stats = await dbGet(`
      SELECT AVG(overall) as avgOverall, AVG(foodQuality) as avgQuality,
             AVG(communication) as avgComm, AVG(timeliness) as avgTime,
             COUNT(*) as totalReviews
      FROM reviews WHERE revieweeId = ?
    `, [req.params.userId]);

    const distribution = await dbAll(`
      SELECT overall as stars, COUNT(*) as count
      FROM reviews WHERE revieweeId = ?
      GROUP BY overall ORDER BY overall DESC
    `, [req.params.userId]);

    res.json({ ...stats, distribution });
  } catch (error) {
    console.error('Review stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/reviews/pending/:userId
router.get('/pending/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const pending = await dbAll(`
      SELECT c.id as claimId, l.foodName, l.quantity, l.unit,
        CASE WHEN l.donorId = ? THEN u_ngo.name ELSE u_donor.name END as counterpartName,
        CASE WHEN l.donorId = ? THEN u_ngo.organizationName ELSE u_donor.organizationName END as counterpartOrg,
        CASE WHEN l.donorId = ? THEN c.ngoId ELSE l.donorId END as revieweeId,
        c.collectedAt
      FROM claims c
      JOIN listings l ON c.listingId = l.id
      JOIN users u_ngo ON c.ngoId = u_ngo.id
      JOIN users u_donor ON l.donorId = u_donor.id
      WHERE c.status = 'collected'
        AND (l.donorId = ? OR c.ngoId = ?)
        AND NOT EXISTS (SELECT 1 FROM reviews WHERE claimId = c.id AND reviewerId = ?)
      ORDER BY c.collectedAt DESC
    `, [userId, userId, userId, userId, userId, userId]);
    res.json(pending);
  } catch (error) {
    console.error('Pending reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch pending reviews' });
  }
});

module.exports = router;
