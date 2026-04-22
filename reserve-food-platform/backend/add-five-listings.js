/**
 * Add 5 fresh active listings from 5 different donors.
 * Run: node add-five-listings.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'reserve.db'));

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function main() {
  const donors = await all(
    `SELECT id, name, email FROM users
     WHERE userType = 'donor' AND isVerified = 1 AND isActive = 1
     ORDER BY id DESC LIMIT 5`
  );

  if (donors.length < 5) {
    throw new Error('Need at least 5 verified donors.');
  }

  const templates = [
    {
      foodName: 'Veg Pulao Combo',
      category: 'cooked-meals',
      foodType: 'vegetarian',
      quantity: 12,
      unit: 'servings',
      description: 'Freshly prepared veg pulao with raita.',
      pickupLocation: 'Connaught Place, New Delhi',
      latitude: 28.6315,
      longitude: 77.2167,
      storageType: 'refrigerated',
      packagingType: 'container',
      bestBeforeHours: 14,
    },
    {
      foodName: 'Assorted Bakery Pack',
      category: 'bakery',
      foodType: 'vegetarian',
      quantity: 16,
      unit: 'pieces',
      description: 'Surplus bread rolls and muffins from today.',
      pickupLocation: 'Bandra West, Mumbai',
      latitude: 19.0596,
      longitude: 72.8295,
      storageType: 'room-temp',
      packagingType: 'wrapped',
      bestBeforeHours: 30,
    },
    {
      foodName: 'Seasonal Fruit Bundle',
      category: 'fruits-vegetables',
      foodType: 'vegan',
      quantity: 8,
      unit: 'kg',
      description: 'Mixed fruits suitable for same-day distribution.',
      pickupLocation: 'Noida Sector 62',
      latitude: 28.6268,
      longitude: 77.3649,
      storageType: 'refrigerated',
      packagingType: 'boxed',
      bestBeforeHours: 40,
    },
    {
      foodName: 'Rice & Dal Essentials',
      category: 'grains-staples',
      foodType: 'vegan',
      quantity: 10,
      unit: 'kg',
      description: 'Packaged rice and lentils near best-before.',
      pickupLocation: 'Gurgaon Cyber City',
      latitude: 28.494,
      longitude: 77.0887,
      storageType: 'room-temp',
      packagingType: 'sealed-pack',
      bestBeforeHours: 72,
    },
    {
      foodName: 'Milk + Curd Combo',
      category: 'dairy',
      foodType: 'vegetarian',
      quantity: 6,
      unit: 'litres',
      description: 'Milk packets and fresh curd from morning stock.',
      pickupLocation: 'Powai, Mumbai',
      latitude: 19.1176,
      longitude: 72.906,
      storageType: 'refrigerated',
      packagingType: 'sealed-pack',
      bestBeforeHours: 20,
    },
  ];

  const base = new Date('2026-04-01T10:00:00.000Z');
  const created = [];

  for (let i = 0; i < 5; i++) {
    const donor = donors[i];
    const t = templates[i];

    const createdAt = new Date(base);
    createdAt.setHours(10 + i, 5 + i * 9, 0, 0);

    const availableFrom = new Date(createdAt);
    const bestBefore = new Date(createdAt);
    bestBefore.setHours(bestBefore.getHours() + t.bestBeforeHours);

    const r = await run(
      `INSERT INTO listings
      (donorId, foodName, category, foodType, quantity, unit, description, images,
       availableFrom, bestBefore, pickupLocation, latitude, longitude,
       storageType, packagingType, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [
        donor.id,
        t.foodName,
        t.category,
        t.foodType,
        t.quantity,
        t.unit,
        t.description,
        JSON.stringify([]),
        availableFrom.toISOString(),
        bestBefore.toISOString(),
        t.pickupLocation,
        t.latitude,
        t.longitude,
        t.storageType,
        t.packagingType,
        createdAt.toISOString(),
      ]
    );

    created.push({ id: r.lastID, donor: donor.email, food: t.foodName });
  }

  console.log('Added 5 listings from different donors:');
  for (const row of created) {
    console.log(`  #${row.id} | ${row.food} | ${row.donor}`);
  }

  db.close();
}

main().catch((err) => {
  console.error('Failed:', err.message);
  db.close();
  process.exit(1);
});
