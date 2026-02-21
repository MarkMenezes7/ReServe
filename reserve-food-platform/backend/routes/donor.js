const express = require('express');
const { db, dbRun, dbGet, dbAll } = require('../db/database');
const { authenticateToken, requireRole, requireVerified } = require('../middleware/auth');

const router = express.Router();

// All donor routes require authentication
router.use(authenticateToken);

// GET /api/donor/stats/:userId
router.get('/stats/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const totalDonations = await dbGet('SELECT COUNT(*) as count FROM listings WHERE donorId = ?', [userId]);
    const activeListings = await dbGet("SELECT COUNT(*) as count FROM listings WHERE donorId = ? AND status = 'active'", [userId]);
    const totalClaims = await dbGet('SELECT COUNT(*) as count FROM claims c JOIN listings l ON c.listingId = l.id WHERE l.donorId = ?', [userId]);
    const foodSaved = await dbGet("SELECT COALESCE(SUM(l.quantity), 0) as total FROM listings l JOIN claims c ON c.listingId = l.id WHERE l.donorId = ? AND c.status = 'collected'", [userId]);

    res.json({
      totalDonations: totalDonations.count,
      activeListings: activeListings.count,
      totalClaims: totalClaims.count,
      foodSaved: foodSaved.total,
    });
  } catch (error) {
    console.error('Donor stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/donor/listings/:userId
router.get('/listings/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const status = req.query.status;
    let query = 'SELECT * FROM listings WHERE donorId = ?';
    const params = [userId];

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }
    query += ' ORDER BY createdAt DESC';

    const listings = await dbAll(query, params);
    res.json(listings);
  } catch (error) {
    console.error('Donor listings error:', error);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// GET /api/donor/claims/:userId
router.get('/claims/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const claims = await dbAll(`
      SELECT c.*, l.foodName, l.quantity as listingQuantity, l.unit, l.pickupLocation, l.bestBefore,
             u.name as ngoName, u.organizationName as ngoOrganization, u.phone as ngoPhone, u.email as ngoEmail
      FROM claims c
      JOIN listings l ON c.listingId = l.id
      JOIN users u ON c.ngoId = u.id
      WHERE l.donorId = ?
      ORDER BY c.createdAt DESC
    `, [userId]);
    res.json(claims);
  } catch (error) {
    console.error('Donor claims error:', error);
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
});

// POST /api/donor/listings
router.post('/listings', requireVerified, async (req, res) => {
  try {
    const {
      foodName, category, foodType, quantity, unit, description, images,
      availableFrom, bestBefore, pickupLocation, latitude, longitude,
      storageType, packagingType, handlingInstructions,
    } = req.body;

    const donorId = req.user.userId;

    if (!foodName || !category || !quantity || !unit || !availableFrom || !bestBefore || !pickupLocation) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const result = await dbRun(
      `INSERT INTO listings (donorId, foodName, category, foodType, quantity, unit, description, images, availableFrom, bestBefore, pickupLocation, latitude, longitude, storageType, packagingType, handlingInstructions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [donorId, foodName, category, foodType || null, quantity, unit, description || null,
       images ? JSON.stringify(images) : null, availableFrom, bestBefore, pickupLocation,
       latitude || null, longitude || null, storageType || 'room-temp', packagingType || null, handlingInstructions || null]
    );

    res.status(201).json({
      message: 'Listing created successfully',
      listing: { id: result.lastID, foodName, category, quantity, unit, status: 'active' },
    });
  } catch (error) {
    console.error('Create listing error:', error);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

// PUT /api/donor/listings/:id
router.put('/listings/:id', async (req, res) => {
  try {
    const listingId = req.params.id;
    const donorId = req.user.userId;

    const listing = await dbGet('SELECT * FROM listings WHERE id = ? AND donorId = ?', [listingId, donorId]);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    if (listing.status !== 'active') {
      return res.status(400).json({ error: 'Can only edit active listings' });
    }

    const {
      foodName, category, foodType, quantity, unit, description, images,
      availableFrom, bestBefore, pickupLocation, latitude, longitude,
      storageType, packagingType, handlingInstructions,
    } = req.body;

    await dbRun(
      `UPDATE listings SET foodName=?, category=?, foodType=?, quantity=?, unit=?, description=?, images=?,
       availableFrom=?, bestBefore=?, pickupLocation=?, latitude=?, longitude=?,
       storageType=?, packagingType=?, handlingInstructions=?
       WHERE id = ? AND donorId = ?`,
      [
        foodName || listing.foodName, category || listing.category, foodType || listing.foodType,
        quantity || listing.quantity, unit || listing.unit, description ?? listing.description,
        images ? JSON.stringify(images) : listing.images,
        availableFrom || listing.availableFrom, bestBefore || listing.bestBefore,
        pickupLocation || listing.pickupLocation, latitude ?? listing.latitude, longitude ?? listing.longitude,
        storageType || listing.storageType, packagingType ?? listing.packagingType,
        handlingInstructions ?? listing.handlingInstructions,
        listingId, donorId,
      ]
    );

    res.json({ message: 'Listing updated successfully' });
  } catch (error) {
    console.error('Update listing error:', error);
    res.status(500).json({ error: 'Failed to update listing' });
  }
});

// DELETE /api/donor/listings/:id
router.delete('/listings/:id', async (req, res) => {
  try {
    const listingId = req.params.id;
    const donorId = req.user.userId;

    const listing = await dbGet('SELECT * FROM listings WHERE id = ? AND donorId = ?', [listingId, donorId]);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const pendingClaims = await dbGet("SELECT COUNT(*) as count FROM claims WHERE listingId = ? AND status IN ('pending', 'confirmed')", [listingId]);
    if (pendingClaims.count > 0) {
      return res.status(400).json({ error: 'Cannot delete listing with pending claims' });
    }

    await dbRun("UPDATE listings SET status = 'deleted' WHERE id = ?", [listingId]);
    res.json({ message: 'Listing deleted successfully' });
  } catch (error) {
    console.error('Delete listing error:', error);
    res.status(500).json({ error: 'Failed to delete listing' });
  }
});

// GET /api/donor/analytics/:userId
router.get('/analytics/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    const monthly = await dbAll(`
      SELECT strftime('%Y-%m', createdAt) as month, COUNT(*) as count, SUM(quantity) as quantity
      FROM listings WHERE donorId = ? GROUP BY month ORDER BY month DESC LIMIT 12
    `, [userId]);

    const categories = await dbAll(`
      SELECT category, COUNT(*) as count, SUM(quantity) as quantity
      FROM listings WHERE donorId = ? GROUP BY category ORDER BY count DESC
    `, [userId]);

    const hourly = await dbAll(`
      SELECT CAST(strftime('%H', createdAt) AS INTEGER) as hour, COUNT(*) as count
      FROM listings WHERE donorId = ? GROUP BY hour ORDER BY hour
    `, [userId]);

    const totals = await dbGet(`
      SELECT COUNT(*) as totalDonations, COALESCE(SUM(quantity), 0) as totalQuantity
      FROM listings WHERE donorId = ?
    `, [userId]);

    const collected = await dbGet(`
      SELECT COUNT(*) as count FROM claims c JOIN listings l ON c.listingId = l.id
      WHERE l.donorId = ? AND c.status = 'collected'
    `, [userId]);

    const totalClaims = await dbGet(`
      SELECT COUNT(*) as count FROM claims c JOIN listings l ON c.listingId = l.id
      WHERE l.donorId = ?
    `, [userId]);

    const totalDonations = totals.totalDonations || 0;
    const totalQuantity = totals.totalQuantity || 0;

    res.json({
      monthly,
      categories,
      hourly,
      totalDonations,
      totalQuantity,
      avgPerDonation: totalDonations > 0 ? totalQuantity / totalDonations : 0,
      collectionRate: totalClaims.count > 0 ? (collected.count / totalClaims.count) * 100 : 0,
    });
  } catch (error) {
    console.error('Donor analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/donor/history/:userId
router.get('/history/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const listings = await dbAll(`
      SELECT l.*,
        (SELECT COUNT(*) FROM claims WHERE listingId = l.id) as claimCount,
        (SELECT u.name FROM claims c JOIN users u ON c.ngoId = u.id WHERE c.listingId = l.id AND c.status = 'collected' LIMIT 1) as collectedBy,
        (SELECT c.collectedAt FROM claims c WHERE c.listingId = l.id AND c.status = 'collected' LIMIT 1) as collectedAt
      FROM listings l WHERE l.donorId = ?
      ORDER BY l.createdAt DESC
    `, [userId]);
    res.json(listings);
  } catch (error) {
    console.error('Donor history error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// GET /api/donor/profile/:userId
router.get('/profile/:userId', async (req, res) => {
  try {
    const user = await dbGet(
      'SELECT id, name, email, userType, organizationName, phone, address, city, state, pincode, bio, profileImage, isVerified, createdAt FROM users WHERE id = ?',
      [req.params.userId]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    const avgRating = await dbGet(
      'SELECT AVG(overall) as avg, COUNT(*) as count FROM reviews WHERE revieweeId = ?',
      [req.params.userId]
    );

    res.json({ ...user, avgRating: avgRating?.avg || 0, reviewCount: avgRating?.count || 0 });
  } catch (error) {
    console.error('Donor profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/donor/profile/:userId
router.put('/profile/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    if (req.user.userId !== parseInt(userId)) {
      return res.status(403).json({ error: 'Cannot edit another user\'s profile' });
    }

    const { name, organizationName, phone, address, city, state, pincode, bio } = req.body;
    await dbRun(
      `UPDATE users SET name=?, organizationName=?, phone=?, address=?, city=?, state=?, pincode=?, bio=?, updatedAt=CURRENT_TIMESTAMP WHERE id=?`,
      [name, organizationName, phone, address, city, state, pincode, bio, userId]
    );
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
