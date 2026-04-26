const express = require('express');
const path = require('path');
const multer = require('multer');
const { db, dbRun, dbGet, dbAll } = require('../db/database');
const { authenticateToken, requireRole, requireVerified } = require('../middleware/auth');

const router = express.Router();

// Multer config for verification documents
const verificationStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'verification'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `verif-${req.user.userId}-${Date.now()}${ext}`);
  },
});
const verificationUpload = multer({
  storage: verificationStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|pdf|webp)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, WEBP, and PDF files are allowed'));
    }
  },
});

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

// GET /api/donor/delivery-tracking/:userId
router.get('/delivery-tracking/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (req.user.userId !== userId) {
      return res.status(403).json({ error: 'Cannot access another user\'s delivery tracking' });
    }

    const deliveries = await dbAll(
      `SELECT
         c.id,
         c.listingId,
         c.ngoId,
         c.status as claimStatus,
         c.deliveryStatus,
         c.deliveryMethod,
         c.deliveryFee,
         c.deliveryDistance,
         c.paymentStatus,
         c.driverId,
         c.driverCurrentLat,
         c.driverCurrentLng,
         c.driverRouteProgress,
         c.driverRouteStage,
         c.dispatchedAt,
         c.deliveredAt,
         c.createdAt,
         l.foodName,
         l.quantity,
         l.unit,
         l.pickupLocation,
         l.latitude as pickupLat,
         l.longitude as pickupLng,
         ngo.name as ngoName,
         ngo.organizationName as ngoOrg,
         driver.name as driverName,
         driver.phone as driverPhone,
         COALESCE(c.ngoLatitude, ngo.latitude) as dropLat,
         COALESCE(c.ngoLongitude, ngo.longitude) as dropLng,
         COALESCE(ngo.address, ngo.city, 'NGO Location') as dropLocation
       FROM claims c
       JOIN listings l ON c.listingId = l.id
       JOIN users ngo ON c.ngoId = ngo.id
       LEFT JOIN users driver ON c.driverId = driver.id
       WHERE l.donorId = ?
         AND c.deliveryMethod = 'platform-delivery'
         AND COALESCE(c.paymentStatus, 'verified') IN ('verified', 'not-required')
       ORDER BY c.createdAt DESC`,
      [userId]
    );

    res.json(deliveries);
  } catch (error) {
    console.error('Donor delivery tracking error:', error);
    res.status(500).json({ error: 'Failed to fetch delivery tracking' });
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

// Unit-to-kg conversion factor via SQL CASE (used in analytics queries)
const QTY_TO_KG = `
  CASE unit
    WHEN 'kg' THEN quantity
    WHEN 'liters' THEN quantity * 1.0
    WHEN 'servings' THEN quantity * 0.3
    WHEN 'pieces' THEN quantity * 0.1
    WHEN 'packets' THEN quantity * 0.25
    WHEN 'boxes' THEN quantity * 2.0
    ELSE quantity * 0.2
  END
`;

// GET /api/donor/analytics/:userId
router.get('/analytics/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    const monthly = await dbAll(`
      SELECT strftime('%Y-%m', createdAt) as month, COUNT(*) as count,
        ROUND(SUM(${QTY_TO_KG}), 2) as quantity
      FROM listings WHERE donorId = ? GROUP BY month ORDER BY month DESC LIMIT 12
    `, [userId]);

    const categories = await dbAll(`
      SELECT category, COUNT(*) as count,
        ROUND(SUM(${QTY_TO_KG}), 2) as quantity
      FROM listings WHERE donorId = ? GROUP BY category ORDER BY count DESC
    `, [userId]);

    const hourly = await dbAll(`
      SELECT CAST(strftime('%H', createdAt) AS INTEGER) as hour, COUNT(*) as count
      FROM listings WHERE donorId = ? GROUP BY hour ORDER BY hour
    `, [userId]);

    const totals = await dbGet(`
      SELECT COUNT(*) as totalDonations,
        ROUND(COALESCE(SUM(${QTY_TO_KG}), 0), 2) as totalQuantity
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
      avgPerDonation: totalDonations > 0 ? +(totalQuantity / totalDonations).toFixed(2) : 0,
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
        (SELECT u.name FROM claims c JOIN users u ON c.ngoId = u.id WHERE c.listingId = l.id AND c.status = 'collected' LIMIT 1) as claimedBy,
        (SELECT u.organizationName FROM claims c JOIN users u ON c.ngoId = u.id WHERE c.listingId = l.id AND c.status = 'collected' LIMIT 1) as claimedByOrg,
        (SELECT c.collectedAt FROM claims c WHERE c.listingId = l.id AND c.status = 'collected' LIMIT 1) as collectedAt,
        (SELECT r.overall FROM reviews r JOIN claims c ON r.claimId = c.id WHERE c.listingId = l.id AND r.revieweeId = ? LIMIT 1) as rating
      FROM listings l WHERE l.donorId = ?
      ORDER BY l.createdAt DESC
    `, [userId, userId]);
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

// POST /api/donor/verification — submit a verification request
router.post('/verification', verificationUpload.single('document'), async (req, res) => {
  try {
    const userId = req.user.userId;

    // Check if there's already a pending request
    const existing = await dbGet(
      "SELECT id, status FROM verification_requests WHERE userId = ? AND status = 'pending'",
      [userId]
    );
    if (existing) {
      return res.status(400).json({ error: 'You already have a pending verification request' });
    }

    const { businessName, businessType, fssaiNumber, gstNumber, description, certificateDetails } = req.body;
    if (!businessName || !businessType) {
      return res.status(400).json({ error: 'Business name and type are required' });
    }

    const documentUrl = req.file ? `/uploads/verification/${req.file.filename}` : null;

    const result = await dbRun(
      `INSERT INTO verification_requests (userId, businessName, businessType, fssaiNumber, gstNumber, description, certificateDetails, documentUrl)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, businessName, businessType, fssaiNumber || null, gstNumber || null, description || null, certificateDetails || null, documentUrl]
    );

    res.status(201).json({ message: 'Verification request submitted', requestId: result.lastID });
  } catch (error) {
    console.error('Submit verification error:', error);
    res.status(500).json({ error: 'Failed to submit verification request' });
  }
});

// GET /api/donor/verification — get current user's verification status
router.get('/verification', async (req, res) => {
  try {
    const userId = req.user.userId;
    const request = await dbGet(
      `SELECT * FROM verification_requests WHERE userId = ? ORDER BY submittedAt DESC LIMIT 1`,
      [userId]
    );
    const user = await dbGet('SELECT isVerified FROM users WHERE id = ?', [userId]);
    res.json({ request: request || null, isVerified: !!user?.isVerified });
  } catch (error) {
    console.error('Get verification status error:', error);
    res.status(500).json({ error: 'Failed to fetch verification status' });
  }
});

module.exports = router;
