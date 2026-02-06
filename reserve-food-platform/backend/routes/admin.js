const express = require('express');
const { db, dbRun, dbGet, dbAll } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);
router.use(requireRole('admin'));

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await dbGet('SELECT COUNT(*) as count FROM users');
    const donors = await dbGet("SELECT COUNT(*) as count FROM users WHERE userType = 'donor'");
    const ngos = await dbGet("SELECT COUNT(*) as count FROM users WHERE userType = 'ngo'");
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
    res.json(listings);
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
    res.json(claims);
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
    res.json(reviews);
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
    res.json(messages);
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

module.exports = router;
