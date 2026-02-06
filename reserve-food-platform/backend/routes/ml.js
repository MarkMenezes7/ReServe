const express = require('express');
const { dbAll } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { ML_SERVICE_URL } = require('../config');

const router = express.Router();

// ML Proxy - forward requests to Python Flask service
async function proxyToML(path, method = 'GET', body = null) {
  try {
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) options.body = JSON.stringify(body);
    const response = await fetch(`${ML_SERVICE_URL}${path}`, options);
    return await response.json();
  } catch (error) {
    return { error: 'ML service unavailable', fallback: true };
  }
}

// ML Proxy routes
router.post('/predict/availability', authenticateToken, async (req, res) => {
  const result = await proxyToML('/api/ml/predict/availability', 'POST', req.body);
  res.json(result);
});

router.post('/predict/quantity', authenticateToken, async (req, res) => {
  const result = await proxyToML('/api/ml/predict/quantity', 'POST', req.body);
  res.json(result);
});

router.post('/predict/category', authenticateToken, async (req, res) => {
  const result = await proxyToML('/api/ml/predict/category', 'POST', req.body);
  res.json(result);
});

router.get('/forecast/24h', authenticateToken, async (req, res) => {
  const result = await proxyToML('/api/ml/forecast/24h');
  if (result.fallback) {
    // Generate simple forecast from existing data
    try {
      const hourlyData = [];
      for (let h = 0; h < 24; h++) {
        const count = await dbAll(`
          SELECT COUNT(*) as cnt FROM listings
          WHERE CAST(strftime('%H', createdAt) AS INTEGER) = ?
          AND status != 'deleted'
        `, [h]);
        hourlyData.push({
          hour: h,
          probability: Math.min(100, Math.round((count[0]?.cnt || 0) * 15 + Math.random() * 20)),
          expectedQuantity: Math.round((count[0]?.cnt || 0) * 5 + Math.random() * 10),
          confidence: count[0]?.cnt > 0 ? 'medium' : 'low',
        });
      }
      return res.json({ forecast: hourlyData, source: 'fallback' });
    } catch (e) {
      return res.json({ forecast: [], source: 'fallback' });
    }
  }
  res.json(result);
});

router.get('/forecast/weekly', authenticateToken, async (req, res) => {
  const result = await proxyToML('/api/ml/forecast/weekly');
  if (result.fallback) {
    try {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const weeklyData = [];
      for (let d = 0; d < 7; d++) {
        const count = await dbAll(`
          SELECT COUNT(*) as cnt FROM listings
          WHERE CAST(strftime('%w', createdAt) AS INTEGER) = ?
          AND status != 'deleted'
        `, [d]);
        weeklyData.push({
          day: days[d],
          dayIndex: d,
          probability: Math.min(100, Math.round((count[0]?.cnt || 0) * 12 + Math.random() * 25)),
          expectedQuantity: Math.round((count[0]?.cnt || 0) * 8 + Math.random() * 15),
        });
      }
      return res.json({ forecast: weeklyData, source: 'fallback' });
    } catch (e) {
      return res.json({ forecast: [], source: 'fallback' });
    }
  }
  res.json(result);
});

router.get('/forecast/donor/:donorId', authenticateToken, async (req, res) => {
  const result = await proxyToML(`/api/ml/forecast/donor/${req.params.donorId}`);
  if (result.fallback) {
    try {
      const patterns = await dbAll(`
        SELECT strftime('%w', createdAt) as dayOfWeek, strftime('%H', createdAt) as hour,
               COUNT(*) as count, AVG(quantity) as avgQuantity, category
        FROM listings WHERE donorId = ? GROUP BY dayOfWeek, hour
        ORDER BY count DESC
      `, [req.params.donorId]);
      return res.json({ patterns, source: 'fallback' });
    } catch (e) {
      return res.json({ patterns: [], source: 'fallback' });
    }
  }
  res.json(result);
});

router.get('/analytics/donor-patterns', authenticateToken, async (req, res) => {
  const result = await proxyToML('/api/ml/analytics/donor-patterns');
  if (result.fallback) {
    try {
      const donors = await dbAll(`
        SELECT u.id, u.name, u.organizationName,
               COUNT(l.id) as donationCount,
               AVG(l.quantity) as avgQuantity,
               GROUP_CONCAT(DISTINCT strftime('%w', l.createdAt)) as typicalDays,
               MAX(l.createdAt) as lastDonation
        FROM users u JOIN listings l ON l.donorId = u.id
        WHERE u.userType = 'donor'
        GROUP BY u.id ORDER BY donationCount DESC LIMIT 20
      `);
      return res.json({ donors, source: 'fallback' });
    } catch (e) {
      return res.json({ donors: [], source: 'fallback' });
    }
  }
  res.json(result);
});

router.get('/analytics/peak-hours', authenticateToken, async (req, res) => {
  try {
    const hours = await dbAll(`
      SELECT CAST(strftime('%H', createdAt) AS INTEGER) as hour, COUNT(*) as count
      FROM listings WHERE status != 'deleted'
      GROUP BY hour ORDER BY hour
    `);
    res.json({ hours, source: 'database' });
  } catch (error) {
    res.json({ hours: [], source: 'error' });
  }
});

router.get('/analytics/category-trends', authenticateToken, async (req, res) => {
  try {
    const trends = await dbAll(`
      SELECT category, strftime('%Y-%m', createdAt) as month, COUNT(*) as count, SUM(quantity) as totalQuantity
      FROM listings WHERE status != 'deleted'
      GROUP BY category, month ORDER BY month DESC, count DESC
    `);
    res.json({ trends, source: 'database' });
  } catch (error) {
    res.json({ trends: [], source: 'error' });
  }
});

router.get('/health', async (req, res) => {
  const result = await proxyToML('/api/ml/health');
  res.json(result.fallback ? { status: 'ml_service_offline', backend: 'ok' } : result);
});

// Heatmap data endpoints
router.get('/maps/heatmap/density', async (req, res) => {
  try {
    const points = await dbAll(`
      SELECT latitude, longitude, quantity FROM listings
      WHERE status = 'active' AND latitude IS NOT NULL AND longitude IS NOT NULL
    `);
    res.json(points.map(p => [p.latitude, p.longitude, p.quantity || 1]));
  } catch (error) {
    res.json([]);
  }
});

router.get('/maps/heatmap/historical', async (req, res) => {
  try {
    const points = await dbAll(`
      SELECT l.latitude, l.longitude, COUNT(*) as intensity
      FROM claims c JOIN listings l ON c.listingId = l.id
      WHERE c.status = 'collected' AND l.latitude IS NOT NULL AND l.longitude IS NOT NULL
      GROUP BY ROUND(l.latitude, 2), ROUND(l.longitude, 2)
    `);
    res.json(points.map(p => [p.latitude, p.longitude, p.intensity]));
  } catch (error) {
    res.json([]);
  }
});

router.get('/maps/heatmap/supply-demand', async (req, res) => {
  try {
    const supply = await dbAll(`
      SELECT ROUND(latitude, 2) as lat, ROUND(longitude, 2) as lng, COUNT(*) as count
      FROM listings WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND status = 'active'
      GROUP BY lat, lng
    `);
    const demand = await dbAll(`
      SELECT ROUND(u.latitude, 2) as lat, ROUND(u.longitude, 2) as lng, COUNT(*) as count
      FROM users u WHERE u.userType = 'ngo' AND u.latitude IS NOT NULL
      GROUP BY lat, lng
    `);
    res.json({ supply, demand });
  } catch (error) {
    res.json({ supply: [], demand: [] });
  }
});

router.get('/maps/heatmap/temporal/:hour', async (req, res) => {
  try {
    const hour = parseInt(req.params.hour);
    const points = await dbAll(`
      SELECT latitude, longitude, COUNT(*) as intensity
      FROM listings
      WHERE CAST(strftime('%H', createdAt) AS INTEGER) = ?
        AND latitude IS NOT NULL AND longitude IS NOT NULL
      GROUP BY ROUND(latitude, 2), ROUND(longitude, 2)
    `, [hour]);
    res.json(points.map(p => [p.latitude, p.longitude, p.intensity]));
  } catch (error) {
    res.json([]);
  }
});

module.exports = router;
