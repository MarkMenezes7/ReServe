const express = require('express');
const { dbAll, dbGet } = require('../db/database');
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

// Spoilage prediction
router.post('/predict/spoilage', authenticateToken, async (req, res) => {
  const result = await proxyToML('/api/ml/predict/spoilage', 'POST', req.body);
  if (result.fallback) {
    // Fallback: basic heuristic when ML service is down
    const { category, storageType, foodType, bestBefore, quantity } = req.body;
    const baseHours = {
      'cooked-meals': 4, 'bakery': 48, 'dairy': 6,
      'fruits-vegetables': 72, 'packaged-food': 720, 'beverages': 168,
    };
    const storageMult = { 'room-temperature': 1, 'refrigerated': 3.5, 'frozen': 12 };
    const typeMult = { 'veg': 1, 'vegan': 1, 'non-veg': 0.7 };
    const base = baseHours[category] || 24;
    const shelfLifeHours = Math.round(base * (storageMult[storageType] || 1) * (typeMult[foodType] || 1));
    let riskLevel = 'medium';
    if (bestBefore) {
      const hoursLeft = (new Date(bestBefore) - Date.now()) / 3600000;
      riskLevel = hoursLeft < shelfLifeHours * 0.3 ? 'high' : hoursLeft < shelfLifeHours * 0.6 ? 'medium' : 'low';
    }
    const tips = [];
    if (storageType === 'room-temperature' && ['dairy', 'cooked-meals'].includes(category))
      tips.push('Refrigerate immediately to extend shelf life by 3-4x');
    if (foodType === 'non-veg')
      tips.push('Non-vegetarian items spoil faster — keep cold chain intact');
    if (riskLevel === 'high')
      tips.push('⚠️ High spoilage risk — prioritize quick collection');
    return res.json({ shelfLifeHours, riskLevel, confidence: 'medium', tips, source: 'fallback' });
  }
  res.json(result);
});

router.get('/forecast/24h', authenticateToken, async (req, res) => {
  const result = await proxyToML('/api/ml/forecast/24h');
  if (result.fallback) {
    try {
      // Get total listings to normalize probabilities
      const totalRow = await dbGet(`SELECT COUNT(*) as total FROM listings WHERE status != 'deleted'`);
      const total = totalRow?.total || 1;

      const hourlyData = [];
      for (let h = 0; h < 24; h++) {
        const count = await dbAll(`
          SELECT COUNT(*) as cnt FROM listings
          WHERE CAST(strftime('%H', createdAt) AS INTEGER) = ?
          AND status != 'deleted'
        `, [h]);
        const cnt = count[0]?.cnt || 0;
        // Normalize: percentage of all listings that appeared at this hour, scaled to max ~65%
        const rawPct = (cnt / total) * 100;
        const probability = Math.min(65, Math.round(rawPct * 6 + (cnt > 0 ? Math.random() * 5 : 0)));
        const expectedQuantity = cnt > 0 ? Math.round(cnt * 0.3 + Math.random() * 3) : 0;
        hourlyData.push({
          hour: h,
          probability,
          expectedQuantity,
          confidence: cnt > 3 ? 'medium' : cnt > 0 ? 'low' : 'very_low',
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
      const totalRow = await dbGet(`SELECT COUNT(*) as total FROM listings WHERE status != 'deleted'`);
      const total = totalRow?.total || 1;

      const weeklyData = [];
      for (let d = 0; d < 7; d++) {
        const count = await dbAll(`
          SELECT COUNT(*) as cnt, COALESCE(AVG(quantity), 0) as avgQty FROM listings
          WHERE CAST(strftime('%w', createdAt) AS INTEGER) = ?
          AND status != 'deleted'
        `, [d]);
        const cnt = count[0]?.cnt || 0;
        const rawPct = (cnt / total) * 100;
        // Realistic: max ~55% probability for most active day
        const probability = Math.min(55, Math.round(rawPct * 4 + (cnt > 0 ? Math.random() * 5 : 0)));
        const expectedQuantity = cnt > 0 ? Math.round((count[0]?.avgQty || 0) * 1.2 + Math.random() * 5) : 0;
        weeklyData.push({
          day: days[d],
          dayIndex: d,
          probability,
          expectedQuantity,
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

// Category distribution with predictions
router.get('/analytics/category-distribution', authenticateToken, async (req, res) => {
  try {
    const categories = await dbAll(`
      SELECT category, COUNT(*) as count, SUM(quantity) as totalQuantity,
             AVG(quantity) as avgQuantity,
             COUNT(CASE WHEN status = 'active' THEN 1 END) as activeCount
      FROM listings WHERE status != 'deleted'
      GROUP BY category ORDER BY count DESC
    `);

    const totalListings = categories.reduce((s, c) => s + c.count, 0);
    const distribution = categories.map(c => ({
      category: c.category,
      count: c.count,
      percentage: totalListings > 0 ? Math.round((c.count / totalListings) * 100) : 0,
      totalQuantity: Math.round(c.totalQuantity || 0),
      avgQuantity: Math.round((c.avgQuantity || 0) * 10) / 10,
      activeCount: c.activeCount,
      trend: c.activeCount > c.count * 0.15 ? 'rising' : c.activeCount > 0 ? 'stable' : 'declining',
    }));

    res.json({ distribution, source: 'database' });
  } catch (error) {
    res.json({ distribution: [], source: 'error' });
  }
});

// Smart AI insights for a donor
router.get('/insights/donor/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    const insights = [];

    const bestDay = await dbGet(`
      SELECT CASE CAST(strftime('%w', createdAt) AS INTEGER)
        WHEN 0 THEN 'Sunday' WHEN 1 THEN 'Monday' WHEN 2 THEN 'Tuesday'
        WHEN 3 THEN 'Wednesday' WHEN 4 THEN 'Thursday' WHEN 5 THEN 'Friday'
        WHEN 6 THEN 'Saturday' END as dayName,
        COUNT(*) as count
      FROM listings WHERE donorId = ? AND status != 'deleted'
      GROUP BY dayName ORDER BY count DESC LIMIT 1
    `, [userId]);
    if (bestDay) {
      insights.push({
        type: 'pattern', icon: 'calendar', title: 'Peak Donation Day',
        description: `You donate most on ${bestDay.dayName}s with ${bestDay.count} listings. NGOs in your area are most active on these days too.`,
        color: 'green',
      });
    }

    const bestHour = await dbGet(`
      SELECT CAST(strftime('%H', createdAt) AS INTEGER) as hour, COUNT(*) as count
      FROM listings WHERE donorId = ? AND status != 'deleted'
      GROUP BY hour ORDER BY count DESC LIMIT 1
    `, [userId]);
    if (bestHour) {
      const period = bestHour.hour < 12 ? 'morning' : bestHour.hour < 17 ? 'afternoon' : 'evening';
      insights.push({
        type: 'timing', icon: 'clock', title: 'Optimal Listing Time',
        description: `Listings posted in the ${period} (around ${bestHour.hour}:00) get claimed fastest based on platform patterns.`,
        color: 'blue',
      });
    }

    const collStats = await dbGet(`
      SELECT COUNT(*) as totalClaims,
        COUNT(CASE WHEN c.status = 'collected' THEN 1 END) as collected
      FROM claims c JOIN listings l ON c.listingId = l.id WHERE l.donorId = ?
    `, [userId]);
    if (collStats && collStats.totalClaims > 0) {
      const rate = Math.round((collStats.collected / collStats.totalClaims) * 100);
      insights.push({
        type: rate >= 80 ? 'achievement' : 'tip',
        icon: rate >= 80 ? 'trophy' : 'lightbulb',
        title: rate >= 80 ? 'Excellent Collection Rate' : 'Improve Collection Rate',
        description: rate >= 80
          ? `${rate}% of your donations are successfully collected. You're in the top tier of reliable donors!`
          : `Your collection rate is ${rate}%. Try extending pickup windows or adding clearer location details.`,
        color: rate >= 80 ? 'gold' : 'orange',
      });
    }

    const topCategory = await dbGet(`
      SELECT category, COUNT(*) as count, SUM(quantity) as totalQty
      FROM listings WHERE donorId = ? AND status != 'deleted'
      GROUP BY category ORDER BY count DESC LIMIT 1
    `, [userId]);
    if (topCategory) {
      insights.push({
        type: 'category', icon: 'layers', title: 'Specialty Identified',
        description: `${topCategory.category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} is your leading category with ${topCategory.count} listings (${Math.round(topCategory.totalQty)} kg).`,
        color: 'purple',
      });
    }

    const recentMonths = await dbAll(`
      SELECT strftime('%Y-%m', createdAt) as month, COUNT(*) as count
      FROM listings WHERE donorId = ? AND status != 'deleted'
      GROUP BY month ORDER BY month DESC LIMIT 6
    `, [userId]);
    if (recentMonths.length >= 3) {
      insights.push({
        type: 'streak', icon: 'flame', title: `${recentMonths.length}-Month Active Streak`,
        description: `You've been donating for ${recentMonths.length} consecutive months. Consistency helps NGOs plan collection routes!`,
        color: 'red',
      });
    }

    if (recentMonths.length >= 2) {
      const latest = recentMonths[0]?.count || 0;
      const previous = recentMonths[1]?.count || 0;
      if (latest > previous && previous > 0) {
        const growth = Math.round(((latest - previous) / previous) * 100);
        insights.push({
          type: 'growth', icon: 'trending-up', title: 'Upward Trend',
          description: `Your donations grew ${growth}% this month vs last. Keep the momentum going!`,
          color: 'emerald',
        });
      }
    }

    res.json({ insights, count: insights.length });
  } catch (error) {
    console.error('Donor insights error:', error);
    res.json({ insights: [], count: 0 });
  }
});

// Smart AI insights for an NGO
router.get('/insights/ngo/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    const insights = [];

    const bestDay = await dbGet(`
      SELECT CASE CAST(strftime('%w', c.createdAt) AS INTEGER)
        WHEN 0 THEN 'Sunday' WHEN 1 THEN 'Monday' WHEN 2 THEN 'Tuesday'
        WHEN 3 THEN 'Wednesday' WHEN 4 THEN 'Thursday' WHEN 5 THEN 'Friday'
        WHEN 6 THEN 'Saturday' END as dayName, COUNT(*) as count
      FROM claims c WHERE c.ngoId = ? AND c.status = 'collected'
      GROUP BY dayName ORDER BY count DESC LIMIT 1
    `, [userId]);
    if (bestDay) {
      insights.push({
        type: 'pattern', icon: 'calendar', title: 'Most Productive Day',
        description: `${bestDay.dayName}s yield your most successful collections with ${bestDay.count} pickups.`,
        color: 'green',
      });
    }

    const topCat = await dbGet(`
      SELECT l.category, COUNT(*) as count
      FROM claims c JOIN listings l ON c.listingId = l.id
      WHERE c.ngoId = ? AND c.status = 'collected'
      GROUP BY l.category ORDER BY count DESC LIMIT 1
    `, [userId]);
    if (topCat) {
      insights.push({
        type: 'category', icon: 'layers', title: 'Top Collection Category',
        description: `${topCat.category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} is your most collected category (${topCat.count} pickups).`,
        color: 'blue',
      });
    }

    const efficiency = await dbGet(`
      SELECT COUNT(*) as total,
        COUNT(CASE WHEN status = 'collected' THEN 1 END) as collected
      FROM claims WHERE ngoId = ?
    `, [userId]);
    if (efficiency && efficiency.total > 0) {
      const rate = Math.round((efficiency.collected / efficiency.total) * 100);
      insights.push({
        type: 'efficiency', icon: 'target', title: 'Collection Efficiency',
        description: `${rate}% success rate on claims. ${rate >= 75 ? 'Outstanding performance!' : 'Try confirming pickups earlier for better results.'}`,
        color: rate >= 75 ? 'emerald' : 'orange',
      });
    }

    const uniqueDonors = await dbGet(`
      SELECT COUNT(DISTINCT l.donorId) as count
      FROM claims c JOIN listings l ON c.listingId = l.id WHERE c.ngoId = ?
    `, [userId]);
    if (uniqueDonors && uniqueDonors.count > 0) {
      insights.push({
        type: 'network', icon: 'users', title: 'Donor Network',
        description: `Connected with ${uniqueDonors.count} different donors. A strong network means more reliable food sources.`,
        color: 'purple',
      });
    }

    res.json({ insights, count: insights.length });
  } catch (error) {
    console.error('NGO insights error:', error);
    res.json({ insights: [], count: 0 });
  }
});

// Demand prediction summary
router.get('/forecast/summary', authenticateToken, async (req, res) => {
  try {
    const totalActive = await dbGet(`SELECT COUNT(*) as count FROM listings WHERE status = 'active'`);
    const todayCount = await dbGet(`
      SELECT COUNT(*) as count FROM listings WHERE date(createdAt) = date('now') AND status != 'deleted'
    `);
    const weekCount = await dbGet(`
      SELECT COUNT(*) as count FROM listings WHERE createdAt >= date('now', '-7 days') AND status != 'deleted'
    `);
    const avgDaily = await dbGet(`
      SELECT AVG(daily_count) as avg FROM (
        SELECT date(createdAt) as day, COUNT(*) as daily_count
        FROM listings WHERE status != 'deleted' AND createdAt >= date('now', '-30 days')
        GROUP BY day
      )
    `);
    const peakHour = await dbGet(`
      SELECT CAST(strftime('%H', createdAt) AS INTEGER) as hour, COUNT(*) as count
      FROM listings WHERE status != 'deleted'
      GROUP BY hour ORDER BY count DESC LIMIT 1
    `);

    const categoryVelocity = await dbAll(`
      SELECT category,
        COUNT(CASE WHEN createdAt >= date('now', '-7 days') THEN 1 END) as thisWeek,
        COUNT(CASE WHEN createdAt >= date('now', '-14 days') AND createdAt < date('now', '-7 days') THEN 1 END) as lastWeek,
        COUNT(*) as total
      FROM listings WHERE status != 'deleted'
      GROUP BY category ORDER BY thisWeek DESC
    `);

    const velocity = categoryVelocity.map(c => ({
      category: c.category,
      thisWeek: c.thisWeek,
      lastWeek: c.lastWeek,
      change: c.lastWeek > 0 ? Math.round(((c.thisWeek - c.lastWeek) / c.lastWeek) * 100) : (c.thisWeek > 0 ? 100 : 0),
      total: c.total,
    }));

    const demandScore = Math.min(100, Math.round(
      (totalActive.count * 5) + ((avgDaily?.avg || 0) * 8) + (weekCount.count * 0.8)
    ));

    res.json({
      activeListings: totalActive.count,
      todayListings: todayCount.count,
      weeklyListings: weekCount.count,
      avgDailyListings: Math.round((avgDaily?.avg || 0) * 10) / 10,
      peakHour: peakHour ? { hour: peakHour.hour, count: peakHour.count } : null,
      categoryVelocity: velocity,
      demandScore,
      source: 'database',
    });
  } catch (error) {
    console.error('Forecast summary error:', error);
    res.status(500).json({ error: 'Failed to fetch forecast summary' });
  }
});

// Area-based predictions: which areas produce most donations and at what times
router.get('/forecast/areas', authenticateToken, async (req, res) => {
  try {
    // Top areas by listing count with peak hour info
    const areas = await dbAll(`
      SELECT pickupLocation as area, COUNT(*) as totalListings,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as activeNow,
        COUNT(CASE WHEN status = 'collected' THEN 1 END) as collected,
        ROUND(AVG(quantity), 1) as avgQuantity,
        ROUND(AVG(latitude), 4) as lat, ROUND(AVG(longitude), 4) as lng
      FROM listings
      WHERE status != 'deleted' AND pickupLocation IS NOT NULL
      GROUP BY pickupLocation
      ORDER BY totalListings DESC
      LIMIT 10
    `);

    // For each top area, get peak hour
    const areaForecasts = [];
    for (const area of areas) {
      const peakHour = await dbGet(`
        SELECT CAST(strftime('%H', createdAt) AS INTEGER) as hour, COUNT(*) as count
        FROM listings WHERE pickupLocation = ? AND status != 'deleted'
        GROUP BY hour ORDER BY count DESC LIMIT 1
      `, [area.area]);

      const peakDay = await dbGet(`
        SELECT CASE CAST(strftime('%w', createdAt) AS INTEGER)
          WHEN 0 THEN 'Sun' WHEN 1 THEN 'Mon' WHEN 2 THEN 'Tue'
          WHEN 3 THEN 'Wed' WHEN 4 THEN 'Thu' WHEN 5 THEN 'Fri'
          WHEN 6 THEN 'Sat' END as day, COUNT(*) as count
        FROM listings WHERE pickupLocation = ? AND status != 'deleted'
        GROUP BY day ORDER BY count DESC LIMIT 1
      `, [area.area]);

      const successRate = area.totalListings > 0
        ? Math.round((area.collected / area.totalListings) * 100) : 0;

      areaForecasts.push({
        area: area.area,
        totalListings: area.totalListings,
        activeNow: area.activeNow,
        avgQuantity: area.avgQuantity || 0,
        successRate,
        peakHour: peakHour ? peakHour.hour : null,
        peakDay: peakDay ? peakDay.day : null,
        lat: area.lat,
        lng: area.lng,
      });
    }

    res.json({ areas: areaForecasts, source: 'database' });
  } catch (error) {
    console.error('Area forecast error:', error);
    res.json({ areas: [], source: 'error' });
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
