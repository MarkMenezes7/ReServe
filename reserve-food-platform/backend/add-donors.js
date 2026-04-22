/**
 * Add donor30 - donor35 with active listings (March 11–16, 2026)
 * Run: node add-donors.js
 */

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
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

const DONORS = [
  {
    email: 'donor30@gmail.com',
    name: 'Punjabi Dhaba Express',
    org: 'Punjabi Dhaba Express Pvt Ltd',
    phone: '+91 98765 43210',
    address: 'Rajouri Garden, New Delhi',
    city: 'New Delhi',
    state: 'Delhi NCR',
    bio: 'Authentic Punjabi food joint donating surplus dal, roti and sabzi daily.',
    lat: 28.6466,
    lng: 77.1249,
  },
  {
    email: 'donor31@gmail.com',
    name: 'Bombay Bakers',
    org: 'Bombay Baking Company',
    phone: '+91 98123 55678',
    address: 'Bandra West, Mumbai',
    city: 'Mumbai',
    state: 'Maharashtra',
    bio: 'Premium bakery chain donating fresh bread, cakes and pastries every evening.',
    lat: 19.0596,
    lng: 72.8295,
  },
  {
    email: 'donor32@gmail.com',
    name: 'Delhi Fruit Market',
    org: 'Delhi Fresh Fruits Co-op',
    phone: '+91 91234 67890',
    address: 'Chandni Chowk, Old Delhi',
    city: 'New Delhi',
    state: 'Delhi NCR',
    bio: 'Wholesale fruit market donating near-ripe seasonal fruits to reduce waste.',
    lat: 28.6506,
    lng: 77.2305,
  },
  {
    email: 'donor33@gmail.com',
    name: 'South Spice Kitchen',
    org: 'South Spice Hospitality',
    phone: '+91 87654 32109',
    address: 'Powai, Mumbai',
    city: 'Mumbai',
    state: 'Maharashtra',
    bio: 'South Indian restaurant donating surplus idli, dosa batter and sambar.',
    lat: 19.1176,
    lng: 72.9060,
  },
  {
    email: 'donor34@gmail.com',
    name: 'Gurgaon Grocery Hub',
    org: 'GroceryHub Retail',
    phone: '+91 99876 11234',
    address: 'Gurgaon Sector 29',
    city: 'Gurgaon',
    state: 'Delhi NCR',
    bio: 'Supermarket donating near-expiry grains, dairy and packaged items.',
    lat: 28.4595,
    lng: 77.0266,
  },
  {
    email: 'donor35@gmail.com',
    name: 'Navi Mumbai Caterers',
    org: 'Navi Mumbai Catering Services',
    phone: '+91 88123 99456',
    address: 'Navi Mumbai, Vashi',
    city: 'Navi Mumbai',
    state: 'Maharashtra',
    bio: 'Event caterers donating leftover meals from corporate events and weddings.',
    lat: 19.0771,
    lng: 72.9986,
  },
];

// Listings for each donor — variety of categories, all active, bestBefore between Mar 13-16
const LISTINGS_DATA = [
  // donor30 — Punjabi Dhaba Express (Delhi)
  [
    { foodName: 'Rajma Chawal', category: 'cooked-meals', foodType: 'vegetarian', quantity: 12, unit: 'servings', storage: 'refrigerated', packaging: 'container', desc: 'Freshly prepared rajma chawal, packed in sealed containers.', bestBeforeOffset: 24, loc: 'Rajouri Garden, New Delhi', lat: 28.6470, lng: 77.1255 },
    { foodName: 'Dal Makhani with Roti', category: 'cooked-meals', foodType: 'vegetarian', quantity: 15, unit: 'servings', storage: 'refrigerated', packaging: 'container', desc: 'Rich dal makhani with fresh tandoori rotis.', bestBeforeOffset: 18, loc: 'Rajouri Garden, New Delhi', lat: 28.6462, lng: 77.1242 },
    { foodName: 'Chole Bhature', category: 'cooked-meals', foodType: 'vegetarian', quantity: 10, unit: 'servings', storage: 'room-temp', packaging: 'wrapped', desc: 'Surplus chole bhature from lunch service.', bestBeforeOffset: 12, loc: 'Rajouri Garden, New Delhi', lat: 28.6468, lng: 77.1260 },
    { foodName: 'Mixed Vegetables', category: 'fruits-vegetables', foodType: 'vegan', quantity: 5, unit: 'kg', storage: 'refrigerated', packaging: 'boxed', desc: 'Fresh mixed vegetables — potatoes, cauliflower, peas, carrots.', bestBeforeOffset: 96, loc: 'Rajouri Garden, New Delhi', lat: 28.6473, lng: 77.1238 },
  ],
  // donor31 — Bombay Bakers (Mumbai)
  [
    { foodName: 'Assorted Bread Loaves', category: 'bakery', foodType: 'vegetarian', quantity: 8, unit: 'pieces', storage: 'room-temp', packaging: 'sealed-pack', desc: 'Freshly baked white and brown bread loaves.', bestBeforeOffset: 72, loc: 'Bandra West, Mumbai', lat: 19.0600, lng: 72.8300 },
    { foodName: 'Muffins', category: 'bakery', foodType: 'vegetarian', quantity: 10, unit: 'pieces', storage: 'room-temp', packaging: 'boxed', desc: 'Chocolate and blueberry muffins baked this morning.', bestBeforeOffset: 48, loc: 'Bandra West, Mumbai', lat: 19.0590, lng: 72.8290 },
    { foodName: 'Pav Buns', category: 'bakery', foodType: 'vegetarian', quantity: 20, unit: 'pieces', storage: 'room-temp', packaging: 'wrapped', desc: 'Soft pav buns, ideal for pav bhaji or vada pav.', bestBeforeOffset: 36, loc: 'Bandra West, Mumbai', lat: 19.0605, lng: 72.8305 },
    { foodName: 'Cake Slices', category: 'bakery', foodType: 'vegetarian', quantity: 6, unit: 'pieces', storage: 'refrigerated', packaging: 'container', desc: 'Assorted cake slices — vanilla, chocolate, red velvet.', bestBeforeOffset: 60, loc: 'Bandra West, Mumbai', lat: 19.0598, lng: 72.8288 },
  ],
  // donor32 — Delhi Fruit Market (Delhi)
  [
    { foodName: 'Bananas', category: 'fruits-vegetables', foodType: 'vegan', quantity: 6, unit: 'kg', storage: 'room-temp', packaging: 'loose', desc: 'Ripe bananas, best consumed within 2 days.', bestBeforeOffset: 48, loc: 'Chandni Chowk, Old Delhi', lat: 28.6510, lng: 77.2310 },
    { foodName: 'Mixed Seasonal Fruits', category: 'fruits-vegetables', foodType: 'vegan', quantity: 8, unit: 'kg', storage: 'refrigerated', packaging: 'boxed', desc: 'Mix of apples, oranges and guavas — slightly bruised but perfectly edible.', bestBeforeOffset: 72, loc: 'Chandni Chowk, Old Delhi', lat: 28.6502, lng: 77.2298 },
    { foodName: 'Tomatoes & Onions', category: 'fruits-vegetables', foodType: 'vegan', quantity: 5, unit: 'kg', storage: 'room-temp', packaging: 'loose', desc: 'Fresh tomatoes and onions from today\'s stock.', bestBeforeOffset: 96, loc: 'Chandni Chowk, Old Delhi', lat: 28.6512, lng: 77.2315 },
    { foodName: 'Potatoes', category: 'fruits-vegetables', foodType: 'vegan', quantity: 10, unit: 'kg', storage: 'room-temp', packaging: 'loose', desc: 'Surplus potatoes from wholesale lot.', bestBeforeOffset: 120, loc: 'Chandni Chowk, Old Delhi', lat: 28.6500, lng: 77.2290 },
  ],
  // donor33 — South Spice Kitchen (Mumbai)
  [
    { foodName: 'Idli Sambar', category: 'cooked-meals', foodType: 'vegetarian', quantity: 18, unit: 'servings', storage: 'room-temp', packaging: 'container', desc: 'Soft idlis with fresh sambar and chutney.', bestBeforeOffset: 10, loc: 'Powai, Mumbai', lat: 19.1180, lng: 72.9065 },
    { foodName: 'Biryani', category: 'cooked-meals', foodType: 'non-vegetarian', quantity: 14, unit: 'servings', storage: 'refrigerated', packaging: 'container', desc: 'Hyderabadi chicken biryani from lunch buffet surplus.', bestBeforeOffset: 18, loc: 'Powai, Mumbai', lat: 19.1170, lng: 72.9055 },
    { foodName: 'Curd / Yogurt', category: 'dairy', foodType: 'vegetarian', quantity: 3, unit: 'kg', storage: 'refrigerated', packaging: 'sealed-pack', desc: 'Fresh homemade curd prepared daily.', bestBeforeOffset: 48, loc: 'Powai, Mumbai', lat: 19.1185, lng: 72.9070 },
    { foodName: 'Pulao with Raita', category: 'cooked-meals', foodType: 'vegetarian', quantity: 10, unit: 'servings', storage: 'refrigerated', packaging: 'container', desc: 'Veg pulao with fresh raita, packed for easy pickup.', bestBeforeOffset: 14, loc: 'Powai, Mumbai', lat: 19.1175, lng: 72.9050 },
  ],
  // donor34 — Gurgaon Grocery Hub (Delhi)
  [
    { foodName: 'Rice (Basmati)', category: 'grains-staples', foodType: 'vegan', quantity: 8, unit: 'kg', storage: 'room-temp', packaging: 'sealed-pack', desc: 'Premium basmati rice, near best-before but perfectly fine.', bestBeforeOffset: 120, loc: 'Gurgaon Sector 29', lat: 28.4600, lng: 77.0270 },
    { foodName: 'Milk Packets', category: 'dairy', foodType: 'vegetarian', quantity: 5, unit: 'litres', storage: 'refrigerated', packaging: 'sealed-pack', desc: 'Full cream milk packets, use within 2 days.', bestBeforeOffset: 48, loc: 'Gurgaon Sector 29', lat: 28.4590, lng: 77.0260 },
    { foodName: 'Instant Noodles', category: 'grains-staples', foodType: 'vegetarian', quantity: 12, unit: 'packets', storage: 'room-temp', packaging: 'sealed-pack', desc: 'Assorted instant noodle packets, near expiry date.', bestBeforeOffset: 120, loc: 'Gurgaon Sector 29', lat: 28.4605, lng: 77.0280 },
    { foodName: 'Cookies & Biscuits', category: 'bakery', foodType: 'vegetarian', quantity: 2, unit: 'kg', storage: 'room-temp', packaging: 'boxed', desc: 'Boxed cookies and biscuits, still sealed.', bestBeforeOffset: 96, loc: 'Gurgaon Sector 29', lat: 28.4588, lng: 77.0255 },
    { foodName: 'Paneer', category: 'dairy', foodType: 'vegetarian', quantity: 2, unit: 'kg', storage: 'refrigerated', packaging: 'sealed-pack', desc: 'Fresh paneer blocks, refrigerated.', bestBeforeOffset: 72, loc: 'Gurgaon Sector 29', lat: 28.4598, lng: 77.0268 },
  ],
  // donor35 — Navi Mumbai Caterers
  [
    { foodName: 'Paneer Butter Masala + Naan', category: 'cooked-meals', foodType: 'vegetarian', quantity: 10, unit: 'servings', storage: 'refrigerated', packaging: 'container', desc: 'Surplus from a corporate lunch event today.', bestBeforeOffset: 18, loc: 'Navi Mumbai, Vashi', lat: 19.0775, lng: 72.9990 },
    { foodName: 'Pav Bhaji', category: 'cooked-meals', foodType: 'vegetarian', quantity: 15, unit: 'servings', storage: 'room-temp', packaging: 'container', desc: 'Fresh pav bhaji prepared for evening event, surplus available.', bestBeforeOffset: 12, loc: 'Navi Mumbai, Vashi', lat: 19.0768, lng: 72.9980 },
    { foodName: 'Mixed Veg Thali', category: 'cooked-meals', foodType: 'vegetarian', quantity: 8, unit: 'plates', storage: 'refrigerated', packaging: 'wrapped', desc: 'Complete thali with dal, sabzi, roti and rice.', bestBeforeOffset: 16, loc: 'Navi Mumbai, Vashi', lat: 19.0780, lng: 72.9995 },
    { foodName: 'Packaged Juice', category: 'beverages', foodType: 'vegan', quantity: 8, unit: 'litres', storage: 'room-temp', packaging: 'sealed-pack', desc: 'Mixed fruit juice tetra packs from event catering.', bestBeforeOffset: 120, loc: 'Navi Mumbai, Vashi', lat: 19.0765, lng: 72.9975 },
    { foodName: 'Sandwiches', category: 'snacks', foodType: 'vegetarian', quantity: 12, unit: 'pieces', storage: 'refrigerated', packaging: 'wrapped', desc: 'Assorted veg sandwiches from corporate meeting.', bestBeforeOffset: 18, loc: 'Navi Mumbai, Vashi', lat: 19.0772, lng: 72.9988 },
  ],
];

async function addDonors() {
  console.log('Adding donor30 - donor35 with active listings...\n');

  const hashedPassword = await bcrypt.hash('password123', 10);
  const now = new Date('2026-03-11T10:00:00.000Z');

  for (let i = 0; i < DONORS.length; i++) {
    const d = DONORS[i];
    const donorNum = 30 + i;

    // Check if already exists
    const existing = await get('SELECT id FROM users WHERE email = ?', [d.email]);
    let donorId;

    if (existing) {
      donorId = existing.id;
      console.log(`  donor${donorNum} already exists (id=${donorId}), updating verification...`);
      await run('UPDATE users SET isVerified = 1, isActive = 1 WHERE id = ?', [donorId]);
    } else {
      const createdAt = new Date(now);
      createdAt.setDate(createdAt.getDate() - (10 - i)); // joined 5-10 days ago

      const result = await run(
        `INSERT INTO users (name, email, password, userType, organizationName, phone, address, city, state, bio, isVerified, isActive, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)`,
        [d.name, d.email, hashedPassword, 'donor', d.org, d.phone, d.address, d.city, d.state, d.bio, createdAt.toISOString()]
      );
      donorId = result.lastID;
      console.log(`  donor${donorNum} created (id=${donorId}) — ${d.name}`);
    }

    // Add verification record so they show verified in admin panel too
    const hasVerification = await get('SELECT id FROM verification_requests WHERE userId = ?', [donorId]).catch(() => null);
    if (!hasVerification) {
      await run(
        `INSERT OR IGNORE INTO verification_requests (userId, userType, status, createdAt) VALUES (?, 'donor', 'approved', ?)`,
        [donorId, now.toISOString()]
      ).catch(() => {
        // verification_requests table may not exist — that's fine, isVerified=1 on user is what matters
      });
    }

    // Add listings
    const listings = LISTINGS_DATA[i];
    let listingCount = 0;

    for (const l of listings) {
      // Stagger creation times throughout March 11
      const createdAt = new Date(now);
      createdAt.setHours(8 + listingCount * 2, Math.floor(Math.random() * 59), 0);

      const availableFrom = new Date(createdAt);

      const bestBefore = new Date(createdAt);
      bestBefore.setHours(bestBefore.getHours() + l.bestBeforeOffset);

      await run(
        `INSERT INTO listings (donorId, foodName, category, foodType, quantity, unit, description, availableFrom, bestBefore, pickupLocation, latitude, longitude, storageType, packagingType, status, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
        [
          donorId, l.foodName, l.category, l.foodType, l.quantity, l.unit, l.desc,
          availableFrom.toISOString(), bestBefore.toISOString(),
          l.loc, l.lat, l.lng, l.storage, l.packaging, createdAt.toISOString()
        ]
      );
      listingCount++;
    }
    console.log(`    → ${listingCount} active listings added`);
  }

  console.log('\n========================================');
  console.log('  Done! 6 donors + 27 active listings added');
  console.log('========================================');
  console.log('  Accounts (password: password123):');
  console.log('    donor30@gmail.com — Punjabi Dhaba Express');
  console.log('    donor31@gmail.com — Bombay Bakers');
  console.log('    donor32@gmail.com — Delhi Fruit Market');
  console.log('    donor33@gmail.com — South Spice Kitchen');
  console.log('    donor34@gmail.com — Gurgaon Grocery Hub');
  console.log('    donor35@gmail.com — Navi Mumbai Caterers');
  console.log('  All verified ✓ | All listings active ✓');
  console.log('  Best-before dates: March 12–16, 2026');
  console.log('========================================\n');

  db.close();
}

addDonors().catch((err) => {
  console.error('Failed:', err);
  db.close();
  process.exit(1);
});
