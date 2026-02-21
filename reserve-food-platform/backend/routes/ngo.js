const express = require('express');
const { db, dbRun, dbGet, dbAll } = require('../db/database');
const { authenticateToken, requireVerified } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// GET /api/ngo/stats/:userId
router.get('/stats/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const totalCollections = await dbGet("SELECT COUNT(*) as count FROM claims WHERE ngoId = ? AND status = 'collected'", [userId]);
    const activeClaims = await dbGet("SELECT COUNT(*) as count FROM claims WHERE ngoId = ? AND status IN ('pending', 'confirmed')", [userId]);
    const foodCollected = await dbGet(`
      SELECT COALESCE(SUM(l.quantity), 0) as total FROM claims c
      JOIN listings l ON c.listingId = l.id WHERE c.ngoId = ? AND c.status = 'collected'
    `, [userId]);
    const peopleFed = Math.floor((foodCollected?.total || 0) * 2.5);

    res.json({
      totalCollections: totalCollections.count,
      activeClaims: activeClaims.count,
      foodCollected: foodCollected.total || 0,
      peopleFed,
    });
  } catch (error) {
    console.error('NGO stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/ngo/listings
router.get('/listings', async (req, res) => {
  try {
    const listings = await dbAll(`
      SELECT l.*, u.name as donorName, u.organizationName, u.phone as donorPhone
      FROM listings l
      JOIN users u ON l.donorId = u.id
      WHERE l.status = 'active' AND l.bestBefore > datetime('now')
      ORDER BY l.bestBefore ASC
    `);
    res.json(listings);
  } catch (error) {
    console.error('NGO listings error:', error);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// GET /api/ngo/claims/:userId
router.get('/claims/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const claims = await dbAll(`
      SELECT c.*, l.foodName, l.quantity as listingQuantity, l.unit, l.pickupLocation, l.bestBefore,
             l.latitude, l.longitude, l.category,
             u.name as donorName, u.organizationName, u.phone
      FROM claims c
      JOIN listings l ON c.listingId = l.id
      JOIN users u ON l.donorId = u.id
      WHERE c.ngoId = ?
      ORDER BY c.createdAt DESC
    `, [userId]);
    res.json(claims);
  } catch (error) {
    console.error('NGO claims error:', error);
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
});

// POST /api/ngo/claim
router.post('/claim', requireVerified, async (req, res) => {
  try {
    const { listingId, ngoId, scheduledTime, deliveryMethod, ngoLatitude, ngoLongitude } = req.body;

    if (!listingId || !ngoId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const listing = await dbGet("SELECT * FROM listings WHERE id = ? AND status = 'active'", [listingId]);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not available' });
    }

    const existingClaim = await dbGet(
      "SELECT id FROM claims WHERE listingId = ? AND ngoId = ? AND status IN ('pending', 'confirmed')",
      [listingId, ngoId]
    );
    if (existingClaim) {
      return res.status(400).json({ error: 'You already have an active claim on this listing' });
    }

    // Calculate delivery fee if platform delivery is selected
    let deliveryFee = 0;
    let deliveryDistance = 0;
    const method = deliveryMethod || 'self-pickup';

    if (method === 'platform-delivery' && listing.latitude && listing.longitude && ngoLatitude && ngoLongitude) {
      // Haversine distance calculation
      const R = 6371; // Earth radius in km
      const dLat = (ngoLatitude - listing.latitude) * Math.PI / 180;
      const dLon = (ngoLongitude - listing.longitude) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(listing.latitude * Math.PI / 180) * Math.cos(ngoLatitude * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
      deliveryDistance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      deliveryDistance = Math.round(deliveryDistance * 10) / 10;

      // Fee: ₹30 base + ₹8/km 
      deliveryFee = Math.round(30 + deliveryDistance * 8);
    }

    const result = await dbRun(
      `INSERT INTO claims (listingId, ngoId, scheduledTime, quantity, deliveryMethod, deliveryFee, deliveryDistance, deliveryStatus, ngoLatitude, ngoLongitude)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [listingId, ngoId, scheduledTime || null, listing.quantity, method, deliveryFee, deliveryDistance,
       method === 'platform-delivery' ? 'pending' : null,
       ngoLatitude || null, ngoLongitude || null]
    );

    await dbRun("UPDATE listings SET status = 'claimed' WHERE id = ?", [listingId]);

    // Create notification for donor
    const { createNotification } = require('../utils/notifications');
    const ngoUser = await dbGet('SELECT name, organizationName FROM users WHERE id = ?', [ngoId]);
    try {
      await createNotification(req.app.get('io'), {
        userId: listing.donorId,
        type: 'claim_new',
        title: 'New Claim on Your Listing',
        message: `${ngoUser?.organizationName || ngoUser?.name || 'An NGO'} claimed your listing "${listing.foodName}"`,
        relatedId: result.lastID,
        relatedType: 'claim',
      });
    } catch (e) { /* notification failure shouldn't block claim */ }

    res.status(201).json({
      message: method === 'platform-delivery' 
        ? `Food claimed with platform delivery! Fee: ₹${deliveryFee} (${deliveryDistance} km)`
        : 'Food claimed successfully! You can now coordinate pickup with the donor.',
      claim: { id: result.lastID, listingId, ngoId, status: 'pending', deliveryMethod: method, deliveryFee, deliveryDistance },
    });
  } catch (error) {
    console.error('Claim error:', error);
    res.status(500).json({ error: 'Failed to claim food' });
  }
});

// GET /api/ngo/history/:userId
router.get('/history/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const history = await dbAll(`
      SELECT c.*, l.foodName, l.category, l.quantity as listingQuantity, l.unit, l.pickupLocation,
             u.name as donorName, u.organizationName,
             (SELECT COUNT(*) FROM reviews WHERE claimId = c.id AND reviewerId = ?) as hasReviewed
      FROM claims c
      JOIN listings l ON c.listingId = l.id
      JOIN users u ON l.donorId = u.id
      WHERE c.ngoId = ? AND c.status = 'collected'
      ORDER BY c.collectedAt DESC
    `, [userId, userId]);
    res.json(history);
  } catch (error) {
    console.error('NGO history error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// GET /api/ngo/impact/:userId
router.get('/impact/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    const totalFood = await dbGet(`
      SELECT COALESCE(SUM(l.quantity), 0) as total FROM claims c
      JOIN listings l ON c.listingId = l.id WHERE c.ngoId = ? AND c.status = 'collected'
    `, [userId]);

    const monthlyCollections = await dbAll(`
      SELECT strftime('%Y-%m', c.collectedAt) as month, COUNT(*) as count, SUM(l.quantity) as quantity
      FROM claims c JOIN listings l ON c.listingId = l.id
      WHERE c.ngoId = ? AND c.status = 'collected'
      GROUP BY month ORDER BY month DESC LIMIT 12
    `, [userId]);

    const categoryBreakdown = await dbAll(`
      SELECT l.category, COUNT(*) as count, SUM(l.quantity) as quantity
      FROM claims c JOIN listings l ON c.listingId = l.id
      WHERE c.ngoId = ? AND c.status = 'collected'
      GROUP BY l.category ORDER BY count DESC
    `, [userId]);

    const topDonors = await dbAll(`
      SELECT u.id, u.name, u.organizationName, COUNT(*) as donations, SUM(l.quantity) as totalQuantity
      FROM claims c JOIN listings l ON c.listingId = l.id JOIN users u ON l.donorId = u.id
      WHERE c.ngoId = ? AND c.status = 'collected'
      GROUP BY u.id ORDER BY donations DESC LIMIT 10
    `, [userId]);

    const avgRating = await dbGet(
      'SELECT AVG(overall) as avg, COUNT(*) as count FROM reviews WHERE revieweeId = ?',
      [userId]
    );

    const total = totalFood?.total || 0;
    res.json({
      totalFoodCollected: total,
      foodCollected: total,
      mealsProvided: Math.floor(total * 2.5),
      co2Saved: Math.floor(total * 2.5),
      peopleFed: Math.floor(total * 2.5),
      monthlyCollections,
      categoryBreakdown,
      topDonors,
      avgRating: avgRating?.avg || 0,
      reviewCount: avgRating?.count || 0,
    });
  } catch (error) {
    console.error('NGO impact error:', error);
    res.status(500).json({ error: 'Failed to fetch impact data' });
  }
});

module.exports = router;
