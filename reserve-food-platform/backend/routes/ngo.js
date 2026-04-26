const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db, dbRun, dbGet, dbAll } = require('../db/database');
const { authenticateToken, requireVerified } = require('../middleware/auth');

const router = express.Router();
const WEBSITE_UPI_ID = process.env.RESERVE_UPI_ID || 'reserve@upi';
const RICKSHAW_BASE_KM = 2;
const RICKSHAW_BASE_FARE = 45;
const RICKSHAW_PER_KM = 18;

const LOCATION_TEXT_FALLBACKS = [
  { keywords: ['borivali west'], lat: 19.232, lng: 72.856 },
  { keywords: ['borivali east'], lat: 19.2292, lng: 72.8642 },
  { keywords: ['kandivali west'], lat: 19.2058, lng: 72.851 },
  { keywords: ['malad west'], lat: 19.1867, lng: 72.8489 },
  { keywords: ['goregaon west'], lat: 19.1663, lng: 72.8526 },
  { keywords: ['andheri west'], lat: 19.1364, lng: 72.8296 },
  { keywords: ['andheri east'], lat: 19.1136, lng: 72.8697 },
  { keywords: ['vile parle'], lat: 19.1, lng: 72.85 },
  { keywords: ['bandra west'], lat: 19.0596, lng: 72.8295 },
  { keywords: ['dadar'], lat: 19.0178, lng: 72.8478 },
  { keywords: ['marine lines'], lat: 18.9442, lng: 72.8231 },
  { keywords: ['churchgate'], lat: 18.935, lng: 72.827 },
  { keywords: ['mumbai'], lat: 19.076, lng: 72.8777 },
  { keywords: ['navi mumbai'], lat: 19.033, lng: 73.0297 },
  { keywords: ['thane'], lat: 19.2183, lng: 72.9781 },
  { keywords: ['delhi'], lat: 28.6139, lng: 77.209 },
];

function isFiniteCoord(value) {
  return Number.isFinite(Number(value));
}

function parseNullableCoord(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function inferCoordsFromProfile(profile) {
  const text = `${profile?.address || ''} ${profile?.city || ''} ${profile?.state || ''}`.toLowerCase();
  if (!text.trim()) return null;

  for (const fallback of LOCATION_TEXT_FALLBACKS) {
    if (fallback.keywords.some((keyword) => text.includes(keyword))) {
      return { lat: fallback.lat, lng: fallback.lng };
    }
  }

  return null;
}

function inferCoordsFromText(text) {
  const lower = (text || '').toLowerCase();
  if (!lower.trim()) return null;

  for (const fallback of LOCATION_TEXT_FALLBACKS) {
    if (fallback.keywords.some((keyword) => lower.includes(keyword))) {
      return { lat: fallback.lat, lng: fallback.lng };
    }
  }

  return null;
}

function computeHaversineDistanceKm(startLat, startLng, endLat, endLng) {
  const R = 6371;
  const dLat = (endLat - startLat) * Math.PI / 180;
  const dLon = (endLng - startLng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(startLat * Math.PI / 180) * Math.cos(endLat * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateRickshawDeliveryFare(distanceKm) {
  const safeDistance = Math.max(0, Number(distanceKm) || 0);
  const extraDistanceKm = Math.max(0, safeDistance - RICKSHAW_BASE_KM);
  const distanceFare = Math.ceil(extraDistanceKm * RICKSHAW_PER_KM);
  const totalFare = Math.max(RICKSHAW_BASE_FARE, RICKSHAW_BASE_FARE + distanceFare);

  return {
    baseFare: RICKSHAW_BASE_FARE,
    baseDistanceKm: RICKSHAW_BASE_KM,
    perKmRate: RICKSHAW_PER_KM,
    extraDistanceKm: Number(extraDistanceKm.toFixed(1)),
    distanceFare,
    totalFare,
  };
}

async function resolveNgoCoordinates(ngoId, inputLat, inputLng) {
  let ngoLat = parseNullableCoord(inputLat);
  let ngoLng = parseNullableCoord(inputLng);

  if (!Number.isFinite(ngoLat) || !Number.isFinite(ngoLng)) {
    const ngo = await dbGet('SELECT latitude, longitude, address, city, state FROM users WHERE id = ?', [ngoId]);
    ngoLat = parseNullableCoord(ngo?.latitude);
    ngoLng = parseNullableCoord(ngo?.longitude);

    if (!Number.isFinite(ngoLat) || !Number.isFinite(ngoLng)) {
      const inferredCoords = inferCoordsFromProfile(ngo);
      if (inferredCoords) {
        ngoLat = inferredCoords.lat;
        ngoLng = inferredCoords.lng;

        await dbRun(
          `UPDATE users
           SET latitude = COALESCE(latitude, ?),
               longitude = COALESCE(longitude, ?)
           WHERE id = ?`,
          [ngoLat, ngoLng, ngoId]
        ).catch(() => {
          // Non-blocking: fee calculation can continue even if we fail to persist inferred coords.
        });
      }
    }
  }

  if (!Number.isFinite(ngoLat) || !Number.isFinite(ngoLng)) {
    return null;
  }

  return {
    lat: ngoLat,
    lng: ngoLng,
  };
}

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
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|pdf|webp)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, WEBP, and PDF files are allowed'));
    }
  },
});

// Multer config for payment screenshots
const paymentsUploadDir = path.join(__dirname, '..', 'uploads', 'payments');
fs.mkdirSync(paymentsUploadDir, { recursive: true });

const paymentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, paymentsUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `pay-${req.user.userId}-${Date.now()}${ext}`);
  },
});

const paymentUpload = multer({
  storage: paymentStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|webp)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, and WEBP files are allowed for payment screenshot'));
    }
  },
});

function handlePaymentUpload(req, res, next) {
  paymentUpload.single('paymentScreenshot')(req, res, (err) => {
    if (!err) {
      return next();
    }

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Payment screenshot must be under 10 MB' });
      }
      return res.status(400).json({ error: `Upload failed: ${err.message}` });
    }

    return res.status(400).json({ error: err.message || 'Payment screenshot upload failed' });
  });
}

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
    const includeInactive = ['1', 'true', 'yes'].includes(String(req.query.includeInactive || '').toLowerCase());
    const listings = await dbAll(
      includeInactive
        ? `
          SELECT l.*, u.name as donorName, u.organizationName, u.phone as donorPhone
          FROM listings l
          JOIN users u ON l.donorId = u.id
          ORDER BY CASE WHEN l.status = 'active' THEN 0 ELSE 1 END, l.bestBefore ASC
        `
        : `
          SELECT l.*, u.name as donorName, u.organizationName, u.phone as donorPhone
          FROM listings l
          JOIN users u ON l.donorId = u.id
          WHERE l.status = 'active' AND l.bestBefore > datetime('now')
          ORDER BY l.bestBefore ASC
        `
    );
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

// GET /api/ngo/delivery-tracking/:userId
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
         donor.id as donorId,
         donor.name as donorName,
         donor.organizationName as donorOrg,
         driver.name as driverName,
         driver.phone as driverPhone,
         COALESCE(c.ngoLatitude, ngo.latitude) as dropLat,
         COALESCE(c.ngoLongitude, ngo.longitude) as dropLng,
         COALESCE(ngo.address, ngo.city, 'NGO Location') as dropLocation
       FROM claims c
       JOIN listings l ON c.listingId = l.id
       JOIN users donor ON l.donorId = donor.id
       JOIN users ngo ON c.ngoId = ngo.id
       LEFT JOIN users driver ON c.driverId = driver.id
       WHERE c.ngoId = ?
         AND c.deliveryMethod = 'platform-delivery'
         AND COALESCE(c.paymentStatus, 'verified') IN ('verified', 'not-required')
       ORDER BY c.createdAt DESC`,
      [userId]
    );

    res.json(deliveries);
  } catch (error) {
    console.error('NGO delivery tracking error:', error);
    res.status(500).json({ error: 'Failed to fetch delivery tracking' });
  }
});

// POST /api/ngo/delivery-quote - calculate distance-based delivery fee before payment
router.post('/delivery-quote', requireVerified, async (req, res) => {
  try {
    const { listingId, ngoLatitude, ngoLongitude } = req.body;
    const parsedListingId = Number(listingId);

    if (!parsedListingId) {
      return res.status(400).json({ error: 'listingId is required' });
    }

    const listing = await dbGet(
      "SELECT id, foodName, pickupLocation, latitude, longitude FROM listings WHERE id = ? AND status = 'active'",
      [parsedListingId]
    );

    if (!listing) {
      return res.status(404).json({ error: 'Listing not available' });
    }

    if (!isFiniteCoord(listing.latitude) || !isFiniteCoord(listing.longitude)) {
      const inferredPickup = inferCoordsFromText(listing.pickupLocation);
      if (inferredPickup) {
        listing.latitude = inferredPickup.lat;
        listing.longitude = inferredPickup.lng;
        dbRun(
          'UPDATE listings SET latitude = COALESCE(latitude, ?), longitude = COALESCE(longitude, ?) WHERE id = ?',
          [inferredPickup.lat, inferredPickup.lng, listing.id]
        ).catch(() => {});
      } else {
        return res.status(400).json({ error: 'Donor pickup location is missing coordinates. Please ask the donor to update the listing.' });
      }
    }

    const ngoCoords = await resolveNgoCoordinates(req.user.userId, ngoLatitude, ngoLongitude);
    if (!ngoCoords) {
      return res.status(400).json({ error: 'NGO location is required to calculate delivery fee' });
    }

    const distanceRaw = computeHaversineDistanceKm(
      Number(listing.latitude),
      Number(listing.longitude),
      ngoCoords.lat,
      ngoCoords.lng
    );

    const deliveryDistance = Number(distanceRaw.toFixed(1));
    const breakdown = calculateRickshawDeliveryFare(deliveryDistance);

    return res.json({
      listingId: parsedListingId,
      foodName: listing.foodName,
      deliveryDistance,
      deliveryFee: breakdown.totalFare,
      pricingModel: 'rickshaw-meter',
      breakdown,
    });
  } catch (error) {
    console.error('Delivery quote error:', error);
    return res.status(500).json({ error: 'Failed to calculate delivery quote' });
  }
});

// POST /api/ngo/claim
router.post('/claim', requireVerified, handlePaymentUpload, async (req, res) => {
  try {
    const {
      listingId,
      ngoId,
      scheduledTime,
      deliveryMethod,
      ngoLatitude,
      ngoLongitude,
      paymentTransactionId,
    } = req.body;

    const parsedListingId = Number(listingId);
    const parsedNgoId = Number(ngoId);

    if (!parsedListingId || !parsedNgoId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (req.user.userId !== parsedNgoId) {
      return res.status(403).json({ error: 'Cannot create claim for another NGO account' });
    }

    const listing = await dbGet("SELECT * FROM listings WHERE id = ? AND status = 'active'", [parsedListingId]);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not available' });
    }

    const existingClaim = await dbGet(
      "SELECT id FROM claims WHERE listingId = ? AND ngoId = ? AND status IN ('pending', 'confirmed')",
      [parsedListingId, parsedNgoId]
    );
    if (existingClaim) {
      return res.status(400).json({ error: 'You already have an active claim on this listing' });
    }

    // Calculate delivery fee if platform delivery is selected
    const method = deliveryMethod || 'self-pickup';
    const paymentScreenshotUrl = req.file ? `/uploads/payments/${req.file.filename}` : null;
    let deliveryFee = 0;
    let deliveryDistance = null;
    let fareBreakdown = null;
    const txId = (paymentTransactionId || '').trim();

    if (method === 'platform-delivery') {
      if (!txId) {
        return res.status(400).json({ error: 'Transaction ID is required for platform delivery' });
      }
      if (!paymentScreenshotUrl) {
        return res.status(400).json({ error: 'Payment screenshot is required for platform delivery' });
      }
    }

    const ngoCoords = await resolveNgoCoordinates(parsedNgoId, ngoLatitude, ngoLongitude);
    const ngoLat = ngoCoords?.lat;
    const ngoLng = ngoCoords?.lng;

    if (method === 'platform-delivery') {
      if (!isFiniteCoord(listing.latitude) || !isFiniteCoord(listing.longitude)) {
        const inferredPickup = inferCoordsFromText(listing.pickupLocation);
        if (inferredPickup) {
          listing.latitude = inferredPickup.lat;
          listing.longitude = inferredPickup.lng;
          dbRun(
            'UPDATE listings SET latitude = COALESCE(latitude, ?), longitude = COALESCE(longitude, ?) WHERE id = ?',
            [inferredPickup.lat, inferredPickup.lng, listing.id]
          ).catch(() => {});
        } else {
          return res.status(400).json({ error: 'Donor pickup location is missing coordinates' });
        }
      }

      if (!ngoCoords) {
        return res.status(400).json({ error: 'Unable to calculate delivery fee. Please enable location and try again.' });
      }

      const distanceRaw = computeHaversineDistanceKm(
        Number(listing.latitude),
        Number(listing.longitude),
        ngoLat,
        ngoLng
      );
      deliveryDistance = Number(distanceRaw.toFixed(1));
      fareBreakdown = calculateRickshawDeliveryFare(deliveryDistance);
      deliveryFee = fareBreakdown.totalFare;
    }

    const result = await dbRun(
      `INSERT INTO claims (
         listingId,
         ngoId,
         scheduledTime,
         quantity,
         deliveryMethod,
         deliveryFee,
         deliveryDistance,
         deliveryStatus,
         paymentUpiId,
         paymentTransactionId,
         paymentScreenshotUrl,
         paymentStatus,
         ngoLatitude,
         ngoLongitude
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        parsedListingId,
        parsedNgoId,
        scheduledTime || null,
        listing.quantity,
        method,
        deliveryFee,
        deliveryDistance,
        method === 'platform-delivery' ? 'payment-pending' : null,
        method === 'platform-delivery' ? WEBSITE_UPI_ID : null,
        method === 'platform-delivery' ? txId : null,
        method === 'platform-delivery' ? paymentScreenshotUrl : null,
        method === 'platform-delivery' ? 'pending-verification' : 'not-required',
        Number.isFinite(ngoLat) ? ngoLat : null,
        Number.isFinite(ngoLng) ? ngoLng : null,
      ]
    );

    await dbRun("UPDATE listings SET status = 'claimed' WHERE id = ?", [parsedListingId]);

    // Create notification for donor
    const { createNotification } = require('../utils/notifications');
    const ngoUser = await dbGet('SELECT name, organizationName FROM users WHERE id = ?', [parsedNgoId]);
    try {
      await createNotification(req.app.get('io'), {
        userId: listing.donorId,
        type: 'claim_new',
        title: 'New Claim on Your Listing',
        message: `${ngoUser?.organizationName || ngoUser?.name || 'An NGO'} claimed your listing "${listing.foodName}"`,
        relatedId: result.lastID,
        relatedType: 'claim',
      });
      if (method === 'platform-delivery') {
        await createNotification(req.app.get('io'), {
          userId: req.user.userId,
          type: 'payment_submitted',
          title: 'Payment Submitted',
          message: `Payment proof submitted. Admin verification is pending for "${listing.foodName}"`,
          relatedId: result.lastID,
          relatedType: 'claim',
        });
      }
    } catch (e) { /* notification failure shouldn't block claim */ }

    res.status(201).json({
      message: 'Food claimed',
      claim: {
        id: result.lastID,
        listingId: parsedListingId,
        ngoId: parsedNgoId,
        status: 'pending',
        deliveryMethod: method,
        deliveryFee,
        deliveryDistance,
        fareBreakdown,
        paymentStatus: method === 'platform-delivery' ? 'pending-verification' : 'not-required',
      },
    });
  } catch (error) {
    console.error('Claim error:', error);
    res.status(500).json({ error: error.message || 'Failed to claim food' });
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

// GET /api/ngo/profile/:userId
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
    console.error('NGO profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/ngo/profile/:userId
router.put('/profile/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    if (req.user.userId !== parseInt(userId)) {
      return res.status(403).json({ error: "Cannot edit another user's profile" });
    }

    const { name, organizationName, phone, address, city, state, pincode, bio } = req.body;
    await dbRun(
      `UPDATE users SET name=?, organizationName=?, phone=?, address=?, city=?, state=?, pincode=?, bio=?, updatedAt=CURRENT_TIMESTAMP WHERE id=?`,
      [name, organizationName, phone, address, city, state, pincode, bio, userId]
    );
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update NGO profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// POST /api/ngo/verification — submit a verification request
router.post('/verification', verificationUpload.single('document'), async (req, res) => {
  try {
    const userId = req.user.userId;

    const existing = await dbGet(
      "SELECT id, status FROM verification_requests WHERE userId = ? AND status = 'pending'",
      [userId]
    );
    if (existing) {
      return res.status(400).json({ error: 'You already have a pending verification request' });
    }

    const { businessName, businessType, fssaiNumber, gstNumber, description, certificateDetails } = req.body;
    if (!businessName || !businessType) {
      return res.status(400).json({ error: 'Organization name and type are required' });
    }

    const documentUrl = req.file ? `/uploads/verification/${req.file.filename}` : null;

    const result = await dbRun(
      `INSERT INTO verification_requests (userId, businessName, businessType, fssaiNumber, gstNumber, description, certificateDetails, documentUrl)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, businessName, businessType, fssaiNumber || null, gstNumber || null, description || null, certificateDetails || null, documentUrl]
    );

    res.status(201).json({ message: 'Verification request submitted', requestId: result.lastID });
  } catch (error) {
    console.error('Submit NGO verification error:', error);
    res.status(500).json({ error: 'Failed to submit verification request' });
  }
});

// GET /api/ngo/verification — get current user's verification status
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
    console.error('Get NGO verification status error:', error);
    res.status(500).json({ error: 'Failed to fetch verification status' });
  }
});

module.exports = router;
