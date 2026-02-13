/**
 * ReServe - Database Seed Script
 * Generates realistic data for a platform that's been live ~4-5 months.
 * Small, growing startup - not a massive platform yet.
 * Run: node seed-data.js
 */

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'reserve.db');
const db = new sqlite3.Database(DB_PATH);

// ── Create tables (so seed can run on a fresh DB) ────────────────────
function initTables() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('PRAGMA journal_mode=WAL');
      db.run('PRAGMA foreign_keys=ON');
      db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, userType TEXT NOT NULL, organizationName TEXT, phone TEXT, address TEXT, city TEXT, state TEXT, pincode TEXT, bio TEXT, profileImage TEXT, isVerified INTEGER DEFAULT 0, isActive INTEGER DEFAULT 1, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP)`);
      db.run(`CREATE TABLE IF NOT EXISTS listings (id INTEGER PRIMARY KEY AUTOINCREMENT, donorId INTEGER NOT NULL, foodName TEXT NOT NULL, category TEXT NOT NULL, foodType TEXT, quantity REAL NOT NULL, unit TEXT NOT NULL, description TEXT, images TEXT, availableFrom DATETIME NOT NULL, bestBefore DATETIME NOT NULL, pickupLocation TEXT NOT NULL, latitude REAL, longitude REAL, storageType TEXT DEFAULT 'room-temp', packagingType TEXT, handlingInstructions TEXT, status TEXT DEFAULT 'active', createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (donorId) REFERENCES users(id))`);
      db.run(`CREATE TABLE IF NOT EXISTS claims (id INTEGER PRIMARY KEY AUTOINCREMENT, listingId INTEGER NOT NULL, ngoId INTEGER NOT NULL, status TEXT DEFAULT 'pending', scheduledTime DATETIME, collectedAt DATETIME, quantity REAL, cancelReason TEXT, proofImage TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (listingId) REFERENCES listings(id), FOREIGN KEY (ngoId) REFERENCES users(id))`);
      db.run(`CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, claimId INTEGER NOT NULL, reviewerId INTEGER NOT NULL, revieweeId INTEGER NOT NULL, foodQuality INTEGER, communication INTEGER, timeliness INTEGER, overall INTEGER, comment TEXT, isAnonymous INTEGER DEFAULT 0, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (claimId) REFERENCES claims(id), FOREIGN KEY (reviewerId) REFERENCES users(id), FOREIGN KEY (revieweeId) REFERENCES users(id))`);
      db.run(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, claimId INTEGER NOT NULL, senderId INTEGER NOT NULL, receiverId INTEGER NOT NULL, content TEXT NOT NULL, messageType TEXT DEFAULT 'text', imageUrl TEXT, isRead INTEGER DEFAULT 0, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (claimId) REFERENCES claims(id), FOREIGN KEY (senderId) REFERENCES users(id), FOREIGN KEY (receiverId) REFERENCES users(id))`);
      db.run(`CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, relatedId INTEGER, relatedType TEXT, isRead INTEGER DEFAULT 0, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (userId) REFERENCES users(id))`);
      db.run(`CREATE TABLE IF NOT EXISTS contact_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL, organization TEXT, interestType TEXT, subject TEXT, message TEXT NOT NULL, status TEXT DEFAULT 'new', createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)`);
      db.run(`CREATE TABLE IF NOT EXISTS gratitude_wall (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER, displayName TEXT NOT NULL, message TEXT, amount REAL, tier TEXT, isVisible INTEGER DEFAULT 1, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (userId) REFERENCES users(id))`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

// ── Helpers ──────────────────────────────────────────────────────────

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
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

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max, dec = 4) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(dec));
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function isoStr(d) {
  return d.toISOString();
}

// Bias toward realistic peak hours (10-14 lunch, 18-21 dinner)
function randomHourBiased() {
  const r = Math.random();
  if (r < 0.35) return randInt(10, 14);   // lunch peak
  if (r < 0.65) return randInt(18, 21);   // dinner peak
  if (r < 0.80) return randInt(7, 9);     // early morning
  if (r < 0.92) return randInt(15, 17);   // afternoon
  return randInt(22, 23);                  // late night (rare)
}

function setHour(d, h) {
  const nd = new Date(d);
  nd.setHours(h, randInt(0, 59), randInt(0, 59));
  return nd;
}

// ── Reference Data ───────────────────────────────────────────────────

// Locations - Delhi NCR + Mumbai
const LOCATIONS = [
  // ── Delhi NCR ──
  { area: 'Connaught Place, New Delhi', lat: 28.6315, lng: 77.2167, region: 'delhi' },
  { area: 'Saket, New Delhi', lat: 28.5244, lng: 77.2066, region: 'delhi' },
  { area: 'Dwarka Sector 21, New Delhi', lat: 28.5520, lng: 77.0586, region: 'delhi' },
  { area: 'Lajpat Nagar, New Delhi', lat: 28.5677, lng: 77.2433, region: 'delhi' },
  { area: 'Karol Bagh, New Delhi', lat: 28.6519, lng: 77.1905, region: 'delhi' },
  { area: 'Rohini Sector 3, New Delhi', lat: 28.7152, lng: 77.1169, region: 'delhi' },
  { area: 'Vasant Kunj, New Delhi', lat: 28.5195, lng: 77.1571, region: 'delhi' },
  { area: 'Pitampura, New Delhi', lat: 28.7032, lng: 77.1353, region: 'delhi' },
  { area: 'Janakpuri, New Delhi', lat: 28.6253, lng: 77.0872, region: 'delhi' },
  { area: 'Nehru Place, New Delhi', lat: 28.5491, lng: 77.2533, region: 'delhi' },
  { area: 'Gurgaon Sector 29', lat: 28.4595, lng: 77.0266, region: 'delhi' },
  { area: 'Gurgaon Cyber City', lat: 28.4940, lng: 77.0887, region: 'delhi' },
  { area: 'Noida Sector 18', lat: 28.5706, lng: 77.3260, region: 'delhi' },
  { area: 'Noida Sector 62', lat: 28.6268, lng: 77.3649, region: 'delhi' },
  { area: 'Greater Noida', lat: 28.4744, lng: 77.5040, region: 'delhi' },
  { area: 'Faridabad, Sector 15', lat: 28.3887, lng: 77.3178, region: 'delhi' },
  { area: 'Ghaziabad Indirapuram', lat: 28.6353, lng: 77.3791, region: 'delhi' },
  { area: 'Chandni Chowk, Old Delhi', lat: 28.6506, lng: 77.2305, region: 'delhi' },
  { area: 'Hauz Khas, New Delhi', lat: 28.5530, lng: 77.2016, region: 'delhi' },
  { area: 'Rajouri Garden, New Delhi', lat: 28.6466, lng: 77.1249, region: 'delhi' },
  // ── Mumbai ──
  { area: 'Andheri West, Mumbai', lat: 19.1364, lng: 72.8296, region: 'mumbai' },
  { area: 'Bandra West, Mumbai', lat: 19.0596, lng: 72.8295, region: 'mumbai' },
  { area: 'Dadar, Mumbai', lat: 19.0178, lng: 72.8478, region: 'mumbai' },
  { area: 'Colaba, Mumbai', lat: 18.9067, lng: 72.8147, region: 'mumbai' },
  { area: 'Churchgate, Mumbai', lat: 18.9322, lng: 72.8264, region: 'mumbai' },
  { area: 'Juhu, Mumbai', lat: 19.0883, lng: 72.8263, region: 'mumbai' },
  { area: 'Powai, Mumbai', lat: 19.1176, lng: 72.9060, region: 'mumbai' },
  { area: 'Borivali West, Mumbai', lat: 19.2288, lng: 72.8544, region: 'mumbai' },
  { area: 'Malad West, Mumbai', lat: 19.1872, lng: 72.8484, region: 'mumbai' },
  { area: 'Goregaon East, Mumbai', lat: 19.1663, lng: 72.8526, region: 'mumbai' },
  { area: 'Vile Parle, Mumbai', lat: 19.0968, lng: 72.8494, region: 'mumbai' },
  { area: 'Lower Parel, Mumbai', lat: 18.9930, lng: 72.8310, region: 'mumbai' },
  { area: 'BKC, Mumbai', lat: 19.0607, lng: 72.8656, region: 'mumbai' },
  { area: 'Thane West', lat: 19.2183, lng: 72.9781, region: 'mumbai' },
  { area: 'Navi Mumbai, Vashi', lat: 19.0771, lng: 72.9986, region: 'mumbai' },
  { area: 'Navi Mumbai, Kharghar', lat: 19.0474, lng: 73.0603, region: 'mumbai' },
  { area: 'Kurla, Mumbai', lat: 19.0726, lng: 72.8793, region: 'mumbai' },
  { area: 'Chembur, Mumbai', lat: 19.0522, lng: 72.8994, region: 'mumbai' },
  { area: 'Ghatkopar, Mumbai', lat: 19.0860, lng: 72.9080, region: 'mumbai' },
  { area: 'Kandivali West, Mumbai', lat: 19.2048, lng: 72.8415, region: 'mumbai' },
];

const FOOD_ITEMS = {
  'cooked-meals': [
    { name: 'Rajma Chawal', qty: [3, 12], unit: 'servings', storage: 'refrigerated' },
    { name: 'Dal Makhani with Roti', qty: [5, 15], unit: 'servings', storage: 'refrigerated' },
    { name: 'Biryani', qty: [4, 18], unit: 'servings', storage: 'refrigerated' },
    { name: 'Chole Bhature', qty: [5, 12], unit: 'servings', storage: 'refrigerated' },
    { name: 'Paneer Butter Masala + Naan', qty: [4, 10], unit: 'servings', storage: 'refrigerated' },
    { name: 'Idli Sambar', qty: [6, 20], unit: 'servings', storage: 'room-temp' },
    { name: 'Pav Bhaji', qty: [5, 15], unit: 'servings', storage: 'room-temp' },
    { name: 'Mixed Veg Thali', qty: [4, 10], unit: 'plates', storage: 'refrigerated' },
    { name: 'Poha', qty: [3, 10], unit: 'servings', storage: 'room-temp' },
    { name: 'Pulao with Raita', qty: [5, 12], unit: 'servings', storage: 'refrigerated' },
    { name: 'Vada Pav', qty: [6, 20], unit: 'servings', storage: 'room-temp' },
    { name: 'Misal Pav', qty: [5, 12], unit: 'servings', storage: 'room-temp' },
  ],
  'bakery': [
    { name: 'Assorted Bread Loaves', qty: [2, 8], unit: 'pieces', storage: 'room-temp' },
    { name: 'Sandwich Bread', qty: [3, 10], unit: 'pieces', storage: 'room-temp' },
    { name: 'Pav Buns', qty: [8, 24], unit: 'pieces', storage: 'room-temp' },
    { name: 'Cake Slices', qty: [3, 8], unit: 'pieces', storage: 'refrigerated' },
    { name: 'Cookies & Biscuits', qty: [1, 3], unit: 'kg', storage: 'room-temp' },
    { name: 'Muffins', qty: [4, 10], unit: 'pieces', storage: 'room-temp' },
  ],
  'fruits-vegetables': [
    { name: 'Mixed Seasonal Fruits', qty: [2, 8], unit: 'kg', storage: 'refrigerated' },
    { name: 'Bananas', qty: [2, 6], unit: 'kg', storage: 'room-temp' },
    { name: 'Apples', qty: [1, 5], unit: 'kg', storage: 'refrigerated' },
    { name: 'Mixed Vegetables', qty: [2, 8], unit: 'kg', storage: 'refrigerated' },
    { name: 'Tomatoes & Onions', qty: [2, 6], unit: 'kg', storage: 'room-temp' },
    { name: 'Leafy Greens (Spinach, Methi)', qty: [1, 3], unit: 'kg', storage: 'refrigerated' },
    { name: 'Potatoes', qty: [3, 10], unit: 'kg', storage: 'room-temp' },
  ],
  'dairy': [
    { name: 'Milk Packets', qty: [2, 6], unit: 'litres', storage: 'refrigerated' },
    { name: 'Paneer', qty: [1, 3], unit: 'kg', storage: 'refrigerated' },
    { name: 'Curd / Yogurt', qty: [1, 4], unit: 'kg', storage: 'refrigerated' },
    { name: 'Butter & Cheese', qty: [1, 2], unit: 'kg', storage: 'refrigerated' },
  ],
  'grains-staples': [
    { name: 'Rice (Basmati)', qty: [3, 10], unit: 'kg', storage: 'room-temp' },
    { name: 'Wheat Flour (Atta)', qty: [2, 8], unit: 'kg', storage: 'room-temp' },
    { name: 'Lentils (Mixed Dal)', qty: [1, 5], unit: 'kg', storage: 'room-temp' },
    { name: 'Instant Noodles', qty: [3, 12], unit: 'packets', storage: 'room-temp' },
    { name: 'Oats & Cereal', qty: [1, 4], unit: 'kg', storage: 'room-temp' },
  ],
  'beverages': [
    { name: 'Packaged Juice', qty: [3, 10], unit: 'litres', storage: 'room-temp' },
    { name: 'Bottled Water', qty: [6, 24], unit: 'bottles', storage: 'room-temp' },
    { name: 'Tea / Coffee Packets', qty: [2, 6], unit: 'packets', storage: 'room-temp' },
  ],
  'snacks': [
    { name: 'Samosas', qty: [6, 20], unit: 'pieces', storage: 'room-temp' },
    { name: 'Namkeen / Mixture', qty: [1, 3], unit: 'kg', storage: 'room-temp' },
    { name: 'Sandwiches', qty: [4, 12], unit: 'pieces', storage: 'refrigerated' },
    { name: 'Pakoras', qty: [6, 15], unit: 'pieces', storage: 'room-temp' },
    { name: 'Dhokla', qty: [4, 12], unit: 'pieces', storage: 'room-temp' },
  ],
};

const CATEGORIES = Object.keys(FOOD_ITEMS);

const PACKAGING_TYPES = ['container', 'wrapped', 'boxed', 'sealed-pack', 'loose'];
const FOOD_TYPES = ['vegetarian', 'vegan', 'non-vegetarian'];
const FOOD_TYPE_WEIGHTS = [0.60, 0.15, 0.25];

function weightedFoodType() {
  const r = Math.random();
  if (r < FOOD_TYPE_WEIGHTS[0]) return FOOD_TYPES[0];
  if (r < FOOD_TYPE_WEIGHTS[0] + FOOD_TYPE_WEIGHTS[1]) return FOOD_TYPES[1];
  return FOOD_TYPES[2];
}

// Category probability weights
const CATEGORY_WEIGHTS = {
  'cooked-meals': 0.30,
  'bakery': 0.12,
  'fruits-vegetables': 0.18,
  'dairy': 0.08,
  'grains-staples': 0.15,
  'beverages': 0.07,
  'snacks': 0.10,
};

function weightedCategory() {
  let r = Math.random();
  for (const [cat, w] of Object.entries(CATEGORY_WEIGHTS)) {
    r -= w;
    if (r <= 0) return cat;
  }
  return 'cooked-meals';
}

// ── Donor/NGO profiles (only a subset will be "active") ──────────

const DONOR_PROFILES = [
  // ── Delhi NCR (8 donors - some are early, some joined recently) ──
  { name: 'Sharma Caterers', org: 'Sharma Catering Services', city: 'New Delhi', region: 'delhi', bio: 'Wedding and event caterers since 1998, committed to zero waste.', joinedDaysAgo: 140, activity: 'high' },
  { name: 'Annapurna Restaurant', org: 'Annapurna Foods Pvt Ltd', city: 'New Delhi', region: 'delhi', bio: 'North Indian restaurant chain with 5 outlets across Delhi.', joinedDaysAgo: 130, activity: 'high' },
  { name: 'FreshBake Bakery', org: 'FreshBake India', city: 'Gurgaon', region: 'delhi', bio: 'Artisan bakery donating day-end surplus daily.', joinedDaysAgo: 110, activity: 'medium' },
  { name: 'Green Harvest Farms', org: 'Green Harvest Organics', city: 'Noida', region: 'delhi', bio: 'Organic farm-to-table produce, donating unsold harvest.', joinedDaysAgo: 90, activity: 'medium' },
  { name: 'Haldirams Express', org: 'Haldirams Outlet CP', city: 'New Delhi', region: 'delhi', bio: 'Snacks and sweets shop reducing daily waste.', joinedDaysAgo: 70, activity: 'low' },
  { name: 'Cloud Kitchen Hub', org: 'ZestyBites Cloud Kitchen', city: 'Noida', region: 'delhi', bio: 'Multi-brand cloud kitchen with daily surplus meals.', joinedDaysAgo: 45, activity: 'medium' },
  { name: 'Rajesh Provisions', org: 'Rajesh General Store', city: 'Ghaziabad', region: 'delhi', bio: 'Neighborhood grocer donating excess grains and staples.', joinedDaysAgo: 30, activity: 'low' },
  { name: 'Spice Route Café', org: 'Spice Route Hospitality', city: 'Gurgaon', region: 'delhi', bio: 'Café and restaurant with weekend brunch surplus.', joinedDaysAgo: 15, activity: 'low' },
  // ── Mumbai (7 donors) ──
  { name: 'Taj Mumbai Kitchen', org: 'Taj Hotels Mumbai', city: 'Mumbai', region: 'mumbai', bio: 'Five-star hotel buffet surplus redistribution.', joinedDaysAgo: 135, activity: 'high' },
  { name: 'Mumbai Tiffin Service', org: 'Dabbawala Foods', city: 'Mumbai', region: 'mumbai', bio: 'Surplus tiffin meals from the dabbawala network.', joinedDaysAgo: 120, activity: 'medium' },
  { name: 'Bandra Bakehouse', org: 'Bandra Baking Co.', city: 'Mumbai', region: 'mumbai', bio: 'Artisan bakery in Bandra donating day-old breads.', joinedDaysAgo: 100, activity: 'medium' },
  { name: 'Crawford Market Vendors', org: 'Crawford Market Association', city: 'Mumbai', region: 'mumbai', bio: 'Market vendors pooling unsold fresh produce.', joinedDaysAgo: 75, activity: 'low' },
  { name: 'Sardar Pav Bhaji', org: 'Sardar Refreshments', city: 'Mumbai', region: 'mumbai', bio: 'Iconic Tardeo restaurant donating surplus pav bhaji.', joinedDaysAgo: 50, activity: 'medium' },
  { name: 'Juhu Beach Stalls', org: 'Juhu Food Association', city: 'Mumbai', region: 'mumbai', bio: 'Beach food stall collective donating unsold chaat.', joinedDaysAgo: 25, activity: 'low' },
  { name: 'Reliance Fresh Powai', org: 'Reliance Retail', city: 'Mumbai', region: 'mumbai', bio: 'Supermarket donating near-expiry products.', joinedDaysAgo: 10, activity: 'low' },
];

const NGO_PROFILES = [
  // ── Delhi NCR (6 NGOs) ──
  { name: 'Feeding Delhi', org: 'Feeding Delhi Foundation', city: 'New Delhi', region: 'delhi', bio: 'Distributing rescued food to shelters across Delhi.', joinedDaysAgo: 145 },
  { name: 'Robin Hood Army Delhi', org: 'Robin Hood Army', city: 'New Delhi', region: 'delhi', bio: 'Volunteer-driven surplus food distribution.', joinedDaysAgo: 130 },
  { name: 'Roti Bank Noida', org: 'Roti Bank Foundation', city: 'Noida', region: 'delhi', bio: 'Collecting and distributing rotis to homeless.', joinedDaysAgo: 100 },
  { name: 'Apni Rasoi', org: 'Apni Rasoi Trust', city: 'New Delhi', region: 'delhi', bio: 'Community kitchen serving meals using rescued food.', joinedDaysAgo: 60 },
  { name: 'No Food Waste Delhi', org: 'No Food Waste NGO', city: 'New Delhi', region: 'delhi', bio: 'Tech-driven food rescue connecting donors to need.', joinedDaysAgo: 40 },
  { name: 'Ann Daan Foundation', org: 'Ann Daan', city: 'Ghaziabad', region: 'delhi', bio: 'Feeding migrant workers and daily-wage laborers.', joinedDaysAgo: 20 },
  // ── Mumbai (5 NGOs) ──
  { name: 'Roti Bank Mumbai', org: 'Mumbai Roti Bank', city: 'Mumbai', region: 'mumbai', bio: 'Collecting surplus meals from restaurants.', joinedDaysAgo: 140 },
  { name: 'Robin Hood Army Mumbai', org: 'Robin Hood Army Mumbai Chapter', city: 'Mumbai', region: 'mumbai', bio: 'Weekend food drives to slum communities.', joinedDaysAgo: 110 },
  { name: 'Annakshetra Foundation', org: 'Annakshetra', city: 'Mumbai', region: 'mumbai', bio: 'Operating community kitchens using rescued food.', joinedDaysAgo: 80 },
  { name: 'Mumbai Food Bank', org: 'India Food Banking Network - Mumbai', city: 'Mumbai', region: 'mumbai', bio: 'Warehouse-based food banking.', joinedDaysAgo: 50 },
  { name: 'SEVA Kitchen Dharavi', org: 'SEVA Dharavi Trust', city: 'Mumbai', region: 'mumbai', bio: 'Community kitchen in Dharavi feeding families.', joinedDaysAgo: 25 },
];

const CHAT_TEMPLATES = [
  [
    'Hi, I just claimed the listing. When can I pick it up?',
    'Hello! Anytime between 2-5 PM today works for us.',
    'Perfect, I\'ll be there by 3 PM.',
    'Package is ready at the counter. Thank you for doing this!',
  ],
  [
    'Hello, I\'ve claimed the food items. How fresh are they?',
    'Very fresh! Prepared just this morning.',
    'Wonderful. I\'ll send a volunteer in about an hour.',
    'Sounds good. Please bring insulated bags if possible.',
  ],
  [
    'Hi! Is the listed quantity still available?',
    'Yes, all of it. Come by before 6 PM.',
    'Thank you! On our way.',
  ],
  [
    'Good morning! Need to pick up quickly for cold chain.',
    'Understood. Can you come within the hour?',
    'Yes, ETA 30 minutes.',
    'Everything ready at the entrance.',
  ],
  [
    'Namaste! We\'d like to pick up the grain donation today.',
    'Namaste! The bags are packed and ready.',
    'Our team will be there by 7 PM. Thank you!',
  ],
];

const REVIEW_COMMENTS = [
  'Good food quality, well-packaged. Will collect again.',
  'Great communication and ready on time. Thank you!',
  'The food was in good condition. Appreciated.',
  'Organized donor. Pickup was smooth.',
  'Good quality staples. Helps our distribution.',
  'Prompt and professional.',
  'Fresh produce, our kitchen put it to great use.',
  'Slightly delayed but food quality was good.',
  'Wonderful experience.',
  'Reliable partner.',
  'Fresh bakery items, well-sorted.',
  'Huge help for our shelter. Grateful!',
];

// ── Main Seed Function ──────────────────────────────────────────────

async function seed() {
  console.log('Starting database seed (realistic 4-5 month startup)...\n');

  await initTables();
  console.log('Tables initialized.');

  const hashedPassword = await bcrypt.hash('password123', 10);

  // ── 1. Create Donor Users ──
  console.log('Creating donor accounts...');
  const donorIds = [];
  const donorRegions = {};
  const donorActivity = {};

  for (let i = 0; i < DONOR_PROFILES.length; i++) {
    const p = DONOR_PROFILES[i];
    const regionLocs = LOCATIONS.filter(l => l.region === p.region);
    const loc = regionLocs[i % regionLocs.length];
    const createdAt = isoStr(daysAgo(p.joinedDaysAgo));
    const stateName = p.region === 'mumbai' ? 'Maharashtra' : 'Delhi NCR';

    try {
      const result = await run(
        `INSERT INTO users (name, email, password, userType, organizationName, phone, address, city, state, bio, isVerified, isActive, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.name, `donor${i + 1}@gmail.com`, hashedPassword, 'donor', p.org,
         `+91 ${randInt(70000, 99999)} ${randInt(10000, 99999)}`,
         loc.area, p.city, stateName, p.bio, 1, 1, createdAt]
      );
      donorIds.push(result.lastID);
      donorRegions[result.lastID] = p.region;
      donorActivity[result.lastID] = p.activity;
    } catch (e) {
      const row = await all(`SELECT id FROM users WHERE email = ?`, [`donor${i + 1}@gmail.com`]);
      if (row.length) {
        donorIds.push(row[0].id);
        donorRegions[row[0].id] = p.region;
        donorActivity[row[0].id] = p.activity;
      }
    }
  }
  console.log(`  ${donorIds.length} donors ready`);

  // ── 2. Create NGO Users ──
  console.log('Creating NGO accounts...');
  const ngoIds = [];
  const ngoRegions = {};

  for (let i = 0; i < NGO_PROFILES.length; i++) {
    const p = NGO_PROFILES[i];
    const regionLocs = LOCATIONS.filter(l => l.region === p.region);
    const loc = regionLocs[i % regionLocs.length];
    const createdAt = isoStr(daysAgo(p.joinedDaysAgo));
    const stateName = p.region === 'mumbai' ? 'Maharashtra' : 'Delhi NCR';

    try {
      const result = await run(
        `INSERT INTO users (name, email, password, userType, organizationName, phone, address, city, state, bio, isVerified, isActive, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.name, `ngo${i + 1}@gmail.com`, hashedPassword, 'ngo', p.org,
         `+91 ${randInt(70000, 99999)} ${randInt(10000, 99999)}`,
         loc.area, p.city, stateName, p.bio, 1, 1, createdAt]
      );
      ngoIds.push(result.lastID);
      ngoRegions[result.lastID] = p.region;
    } catch (e) {
      const row = await all(`SELECT id FROM users WHERE email = ?`, [`ngo${i + 1}@gmail.com`]);
      if (row.length) {
        ngoIds.push(row[0].id);
        ngoRegions[row[0].id] = p.region;
      }
    }
  }
  console.log(`  ${ngoIds.length} NGOs ready`);

  // ── 3. Generate Listings (~130 listings over 4.5 months) ──
  // Realistic ramp-up: month 1 = ~8, month 2 = ~15, month 3 = ~25, month 4 = ~35, month 4.5 = ~45
  console.log('Generating listings...');
  const listings = [];

  // Define weekly slots with a growth curve
  // Week 1 (oldest): 1-2 listings, growing to week 18-19: 4-6 listings
  const TOTAL_WEEKS = 19; // ~4.5 months

  for (let week = 0; week < TOTAL_WEEKS; week++) {
    // Growth curve: slow start, gradual increase
    const weekAge = TOTAL_WEEKS - week; // weeks ago
    let listingsThisWeek;
    if (weekAge > 16) listingsThisWeek = randInt(1, 2);       // month 1: 1-2/week
    else if (weekAge > 12) listingsThisWeek = randInt(2, 4);  // month 2: 2-4/week
    else if (weekAge > 8) listingsThisWeek = randInt(3, 5);   // month 3: 3-5/week
    else if (weekAge > 4) listingsThisWeek = randInt(4, 7);   // month 4: 4-7/week
    else listingsThisWeek = randInt(5, 8);                    // recent: 5-8/week

    // Some weeks have fewer (realistic gaps)
    if (Math.random() < 0.15) listingsThisWeek = Math.max(1, listingsThisWeek - 2);

    for (let j = 0; j < listingsThisWeek; j++) {
      const cat = weightedCategory();
      const item = pick(FOOD_ITEMS[cat]);

      // Bias donor selection by activity level
      let donorId;
      const r = Math.random();
      const highActivity = donorIds.filter(id => donorActivity[id] === 'high');
      const medActivity = donorIds.filter(id => donorActivity[id] === 'medium');
      const lowActivity = donorIds.filter(id => donorActivity[id] === 'low');
      if (r < 0.50 && highActivity.length) donorId = pick(highActivity);
      else if (r < 0.80 && medActivity.length) donorId = pick(medActivity);
      else donorId = pick(lowActivity.length ? lowActivity : donorIds);

      const donorRegion = donorRegions[donorId] || 'delhi';
      const regionLocs = LOCATIONS.filter(l => l.region === donorRegion);
      const loc = pick(regionLocs);

      const dAgo = weekAge * 7 - randInt(0, 6); // random day within the week
      const baseDate = daysAgo(Math.max(0, dAgo));
      const hour = randomHourBiased();
      const createdAt = setHour(baseDate, hour);

      const availableFrom = new Date(createdAt);
      const bestBefore = new Date(createdAt);
      bestBefore.setHours(bestBefore.getHours() + randInt(4, 36));

      const qty = randInt(item.qty[0], item.qty[1]);
      const foodType = cat === 'cooked-meals' || cat === 'snacks' ? weightedFoodType() : pick(['vegetarian', 'vegan']);

      // Status: older listings more settled, recent ones more active
      let status;
      if (dAgo > 14) {
        const s = Math.random();
        if (s < 0.40) status = 'collected';
        else if (s < 0.55) status = 'claimed';
        else if (s < 0.75) status = 'expired';
        else status = 'cancelled';
      } else if (dAgo > 3) {
        const s = Math.random();
        if (s < 0.25) status = 'collected';
        else if (s < 0.50) status = 'claimed';
        else if (s < 0.70) status = 'active';
        else status = 'expired';
      } else {
        const s = Math.random();
        if (s < 0.55) status = 'active';
        else if (s < 0.75) status = 'claimed';
        else status = 'collected';
      }

      const lat = loc.lat + randFloat(-0.012, 0.012);
      const lng = loc.lng + randFloat(-0.012, 0.012);

      const result = await run(
        `INSERT INTO listings (donorId, foodName, category, foodType, quantity, unit, description, availableFrom, bestBefore, pickupLocation, latitude, longitude, storageType, packagingType, status, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          donorId, item.name, cat, foodType, qty, item.unit,
          `Fresh ${item.name.toLowerCase()} available for pickup.`,
          isoStr(availableFrom), isoStr(bestBefore), loc.area,
          lat, lng, item.storage, pick(PACKAGING_TYPES), status, isoStr(createdAt),
        ]
      );

      listings.push({
        id: result.lastID,
        donorId,
        category: cat,
        quantity: qty,
        status,
        createdAt,
        location: loc.area,
      });
    }
  }
  console.log(`  ${listings.length} listings created`);

  // ── 4. Generate Claims ──
  console.log('Generating claims...');
  const claims = [];

  const claimableListings = listings.filter(l =>
    ['claimed', 'collected', 'cancelled'].includes(l.status)
  );

  for (const listing of claimableListings) {
    const listingRegion = donorRegions[listing.donorId] || 'delhi';
    const regionNgoIds = ngoIds.filter(id => (ngoRegions[id] || 'delhi') === listingRegion);
    const ngoId = regionNgoIds.length > 0 ? pick(regionNgoIds) : pick(ngoIds);
    const claimDate = new Date(listing.createdAt);
    claimDate.setMinutes(claimDate.getMinutes() + randInt(15, 240));

    const scheduledTime = new Date(claimDate);
    scheduledTime.setHours(scheduledTime.getHours() + randInt(1, 8));

    let status, collectedAt = null, cancelReason = null;
    if (listing.status === 'collected') {
      status = 'collected';
      collectedAt = new Date(scheduledTime);
      collectedAt.setMinutes(collectedAt.getMinutes() + randInt(-20, 90));
    } else if (listing.status === 'cancelled') {
      status = 'cancelled';
      cancelReason = pick([
        'Could not arrange transport in time',
        'Scheduling conflict',
        'Donor cancelled - food already given away',
        'Weather conditions prevented pickup',
      ]);
    } else {
      status = pick(['pending', 'confirmed']);
    }

    const result = await run(
      `INSERT INTO claims (listingId, ngoId, status, scheduledTime, collectedAt, quantity, cancelReason, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        listing.id, ngoId, status, isoStr(scheduledTime),
        collectedAt ? isoStr(collectedAt) : null,
        listing.quantity, cancelReason, isoStr(claimDate),
      ]
    );

    claims.push({
      id: result.lastID,
      listingId: listing.id,
      donorId: listing.donorId,
      ngoId,
      status,
      claimDate,
    });
  }
  console.log(`  ${claims.length} claims created`);

  // ── 5. Generate Messages (for ~30% of claims) ──
  console.log('Generating chat messages...');
  let totalMessages = 0;

  const claimsForChat = claims
    .filter(c => c.status !== 'cancelled')
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.floor(claims.length * 0.30));

  for (const claim of claimsForChat) {
    const template = pick(CHAT_TEMPLATES);
    let msgTime = new Date(claim.claimDate);

    for (let i = 0; i < template.length; i++) {
      const isNgoMsg = i % 2 === 0;
      const senderId = isNgoMsg ? claim.ngoId : claim.donorId;
      const receiverId = isNgoMsg ? claim.donorId : claim.ngoId;

      msgTime = new Date(msgTime.getTime() + randInt(2, 25) * 60000);

      await run(
        `INSERT INTO messages (claimId, senderId, receiverId, content, messageType, isRead, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [claim.id, senderId, receiverId, template[i], 'text', 1, isoStr(msgTime)]
      );
      totalMessages++;
    }
  }
  console.log(`  ${totalMessages} messages created`);

  // ── 6. Generate Reviews (for collected claims, ~55% leave review) ──
  console.log('Generating reviews...');
  let totalReviews = 0;

  const collectedClaims = claims.filter(c => c.status === 'collected');

  for (const claim of collectedClaims) {
    if (Math.random() > 0.55) continue;

    // NGO reviews donor - realistic ratings (not all 5 stars)
    const fq = Math.random() < 0.7 ? randInt(4, 5) : randInt(3, 4);
    const comm = Math.random() < 0.6 ? randInt(4, 5) : randInt(3, 4);
    const time = Math.random() < 0.5 ? randInt(4, 5) : randInt(3, 4);
    const overall = Math.round((fq + comm + time) / 3);
    const reviewDate = new Date(claim.claimDate);
    reviewDate.setHours(reviewDate.getHours() + randInt(2, 72));

    await run(
      `INSERT INTO reviews (claimId, reviewerId, revieweeId, foodQuality, communication, timeliness, overall, comment, isAnonymous, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [claim.id, claim.ngoId, claim.donorId, fq, comm, time, overall,
       pick(REVIEW_COMMENTS), Math.random() < 0.15 ? 1 : 0, isoStr(reviewDate)]
    );
    totalReviews++;

    // ~25% donors also review back
    if (Math.random() < 0.25) {
      const fq2 = randInt(3, 5), comm2 = randInt(3, 5), time2 = randInt(3, 5);
      const overall2 = Math.round((fq2 + comm2 + time2) / 3);

      await run(
        `INSERT INTO reviews (claimId, reviewerId, revieweeId, foodQuality, communication, timeliness, overall, comment, isAnonymous, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [claim.id, claim.donorId, claim.ngoId, fq2, comm2, time2, overall2,
         pick(REVIEW_COMMENTS), Math.random() < 0.1 ? 1 : 0, isoStr(reviewDate)]
      );
      totalReviews++;
    }
  }
  console.log(`  ${totalReviews} reviews created`);

  // ── 7. Generate Notifications ──
  console.log('Generating notifications...');
  let totalNotifications = 0;

  for (const claim of claims.slice(-25)) {
    await run(
      `INSERT INTO notifications (userId, type, title, message, relatedId, relatedType, isRead, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [claim.donorId, 'claim_new', 'New Claim', 'An NGO has claimed your food listing.',
       claim.id, 'claim', Math.random() < 0.5 ? 1 : 0, isoStr(claim.claimDate)]
    );
    totalNotifications++;

    if (claim.status === 'collected') {
      const collectDate = new Date(claim.claimDate);
      collectDate.setHours(collectDate.getHours() + randInt(1, 6));
      await run(
        `INSERT INTO notifications (userId, type, title, message, relatedId, relatedType, isRead, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [claim.ngoId, 'claim_collected', 'Collection Confirmed', 'Food pickup has been confirmed.',
         claim.id, 'claim', Math.random() < 0.4 ? 1 : 0, isoStr(collectDate)]
      );
      totalNotifications++;
    }
  }
  console.log(`  ${totalNotifications} notifications created`);

  // ── 8. Gratitude Wall ──
  console.log('Creating gratitude wall entries...');
  const gratitudeEntries = [
    { name: 'Priya Sharma', msg: 'ReServe helped us redirect food from our wedding to shelters!', tier: 'gold' },
    { name: 'Sneha Foundation', msg: 'We\'ve collected over 200 meals through ReServe so far.', tier: 'silver' },
    { name: 'Delhi Food Bank', msg: 'ReServe is streamlining our collection process.', tier: 'gold' },
    { name: 'Ananya Singh', msg: 'Love the transparency and ease of use!', tier: 'bronze' },
    { name: 'Vikram Patel', msg: 'Our hotel donates surplus weekly now. ReServe makes it easy.', tier: 'silver' },
  ];

  for (const g of gratitudeEntries) {
    await run(
      `INSERT INTO gratitude_wall (displayName, message, tier, createdAt)
       VALUES (?, ?, ?, ?)`,
      [g.name, g.msg, g.tier, isoStr(daysAgo(randInt(5, 90)))]
    );
  }
  console.log(`  ${gratitudeEntries.length} gratitude entries created`);

  // ── Done ──
  console.log('\n========================================');
  console.log('  Seed complete!');
  console.log('========================================');
  console.log(`  Donors:        ${donorIds.length}`);
  console.log(`  NGOs:          ${ngoIds.length}`);
  console.log(`  Listings:      ${listings.length}`);
  console.log(`  Claims:        ${claims.length}`);
  console.log(`  Messages:      ${totalMessages}`);
  console.log(`  Reviews:       ${totalReviews}`);
  console.log(`  Notifications: ${totalNotifications}`);
  console.log(`  Gratitude:     ${gratitudeEntries.length}`);
  console.log('========================================');
  console.log('\nTest accounts (password: password123):');
  console.log(`  Donors: donor1@gmail.com ... donor${DONOR_PROFILES.length}@gmail.com`);
  console.log(`  NGOs:   ngo1@gmail.com   ... ngo${NGO_PROFILES.length}@gmail.com`);
  console.log('  Admin:  admin@reserve.org  / admin123');
  console.log('========================================\n');

  db.close();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  db.close();
  process.exit(1);
});
