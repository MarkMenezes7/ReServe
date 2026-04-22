/**
 * Adds fresh demo data for today's date with mixed claim delivery methods.
 * Run: node add-todays-demo-data.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'reserve.db');
const db = new sqlite3.Database(DB_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function toIso(d) {
  return new Date(d).toISOString();
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function ensureUsers() {
  const donorRows = await all(
    `SELECT id, email, name, address, city FROM users
     WHERE userType = 'donor' AND isVerified = 1 AND isActive = 1
     ORDER BY id DESC LIMIT 8`
  );

  const ngoRows = await all(
    `SELECT id, email, name, address, city, latitude, longitude FROM users
     WHERE userType = 'ngo' AND isVerified = 1 AND isActive = 1
     ORDER BY id DESC LIMIT 4`
  );

  if (donorRows.length < 3) {
    throw new Error('Not enough verified donors found. Please run seed/add-donors first.');
  }
  if (ngoRows.length < 2) {
    throw new Error('Not enough verified NGOs found. Please run seed first.');
  }

  return { donors: donorRows, ngos: ngoRows };
}

async function addListings(donors) {
  // Today's demo date: April 1, 2026
  const base = new Date('2026-04-01T09:00:00.000Z');

  const templates = [
    { foodName: 'Fresh Veg Thali', category: 'cooked-meals', foodType: 'vegetarian', quantity: 14, unit: 'servings', storageType: 'refrigerated', packagingType: 'container', pickupLocation: 'Connaught Place, New Delhi', latitude: 28.6315, longitude: 77.2167, bestBeforeHours: 10 },
    { foodName: 'Bread & Bun Combo', category: 'bakery', foodType: 'vegetarian', quantity: 18, unit: 'pieces', storageType: 'room-temp', packagingType: 'wrapped', pickupLocation: 'Bandra West, Mumbai', latitude: 19.0596, longitude: 72.8295, bestBeforeHours: 36 },
    { foodName: 'Seasonal Fruits Box', category: 'fruits-vegetables', foodType: 'vegan', quantity: 7, unit: 'kg', storageType: 'refrigerated', packagingType: 'boxed', pickupLocation: 'Noida Sector 18', latitude: 28.5706, longitude: 77.3260, bestBeforeHours: 48 },
    { foodName: 'Rice & Dal Packets', category: 'grains-staples', foodType: 'vegan', quantity: 10, unit: 'packets', storageType: 'room-temp', packagingType: 'sealed-pack', pickupLocation: 'Gurgaon Sector 29', latitude: 28.4595, longitude: 77.0266, bestBeforeHours: 72 },
    { foodName: 'Milk and Curd Combo', category: 'dairy', foodType: 'vegetarian', quantity: 6, unit: 'litres', storageType: 'refrigerated', packagingType: 'sealed-pack', pickupLocation: 'Powai, Mumbai', latitude: 19.1176, longitude: 72.9060, bestBeforeHours: 18 },
    { foodName: 'Packed Juice Crates', category: 'beverages', foodType: 'vegan', quantity: 12, unit: 'litres', storageType: 'room-temp', packagingType: 'sealed-pack', pickupLocation: 'Navi Mumbai, Vashi', latitude: 19.0771, longitude: 72.9986, bestBeforeHours: 96 },
    { foodName: 'Samosa & Snacks Tray', category: 'snacks', foodType: 'vegetarian', quantity: 22, unit: 'pieces', storageType: 'room-temp', packagingType: 'container', pickupLocation: 'Karol Bagh, New Delhi', latitude: 28.6519, longitude: 77.1905, bestBeforeHours: 8 },
    { foodName: 'Cooked Meal Combo', category: 'cooked-meals', foodType: 'non-vegetarian', quantity: 11, unit: 'servings', storageType: 'refrigerated', packagingType: 'container', pickupLocation: 'Andheri West, Mumbai', latitude: 19.1364, longitude: 72.8296, bestBeforeHours: 12 },
  ];

  const listingIds = [];
  for (let i = 0; i < templates.length; i++) {
    const donor = donors[i % donors.length];
    const t = templates[i];

    const createdAt = new Date(base);
    createdAt.setHours(9 + i, 10 + (i * 7) % 50, 0, 0);

    const availableFrom = new Date(createdAt);
    const bestBefore = new Date(createdAt);
    bestBefore.setHours(bestBefore.getHours() + t.bestBeforeHours);

    const desc = `Demo listing for hackathon presentation on ${createdAt.toISOString().slice(0, 10)}.`;

    const r = await run(
      `INSERT INTO listings
       (donorId, foodName, category, foodType, quantity, unit, description, images, availableFrom, bestBefore, pickupLocation, latitude, longitude, storageType, packagingType, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [
        donor.id,
        t.foodName,
        t.category,
        t.foodType,
        t.quantity,
        t.unit,
        desc,
        JSON.stringify([]),
        toIso(availableFrom),
        toIso(bestBefore),
        t.pickupLocation,
        t.latitude,
        t.longitude,
        t.storageType,
        t.packagingType,
        toIso(createdAt),
      ]
    );

    listingIds.push({
      id: r.lastID,
      donorId: donor.id,
      donorName: donor.name,
      quantity: t.quantity,
      lat: t.latitude,
      lng: t.longitude,
      createdAt,
    });
  }

  return listingIds;
}

async function addClaims(listings, ngos) {
  // Claim 6 out of 8 listings: 3 self-pickup + 3 platform-delivery
  const target = listings.slice(0, 6);
  const createdClaims = [];

  for (let i = 0; i < target.length; i++) {
    const listing = target[i];
    const ngo = ngos[i % ngos.length];
    const method = i % 2 === 0 ? 'self-pickup' : 'platform-delivery';

    const scheduledTime = new Date(listing.createdAt);
    scheduledTime.setHours(scheduledTime.getHours() + 2);

    let deliveryDistance = 0;
    let deliveryFee = 0;
    let ngoLat = null;
    let ngoLng = null;
    let deliveryStatus = null;

    if (method === 'platform-delivery') {
      ngoLat = Number(ngo.latitude) || listing.lat + 0.05;
      ngoLng = Number(ngo.longitude) || listing.lng + 0.05;
      deliveryDistance = Math.round(haversineKm(listing.lat, listing.lng, ngoLat, ngoLng) * 10) / 10;
      deliveryFee = Math.round(30 + deliveryDistance * 8);
      deliveryStatus = 'pending';
    }

    const claimCreatedAt = new Date(listing.createdAt);
    claimCreatedAt.setMinutes(claimCreatedAt.getMinutes() + 25);

    const r = await run(
      `INSERT INTO claims
       (listingId, ngoId, status, scheduledTime, quantity, deliveryMethod, deliveryFee, deliveryDistance, deliveryStatus, ngoLatitude, ngoLongitude, createdAt)
       VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        listing.id,
        ngo.id,
        toIso(scheduledTime),
        listing.quantity,
        method,
        deliveryFee,
        deliveryDistance,
        deliveryStatus,
        ngoLat,
        ngoLng,
        toIso(claimCreatedAt),
      ]
    );

    await run(`UPDATE listings SET status = 'claimed' WHERE id = ?`, [listing.id]);

    createdClaims.push({
      id: r.lastID,
      listingId: listing.id,
      ngoName: ngo.name,
      method,
      deliveryFee,
      deliveryDistance,
    });
  }

  return createdClaims;
}

async function main() {
  console.log('Adding fresh hackathon demo data for today...\n');

  const { donors, ngos } = await ensureUsers();
  console.log(`Using ${donors.length} donors and ${ngos.length} NGOs`);

  const listingRows = await addListings(donors);
  console.log(`Added ${listingRows.length} listings dated today`);

  const claimRows = await addClaims(listingRows, ngos);
  const selfPickupCount = claimRows.filter(c => c.method === 'self-pickup').length;
  const platformCount = claimRows.filter(c => c.method === 'platform-delivery').length;

  console.log(`Added ${claimRows.length} new claims`);
  console.log(`  - self-pickup: ${selfPickupCount}`);
  console.log(`  - platform-delivery: ${platformCount}`);

  const summary = await get(
    `SELECT
      SUM(CASE WHEN date(createdAt) = '2026-04-01' THEN 1 ELSE 0 END) as todaysListings,
      SUM(CASE WHEN date(createdAt) = '2026-04-01' AND status = 'active' THEN 1 ELSE 0 END) as todaysActiveListings,
      SUM(CASE WHEN date(createdAt) = '2026-04-01' AND status = 'claimed' THEN 1 ELSE 0 END) as todaysClaimedListings
     FROM listings`
  );

  const claimSummary = await get(
    `SELECT
      SUM(CASE WHEN date(createdAt) = '2026-04-01' THEN 1 ELSE 0 END) as todaysClaims,
      SUM(CASE WHEN date(createdAt) = '2026-04-01' AND deliveryMethod = 'self-pickup' THEN 1 ELSE 0 END) as todaysSelfPickup,
      SUM(CASE WHEN date(createdAt) = '2026-04-01' AND deliveryMethod = 'platform-delivery' THEN 1 ELSE 0 END) as todaysPlatform
     FROM claims`
  );

  console.log('\nDemo Summary (Apr 1, 2026):');
  console.log(`  Listings created: ${summary.todaysListings || 0}`);
  console.log(`  Listings still active: ${summary.todaysActiveListings || 0}`);
  console.log(`  Listings claimed: ${summary.todaysClaimedListings || 0}`);
  console.log(`  Claims created: ${claimSummary.todaysClaims || 0}`);
  console.log(`  Self-pickup claims: ${claimSummary.todaysSelfPickup || 0}`);
  console.log(`  Platform-delivery claims: ${claimSummary.todaysPlatform || 0}`);

  console.log('\nDone. Your dashboard should now show fresh activity for presentation.');
  db.close();
}

main().catch((err) => {
  console.error('Failed to add demo data:', err.message);
  db.close();
  process.exit(1);
});
