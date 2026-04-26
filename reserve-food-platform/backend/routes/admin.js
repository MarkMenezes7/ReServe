const express = require('express');
const { db, dbRun, dbGet, dbAll } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const RESERVE_CENTER = { lat: 19.1197, lng: 72.8468 }; // Andheri, Mumbai

router.use(authenticateToken);
router.use(requireRole('admin'));

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await dbGet('SELECT COUNT(*) as count FROM users');
    const donors = await dbGet("SELECT COUNT(*) as count FROM users WHERE userType = 'donor'");
    const ngos = await dbGet("SELECT COUNT(*) as count FROM users WHERE userType = 'ngo'");
    const drivers = await dbGet("SELECT COUNT(*) as count FROM users WHERE userType = 'driver'");
    const totalListings = await dbGet('SELECT COUNT(*) as count FROM listings');
    const activeListings = await dbGet("SELECT COUNT(*) as count FROM listings WHERE status = 'active'");
    const totalClaims = await dbGet('SELECT COUNT(*) as count FROM claims');
    const collected = await dbGet("SELECT COUNT(*) as count FROM claims WHERE status = 'collected'");
    const foodSaved = await dbGet("SELECT COALESCE(SUM(l.quantity), 0) as total FROM claims c JOIN listings l ON c.listingId = l.id WHERE c.status = 'collected'");
    const newUsersMonth = await dbGet("SELECT COUNT(*) as count FROM users WHERE createdAt >= date('now', '-30 days')");
    const pendingVerifications = await dbGet('SELECT COUNT(*) as count FROM users WHERE isVerified = 0 AND isActive = 1');

    res.json({
      totalUsers: totalUsers.count,
      donors: donors.count,
      ngos: ngos.count,
      drivers: drivers.count,
      totalListings: totalListings.count,
      activeListings: activeListings.count,
      totalClaims: totalClaims.count,
      collected: collected.count,
      foodSaved: foodSaved.total,
      mealsProvided: Math.floor(foodSaved.total * 2.5),
      co2Saved: Math.floor(foodSaved.total * 2.5),
      newUsersMonth: newUsersMonth.count,
      pendingVerifications: pendingVerifications.count,
      successRate: totalClaims.count > 0 ? Math.round((collected.count / totalClaims.count) * 100) : 0,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/admin/pending-verifications
router.get('/pending-verifications', async (req, res) => {
  try {
    const pending = await dbAll(
      `SELECT id, name, email, userType, organizationName, phone, address, city, state, pincode, createdAt 
       FROM users
       WHERE isVerified = 0 AND isActive = 1 AND userType IN ('donor', 'ngo')
       ORDER BY createdAt DESC`
    );
    res.json(pending);
  } catch (error) {
    console.error('Pending verifications error:', error);
    res.status(500).json({ error: 'Failed to fetch pending verifications' });
  }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const { search, type, verified, page = 1, limit = 20 } = req.query;
    let query = 'SELECT id, name, email, userType, organizationName, phone, city, isVerified, isActive, createdAt FROM users WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (name LIKE ? OR email LIKE ? OR organizationName LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (type && type !== 'all') {
      query += ' AND userType = ?';
      params.push(type);
    }
    if (verified !== undefined && verified !== 'all') {
      query += ' AND isVerified = ?';
      params.push(verified === 'true' ? 1 : 0);
    }

    query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const users = await dbAll(query, params);
    const total = await dbGet('SELECT COUNT(*) as count FROM users');
    res.json({ users, total: total.count });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/admin/drivers
router.get('/drivers', async (req, res) => {
  try {
    const drivers = await dbAll(
      `SELECT
         u.id,
         u.name,
         u.email,
         u.phone,
         u.city,
         u.isVerified,
         u.isActive,
         u.createdAt,
         SUM(CASE WHEN c.deliveryStatus = 'in-transit' THEN 1 ELSE 0 END) as inTransitCount,
         SUM(CASE WHEN c.deliveryStatus = 'assigned' THEN 1 ELSE 0 END) as assignedCount,
         SUM(CASE WHEN c.deliveryStatus = 'delivered' THEN 1 ELSE 0 END) as deliveredCount
       FROM users u
       LEFT JOIN claims c ON c.driverId = u.id AND c.deliveryMethod = 'platform-delivery'
       WHERE u.userType = 'driver'
       GROUP BY u.id
       ORDER BY u.isActive DESC, inTransitCount ASC, u.createdAt DESC`
    );

    res.json(drivers);
  } catch (error) {
    console.error('Drivers fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});

// GET /api/admin/users/:id
router.get('/users/:id', async (req, res) => {
  try {
    const user = await dbGet(
      'SELECT id, name, email, userType, organizationName, phone, address, city, state, pincode, bio, isVerified, isActive, createdAt FROM users WHERE id = ?',
      [req.params.id]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    const stats = await dbGet(`
      SELECT
        (SELECT COUNT(*) FROM listings WHERE donorId = ?) as listingCount,
        (SELECT COUNT(*) FROM claims WHERE ngoId = ?) as claimCount
    `, [req.params.id, req.params.id]);

    res.json({ ...user, ...stats });
  } catch (error) {
    console.error('Admin user detail error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PATCH /api/admin/users/:id/verify
router.patch('/users/:id/verify', async (req, res) => {
  try {
    const user = await dbGet('SELECT isVerified FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await dbRun('UPDATE users SET isVerified = ? WHERE id = ?', [user.isVerified ? 0 : 1, req.params.id]);
    res.json({ message: `User ${user.isVerified ? 'unverified' : 'verified'}` });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Failed to update verification' });
  }
});

// PATCH /api/admin/users/:id/activate
router.patch('/users/:id/activate', async (req, res) => {
  try {
    const user = await dbGet('SELECT isActive FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await dbRun('UPDATE users SET isActive = ? WHERE id = ?', [user.isActive ? 0 : 1, req.params.id]);
    res.json({ message: `User ${user.isActive ? 'deactivated' : 'activated'}` });
  } catch (error) {
    console.error('Activate error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    await dbRun('UPDATE users SET isActive = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'User deactivated' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

// GET /api/admin/listings
router.get('/listings', async (req, res) => {
  try {
    const { search, status, category, page = 1, limit = 20 } = req.query;
    let query = 'SELECT l.*, u.name as donorName, u.organizationName FROM listings l JOIN users u ON l.donorId = u.id WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (l.foodName LIKE ? OR u.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (status && status !== 'all') {
      query += ' AND l.status = ?';
      params.push(status);
    }
    if (category && category !== 'all') {
      query += ' AND l.category = ?';
      params.push(category);
    }

    query += ' ORDER BY l.createdAt DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const listings = await dbAll(query, params);
    const totalResult = await dbGet('SELECT COUNT(*) as count FROM listings');
    res.json({ listings, total: totalResult.count });
  } catch (error) {
    console.error('Admin listings error:', error);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// PATCH /api/admin/listings/:id/status
router.patch('/listings/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    await dbRun('UPDATE listings SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ message: 'Listing status updated' });
  } catch (error) {
    console.error('Update listing status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// DELETE /api/admin/listings/:id
router.delete('/listings/:id', async (req, res) => {
  try {
    await dbRun("UPDATE listings SET status = 'removed' WHERE id = ?", [req.params.id]);
    res.json({ message: 'Listing removed' });
  } catch (error) {
    console.error('Remove listing error:', error);
    res.status(500).json({ error: 'Failed to remove listing' });
  }
});

// GET /api/admin/claims
router.get('/claims', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    let query = `
      SELECT c.*, l.foodName, l.category, l.quantity as listingQuantity, l.unit,
        u_ngo.name as ngoName, u_ngo.organizationName as ngoOrg,
        u_donor.name as donorName, u_donor.organizationName as donorOrg
      FROM claims c
      JOIN listings l ON c.listingId = l.id
      JOIN users u_ngo ON c.ngoId = u_ngo.id
      JOIN users u_donor ON l.donorId = u_donor.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      query += ' AND c.status = ?';
      params.push(status);
    }

    query += ' ORDER BY c.createdAt DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const claims = await dbAll(query, params);
    const totalResult = await dbGet('SELECT COUNT(*) as count FROM claims');
    res.json({ claims, total: totalResult.count });
  } catch (error) {
    console.error('Admin claims error:', error);
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
});

// GET /api/admin/claims/analytics
router.get('/claims/analytics', async (req, res) => {
  try {
    const byStatus = await dbAll('SELECT status, COUNT(*) as count FROM claims GROUP BY status');
    const byMonth = await dbAll(`
      SELECT strftime('%Y-%m', createdAt) as month, COUNT(*) as count
      FROM claims GROUP BY month ORDER BY month DESC LIMIT 12
    `);
    const byCategory = await dbAll(`
      SELECT l.category, COUNT(*) as count
      FROM claims c JOIN listings l ON c.listingId = l.id
      GROUP BY l.category ORDER BY count DESC
    `);

    res.json({ byStatus, byMonth, byCategory });
  } catch (error) {
    console.error('Claims analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/admin/reviews
router.get('/reviews', async (req, res) => {
  try {
    const reviews = await dbAll(`
      SELECT r.*, u_reviewer.name as reviewerName, u_reviewee.name as revieweeName,
             l.foodName
      FROM reviews r
      JOIN users u_reviewer ON r.reviewerId = u_reviewer.id
      JOIN users u_reviewee ON r.revieweeId = u_reviewee.id
      JOIN claims c ON r.claimId = c.id
      JOIN listings l ON c.listingId = l.id
      ORDER BY r.createdAt DESC LIMIT 100
    `);
    res.json({ reviews, total: reviews.length });
  } catch (error) {
    console.error('Admin reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// DELETE /api/admin/reviews/:id
router.delete('/reviews/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM reviews WHERE id = ?', [req.params.id]);
    res.json({ message: 'Review removed' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ error: 'Failed to remove review' });
  }
});

// GET /api/admin/contact-messages
router.get('/contact-messages', async (req, res) => {
  try {
    const messages = await dbAll('SELECT * FROM contact_messages ORDER BY createdAt DESC');
    const totalResult = await dbGet('SELECT COUNT(*) as count FROM contact_messages');
    res.json({ messages, total: totalResult.count });
  } catch (error) {
    console.error('Contact messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// PATCH /api/admin/contact-messages/:id
router.patch('/contact-messages/:id', async (req, res) => {
  try {
    const { status } = req.body;
    await dbRun('UPDATE contact_messages SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ message: 'Status updated' });
  } catch (error) {
    console.error('Update contact message error:', error);
    res.status(500).json({ error: 'Failed to update' });
  }
});

// GET /api/admin/reports/summary
router.get('/reports/summary', async (req, res) => {
  try {
    const userGrowth = await dbAll(`
      SELECT strftime('%Y-%m', createdAt) as month, userType, COUNT(*) as count
      FROM users GROUP BY month, userType ORDER BY month DESC LIMIT 24
    `);
    const listingTrends = await dbAll(`
      SELECT strftime('%Y-%m', createdAt) as month, status, COUNT(*) as count
      FROM listings GROUP BY month, status ORDER BY month DESC LIMIT 24
    `);
    const foodByCategory = await dbAll(`
      SELECT category, SUM(quantity) as total FROM listings GROUP BY category ORDER BY total DESC
    `);

    res.json({ userGrowth, listingTrends, foodByCategory });
  } catch (error) {
    console.error('Reports error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// GET /api/admin/reports/impact
router.get('/reports/impact', async (req, res) => {
  try {
    const totalFood = await dbGet("SELECT COALESCE(SUM(l.quantity), 0) as total FROM claims c JOIN listings l ON c.listingId = l.id WHERE c.status = 'collected'");
    const totalCollections = await dbGet("SELECT COUNT(*) as count FROM claims WHERE status = 'collected'");
    const activeDonors = await dbGet('SELECT COUNT(DISTINCT donorId) as count FROM listings');
    const activeNGOs = await dbGet('SELECT COUNT(DISTINCT ngoId) as count FROM claims');
    const monthlyImpact = await dbAll(`
      SELECT strftime('%Y-%m', c.collectedAt) as month, SUM(l.quantity) as foodSaved, COUNT(*) as collections
      FROM claims c JOIN listings l ON c.listingId = l.id
      WHERE c.status = 'collected'
      GROUP BY month ORDER BY month DESC LIMIT 12
    `);

    const total = totalFood.total;
    res.json({
      totalFoodSaved: total,
      totalMeals: Math.floor(total * 2.5),
      totalCO2Saved: Math.floor(total * 2.5),
      totalWaterSaved: Math.floor(total * 100),
      totalCollections: totalCollections.count,
      activeDonors: activeDonors.count,
      activeNGOs: activeNGOs.count,
      monthlyImpact,
    });
  } catch (error) {
    console.error('Impact report error:', error);
    res.status(500).json({ error: 'Failed to generate impact report' });
  }
});

// ===================== DELIVERY MANAGEMENT =====================

// GET /api/admin/deliveries - all platform delivery claims
router.get('/deliveries', async (req, res) => {
  try {
    const { status } = req.query;
    let where = "WHERE c.deliveryMethod = 'platform-delivery'";
    if (status && status !== 'all') where += ` AND c.deliveryStatus = '${status}'`;

    const deliveries = await dbAll(`
          SELECT c.id, c.listingId, c.ngoId, c.status as claimStatus, c.deliveryMethod, c.deliveryFee,
            c.deliveryDistance, c.deliveryStatus, c.scheduledTime, c.createdAt,
            c.paymentUpiId, c.paymentTransactionId, c.paymentScreenshotUrl, c.paymentStatus,
            c.paymentVerifiedBy, c.paymentVerifiedAt, c.paymentRejectReason,
            c.ngoLatitude, c.ngoLongitude,
            c.driverId, c.driverCurrentLat, c.driverCurrentLng, c.driverRouteProgress, c.driverRouteStage,
            c.dispatchedAt, c.deliveredAt,
             l.foodName, l.quantity, l.unit, l.pickupLocation, l.latitude as pickupLat, l.longitude as pickupLng,
             l.category, l.storageType,
             donor.name as donorName, donor.organizationName as donorOrg, donor.phone as donorPhone,
            ngo.name as ngoName, ngo.organizationName as ngoOrg, ngo.phone as ngoPhone,
            driver.name as driverName, driver.phone as driverPhone,
            COALESCE(c.ngoLatitude, ngo.latitude) as dropLat,
            COALESCE(c.ngoLongitude, ngo.longitude) as dropLng,
            COALESCE(ngo.address, ngo.city, 'NGO Location') as dropLocation
      FROM claims c
      JOIN listings l ON c.listingId = l.id
      JOIN users donor ON l.donorId = donor.id
      JOIN users ngo ON c.ngoId = ngo.id
          LEFT JOIN users driver ON c.driverId = driver.id
      ${where}
      ORDER BY c.createdAt DESC
    `);
    res.json(deliveries);
  } catch (error) {
    console.error('Deliveries fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch deliveries' });
  }
});

// GET /api/admin/delivery-stats
router.get('/delivery-stats', async (req, res) => {
  try {
    const total = await dbGet("SELECT COUNT(*) as count FROM claims WHERE deliveryMethod = 'platform-delivery'");
    const paymentPendingVerification = await dbGet("SELECT COUNT(*) as count FROM claims WHERE deliveryMethod = 'platform-delivery' AND paymentStatus = 'pending-verification'");
    const pending = await dbGet("SELECT COUNT(*) as count FROM claims WHERE deliveryMethod = 'platform-delivery' AND deliveryStatus = 'pending'");
    const inTransit = await dbGet("SELECT COUNT(*) as count FROM claims WHERE deliveryMethod = 'platform-delivery' AND deliveryStatus = 'in-transit'");
    const delivered = await dbGet("SELECT COUNT(*) as count FROM claims WHERE deliveryMethod = 'platform-delivery' AND deliveryStatus = 'delivered'");
    const totalRevenue = await dbGet("SELECT COALESCE(SUM(deliveryFee), 0) as total FROM claims WHERE deliveryMethod = 'platform-delivery'");
    const avgDistance = await dbGet("SELECT COALESCE(AVG(deliveryDistance), 0) as avg FROM claims WHERE deliveryMethod = 'platform-delivery' AND deliveryDistance > 0");

    res.json({
      total: total.count,
      paymentPendingVerification: paymentPendingVerification.count,
      pending: pending.count,
      inTransit: inTransit.count,
      delivered: delivered.count,
      totalRevenue: totalRevenue.total,
      avgDistance: Math.round((avgDistance.avg || 0) * 10) / 10,
    });
  } catch (error) {
    console.error('Delivery stats error:', error);
    res.status(500).json({ error: 'Failed to fetch delivery stats' });
  }
});

// GET /api/admin/delivery-tracking - map feed for all platform deliveries
router.get('/delivery-tracking', async (req, res) => {
  try {
    const tracking = await dbAll(`
      SELECT c.id, c.listingId, c.ngoId, c.status as claimStatus, c.deliveryMethod, c.deliveryFee,
             c.deliveryDistance, c.deliveryStatus, c.scheduledTime, c.createdAt,
             c.paymentStatus,
              c.driverId, c.driverCurrentLat, c.driverCurrentLng, c.driverRouteProgress, c.driverRouteStage,
             c.dispatchedAt, c.deliveredAt,
             l.foodName, l.quantity, l.unit, l.pickupLocation, l.latitude as pickupLat, l.longitude as pickupLng,
             donor.id as donorId, donor.name as donorName, donor.organizationName as donorOrg,
             ngo.name as ngoName, ngo.organizationName as ngoOrg,
             driver.name as driverName, driver.phone as driverPhone,
             COALESCE(c.ngoLatitude, ngo.latitude) as dropLat,
             COALESCE(c.ngoLongitude, ngo.longitude) as dropLng,
             COALESCE(ngo.address, ngo.city, 'NGO Location') as dropLocation
      FROM claims c
      JOIN listings l ON c.listingId = l.id
      JOIN users donor ON l.donorId = donor.id
      JOIN users ngo ON c.ngoId = ngo.id
      LEFT JOIN users driver ON c.driverId = driver.id
      WHERE c.deliveryMethod = 'platform-delivery'
        AND COALESCE(c.paymentStatus, 'verified') IN ('verified', 'not-required')
      ORDER BY c.createdAt DESC
    `);

    res.json(tracking);
  } catch (error) {
    console.error('Delivery tracking fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch delivery tracking data' });
  }
});

// PATCH /api/admin/deliveries/:claimId/dispatch - assign driver, wait for driver claim
router.patch('/deliveries/:claimId/dispatch', async (req, res) => {
  try {
    const { claimId } = req.params;
    const { driverId } = req.body;

    if (!driverId) {
      return res.status(400).json({ error: 'driverId is required' });
    }

    const driver = await dbGet(
      "SELECT id, name, isActive FROM users WHERE id = ? AND userType = 'driver'",
      [driverId]
    );
    if (!driver || !driver.isActive) {
      return res.status(400).json({ error: 'Driver not available' });
    }

    const claim = await dbGet(
      `SELECT c.*, l.foodName, l.id as listingId, l.donorId, l.latitude as pickupLat, l.longitude as pickupLng
       FROM claims c
       JOIN listings l ON c.listingId = l.id
       WHERE c.id = ?`,
      [claimId]
    );

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (claim.deliveryMethod !== 'platform-delivery') {
      return res.status(400).json({ error: 'Only platform-delivery claims can be dispatched' });
    }

    if (!['verified', 'not-required', null].includes(claim.paymentStatus ?? null)) {
      return res.status(400).json({ error: 'Payment must be verified before dispatch' });
    }

    if (claim.deliveryStatus === 'delivered') {
      return res.status(400).json({ error: 'Delivery already completed' });
    }

    if (claim.deliveryStatus === 'in-transit') {
      return res.status(400).json({ error: 'Delivery already in transit' });
    }

    if (claim.deliveryStatus === 'payment-pending') {
      return res.status(400).json({ error: 'Payment verification is pending' });
    }

    const centerLat = Number(RESERVE_CENTER.lat.toFixed(6));
    const centerLng = Number(RESERVE_CENTER.lng.toFixed(6));

    await dbRun(
      `UPDATE claims
       SET driverId = ?,
           deliveryStatus = 'assigned',
           dispatchedAt = NULL,
           driverCurrentLat = ?,
           driverCurrentLng = ?,
           driverRouteProgress = 0,
           driverRouteStage = 'ready-at-center'
       WHERE id = ?`,
      [driverId, centerLat, centerLng, claimId]
    );

    const io = req.app.get('io');
    io.to('admins').emit('deliveryStatusUpdate', {
      claimId: Number(claimId),
      deliveryStatus: 'assigned',
      driverRouteStage: 'ready-at-center',
      driverId: Number(driverId),
      driverName: driver.name,
    });

    io.to(`user_${claim.donorId}`).emit('deliveryStatusUpdate', {
      claimId: Number(claimId),
      deliveryStatus: 'assigned',
      driverRouteStage: 'ready-at-center',
      driverId: Number(driverId),
      driverName: driver.name,
    });

    io.to(`user_${claim.ngoId}`).emit('deliveryStatusUpdate', {
      claimId: Number(claimId),
      deliveryStatus: 'assigned',
      driverRouteStage: 'ready-at-center',
      driverId: Number(driverId),
      driverName: driver.name,
    });

    io.to(`user_${driverId}`).emit('deliveryStatusUpdate', {
      claimId: Number(claimId),
      deliveryStatus: 'assigned',
      driverRouteStage: 'ready-at-center',
      driverId: Number(driverId),
      driverName: driver.name,
    });

    try {
      const { createNotification } = require('../utils/notifications');
      await createNotification(io, {
        userId: claim.ngoId,
        type: 'delivery_update',
        title: 'Driver Assigned',
        message: `Driver ${driver.name} was assigned for "${claim.foodName}" and will start after claiming the delivery`,
        relatedId: Number(claimId),
        relatedType: 'claim',
      });
      await createNotification(io, {
        userId: claim.donorId,
        type: 'delivery_update',
        title: 'Delivery Assigned',
        message: `Driver ${driver.name} has been assigned for "${claim.foodName}"`,
        relatedId: Number(claimId),
        relatedType: 'claim',
      });
      await createNotification(io, {
        userId: Number(driverId),
        type: 'delivery_assigned',
        title: 'New Delivery Assigned',
        message: `You were assigned "${claim.foodName}". Open Driver Dashboard and click Claim Delivery to start.`,
        relatedId: Number(claimId),
        relatedType: 'claim',
      });
    } catch (err) {
      // Non-critical notification failure
    }

    res.json({ message: 'Driver assigned successfully. Waiting for driver to claim delivery.' });
  } catch (error) {
    console.error('Dispatch error:', error);
    res.status(500).json({ error: 'Failed to dispatch driver' });
  }
});

// PATCH /api/admin/deliveries/:claimId/payment-review - verify/reject NGO payment proof
router.patch('/deliveries/:claimId/payment-review', async (req, res) => {
  try {
    const { claimId } = req.params;
    const { action, adminNotes } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Use approve or reject.' });
    }

    const claim = await dbGet(
      `SELECT c.*, l.foodName, l.donorId
       FROM claims c
       JOIN listings l ON c.listingId = l.id
       WHERE c.id = ?`,
      [claimId]
    );

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (claim.deliveryMethod !== 'platform-delivery') {
      return res.status(400).json({ error: 'Payment review is only for platform-delivery claims' });
    }

    if (claim.paymentStatus !== 'pending-verification') {
      return res.status(400).json({ error: 'Payment is not pending verification' });
    }

    const approved = action === 'approve';
    const nextPaymentStatus = approved ? 'verified' : 'rejected';
    const nextDeliveryStatus = approved ? 'pending' : 'payment-rejected';

    await dbRun(
      `UPDATE claims
       SET paymentStatus = ?,
           paymentVerifiedBy = ?,
           paymentVerifiedAt = datetime('now'),
           paymentRejectReason = ?,
           deliveryStatus = ?
       WHERE id = ?`,
      [
        nextPaymentStatus,
        req.user.userId,
        approved ? null : (adminNotes || 'Payment proof rejected'),
        nextDeliveryStatus,
        claimId,
      ]
    );

    const io = req.app.get('io');

    try {
      const { createNotification } = require('../utils/notifications');
      await createNotification(io, {
        userId: claim.ngoId,
        type: approved ? 'payment_verified' : 'payment_rejected',
        title: approved ? 'Payment Verified' : 'Payment Rejected',
        message: approved
          ? `Payment verified for "${claim.foodName}". Your delivery is ready for dispatch.`
          : `Payment proof rejected for "${claim.foodName}". ${adminNotes || 'Please contact support/admin.'}`,
        relatedId: Number(claimId),
        relatedType: 'claim',
      });

      await createNotification(io, {
        userId: claim.donorId,
        type: 'delivery_update',
        title: approved ? 'Delivery Ready for Dispatch' : 'Delivery Payment Rejected',
        message: approved
          ? `Payment verified for "${claim.foodName}" and dispatch will start soon.`
          : `Payment rejected for "${claim.foodName}". Dispatch is blocked until resolved.`,
        relatedId: Number(claimId),
        relatedType: 'claim',
      });
    } catch (e) {
      // Non-critical notification failures
    }

    io.to('admins').emit('deliveryPaymentUpdate', {
      claimId: Number(claimId),
      paymentStatus: nextPaymentStatus,
      deliveryStatus: nextDeliveryStatus,
    });
    io.to(`user_${claim.ngoId}`).emit('deliveryPaymentUpdate', {
      claimId: Number(claimId),
      paymentStatus: nextPaymentStatus,
      deliveryStatus: nextDeliveryStatus,
    });

    res.json({
      message: approved
        ? 'Payment verified successfully. Delivery is ready for dispatch.'
        : 'Payment rejected successfully.',
      paymentStatus: nextPaymentStatus,
      deliveryStatus: nextDeliveryStatus,
    });
  } catch (error) {
    console.error('Payment review error:', error);
    res.status(500).json({ error: 'Failed to review payment proof' });
  }
});

// PATCH /api/admin/deliveries/:claimId/status - update delivery status
router.patch('/deliveries/:claimId/status', async (req, res) => {
  try {
    const { claimId } = req.params;
    const { deliveryStatus } = req.body;

    if (!['pending', 'assigned', 'in-transit', 'delivered', 'failed'].includes(deliveryStatus)) {
      return res.status(400).json({ error: 'Invalid delivery status' });
    }

    if (deliveryStatus === 'in-transit') {
      return res.status(400).json({ error: 'In-transit starts when driver claims delivery' });
    }

    const claim = await dbGet(`
      SELECT c.*, l.foodName FROM claims c JOIN listings l ON c.listingId = l.id WHERE c.id = ?
    `, [claimId]);

    if (!claim) return res.status(404).json({ error: 'Claim not found' });

    await dbRun(
      `UPDATE claims
       SET deliveryStatus = ?,
           deliveredAt = CASE WHEN ? = 'delivered' THEN datetime('now') ELSE deliveredAt END,
           driverRouteProgress = CASE WHEN ? = 'delivered' THEN 1 ELSE driverRouteProgress END,
           driverRouteStage = CASE WHEN ? = 'delivered' THEN 'completed' ELSE driverRouteStage END
       WHERE id = ?`,
      [deliveryStatus, deliveryStatus, deliveryStatus, deliveryStatus, claimId]
    );

    // If delivered, also mark claim as collected
    if (deliveryStatus === 'delivered') {
      await dbRun("UPDATE claims SET status = 'collected', collectedAt = datetime('now') WHERE id = ?", [claimId]);
      await dbRun("UPDATE listings SET status = 'collected' WHERE id = ?", [claim.listingId]);
    }

    // Notify NGO
    const { createNotification } = require('../utils/notifications');
    const io = req.app.get('io');
    const statusMessages = {
      'assigned': 'A delivery partner has been assigned',
      'in-transit': 'Your food is on the way!',
      'delivered': 'Food has been delivered successfully',
      'failed': 'Delivery failed — please contact support',
    };
    if (statusMessages[deliveryStatus]) {
      try {
        await createNotification(io, {
          userId: claim.ngoId,
          type: 'delivery_update',
          title: `Delivery ${deliveryStatus.replace('-', ' ')}`,
          message: `${statusMessages[deliveryStatus]} for "${claim.foodName}"`,
          relatedId: parseInt(claimId),
          relatedType: 'claim',
        });
      } catch (e) { /* non-critical */ }
    }

    io.to('admins').emit('deliveryStatusUpdate', { claimId: Number(claimId), deliveryStatus });
    io.to(`user_${claim.ngoId}`).emit('deliveryStatusUpdate', { claimId: Number(claimId), deliveryStatus });
    if (claim.driverId) {
      io.to(`user_${claim.driverId}`).emit('deliveryStatusUpdate', { claimId: Number(claimId), deliveryStatus });
    }

    res.json({ message: `Delivery status updated to ${deliveryStatus}` });
  } catch (error) {
    console.error('Delivery status update error:', error);
    res.status(500).json({ error: 'Failed to update delivery status' });
  }
});

// ===================== VERIFICATION REQUESTS =====================

// GET /api/admin/verification-requests — list submitted verification requests
router.get('/verification-requests', async (req, res) => {
  try {
    const { status = 'pending' } = req.query;
    let query = `
      SELECT vr.*, u.name, u.email, u.userType, u.organizationName, u.phone, u.city, u.createdAt as userCreatedAt
      FROM verification_requests vr
      JOIN users u ON vr.userId = u.id
    `;
    const params = [];
    if (status !== 'all') {
      query += ' WHERE vr.status = ?';
      params.push(status);
    }
    query += ' ORDER BY vr.submittedAt DESC';
    const requests = await dbAll(query, params);
    res.json(requests);
  } catch (error) {
    console.error('Verification requests error:', error);
    res.status(500).json({ error: 'Failed to fetch verification requests' });
  }
});

// PATCH /api/admin/verification-requests/:id/review — approve or reject
router.patch('/verification-requests/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, adminNotes } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Use approve or reject.' });
    }

    const request = await dbGet('SELECT * FROM verification_requests WHERE id = ?', [id]);
    if (!request) return res.status(404).json({ error: 'Verification request not found' });

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    await dbRun(
      'UPDATE verification_requests SET status = ?, adminNotes = ?, reviewedBy = ?, reviewedAt = CURRENT_TIMESTAMP WHERE id = ?',
      [newStatus, adminNotes || null, req.user.userId, id]
    );

    // If approved, set user as verified
    if (action === 'approve') {
      await dbRun('UPDATE users SET isVerified = 1 WHERE id = ?', [request.userId]);
    }

    // Notify user
    try {
      const { createNotification } = require('../utils/notifications');
      const io = req.app.get('io');
      await createNotification(io, {
        userId: request.userId,
        type: 'verification_update',
        title: action === 'approve' ? 'Account Verified!' : 'Verification Request Update',
        message: action === 'approve'
          ? 'Your account has been verified. You can now create food listings!'
          : `Your verification request was not approved. ${adminNotes || 'Please update your details and try again.'}`,
        relatedId: parseInt(id),
        relatedType: 'verification',
      });
    } catch (e) { /* non-critical */ }

    res.json({ message: `Verification request ${newStatus}` });
  } catch (error) {
    console.error('Review verification error:', error);
    res.status(500).json({ error: 'Failed to review verification request' });
  }
});

module.exports = router;
