const bcrypt = require('bcryptjs');
const { dbAll, dbRun, dbGet, closeDatabase } = require('./db/database');

const MUMBAI_AREAS = [
  { name: 'Borivali West', lat: 19.2320, lng: 72.8560 },
  { name: 'Borivali East', lat: 19.2292, lng: 72.8642 },
  { name: 'Kandivali West', lat: 19.2058, lng: 72.8510 },
  { name: 'Malad West', lat: 19.1867, lng: 72.8489 },
  { name: 'Goregaon West', lat: 19.1663, lng: 72.8526 },
  { name: 'Andheri West', lat: 19.1364, lng: 72.8296 },
  { name: 'Andheri East', lat: 19.1136, lng: 72.8697 },
  { name: 'Vile Parle', lat: 19.1000, lng: 72.8500 },
  { name: 'Bandra West', lat: 19.0596, lng: 72.8295 },
  { name: 'Dadar West', lat: 19.0178, lng: 72.8478 },
  { name: 'Marine Lines', lat: 18.9442, lng: 72.8231 },
  { name: 'Charni Road', lat: 18.9528, lng: 72.8150 },
  { name: 'Churchgate', lat: 18.9350, lng: 72.8270 },
];

const FOOD_TEMPLATES = [
  {
    foodName: 'Fresh Veg Meal Combo',
    category: 'cooked-meals',
    foodType: 'vegetarian',
    quantity: 14,
    unit: 'servings',
    storageType: 'refrigerated',
    packagingType: 'container',
    description: 'Packed veg meal combo prepared in the last service window.',
  },
  {
    foodName: 'Bakery Bread and Bun Pack',
    category: 'bakery',
    foodType: 'vegetarian',
    quantity: 18,
    unit: 'pieces',
    storageType: 'room-temp',
    packagingType: 'wrapped',
    description: 'Fresh bread loaves and buns from today\'s baking cycle.',
  },
  {
    foodName: 'Seasonal Fruit Crate',
    category: 'fruits-vegetables',
    foodType: 'vegan',
    quantity: 9,
    unit: 'kg',
    storageType: 'refrigerated',
    packagingType: 'boxed',
    description: 'Mixed seasonal fruit suitable for same-day and next-day distribution.',
  },
  {
    foodName: 'Rice and Dal Essentials',
    category: 'grains-staples',
    foodType: 'vegan',
    quantity: 10,
    unit: 'kg',
    storageType: 'room-temp',
    packagingType: 'sealed-pack',
    description: 'Dry staple packs in donation-ready condition.',
  },
  {
    foodName: 'Dairy Combo (Milk and Curd)',
    category: 'dairy',
    foodType: 'vegetarian',
    quantity: 7,
    unit: 'litres',
    storageType: 'refrigerated',
    packagingType: 'sealed-pack',
    description: 'Fresh dairy combo with proper cold-chain handling.',
  },
  {
    foodName: 'Snack Box (Sandwich and Cutlet)',
    category: 'snacks',
    foodType: 'vegetarian',
    quantity: 20,
    unit: 'pieces',
    storageType: 'refrigerated',
    packagingType: 'boxed',
    description: 'Prepared snack boxes from event catering surplus.',
  },
  {
    foodName: 'Ready Beverage Packs',
    category: 'beverages',
    foodType: 'vegan',
    quantity: 12,
    unit: 'litres',
    storageType: 'room-temp',
    packagingType: 'sealed-pack',
    description: 'Sealed beverage packs, safe for rapid distribution.',
  },
];

function toIso(date) {
  return new Date(date).toISOString();
}

function getMumbaiAreaById(idLike) {
  return MUMBAI_AREAS[idLike % MUMBAI_AREAS.length];
}

function donorEmail(index) {
  return `donor${index}@gmail.com`;
}

function donorNumberFromEmail(email) {
  const match = email.match(/^donor(\d+)@gmail\.com$/);
  return match ? Number(match[1]) : null;
}

async function getVerifiedDonorsByEmailRange() {
  return dbAll(
    `SELECT id, name, email
     FROM users
     WHERE userType = 'donor'
       AND isActive = 1
       AND isVerified = 1
       AND email LIKE 'donor%@gmail.com'
     ORDER BY id ASC`
  );
}

async function ensureDonor1To25Accounts() {
  const hashedPassword = await bcrypt.hash('password123', 10);

  for (let i = 1; i <= 25; i += 1) {
    const email = donorEmail(i);
    const existing = await dbGet(
      `SELECT id, userType
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email]
    );

    const area = getMumbaiAreaById(i);
    const address = `${area.name}, Mumbai`;

    if (existing && existing.userType === 'donor') {
      await dbRun(
        `UPDATE users
         SET isActive = 1,
             isVerified = 1,
             city = 'Mumbai',
             state = 'Maharashtra',
             address = ?,
             organizationName = COALESCE(organizationName, ?)
         WHERE id = ?`,
        [address, `Mumbai Donor Org ${i}`, existing.id]
      );
      continue;
    }

    if (existing && existing.userType !== 'donor') {
      continue;
    }

    await dbRun(
      `INSERT INTO users (
        name,
        email,
        password,
        userType,
        organizationName,
        phone,
        address,
        city,
        state,
        bio,
        isVerified,
        isActive,
        createdAt
      ) VALUES (?, ?, ?, 'donor', ?, ?, ?, 'Mumbai', 'Maharashtra', ?, 1, 1, datetime('now'))`,
      [
        `Donor ${i}`,
        email,
        hashedPassword,
        `Mumbai Donor Org ${i}`,
        `+91 90000${String(i).padStart(5, '0')}`,
        address,
        `Presentation donor account ${i} focused on Mumbai operations.`,
      ]
    );
  }
}

async function getVerifiedNgos() {
  return dbAll(
    `SELECT id, name, email
     FROM users
     WHERE userType = 'ngo' AND isActive = 1 AND isVerified = 1
     ORDER BY id ASC`
  );
}

async function normalizeUsersToMumbai(donors, ngos) {
  for (const donor of donors) {
    const area = getMumbaiAreaById(donor.id + 3);
    await dbRun(
      `UPDATE users
       SET city = 'Mumbai',
           state = 'Maharashtra',
           address = ?
       WHERE id = ?`,
      [`${area.name}, Mumbai`, donor.id]
    );
  }

  for (const ngo of ngos) {
    const area = getMumbaiAreaById(ngo.id + 7);
    await dbRun(
      `UPDATE users
       SET city = 'Mumbai',
           state = 'Maharashtra',
           address = ?
       WHERE id = ?`,
      [`${area.name}, Mumbai`, ngo.id]
    );
  }
}

async function listingAlreadySeeded(donorId, foodName, pickupLocation) {
  const rows = await dbAll(
    `SELECT id
     FROM listings
     WHERE donorId = ?
       AND foodName = ?
       AND pickupLocation = ?
       AND datetime(createdAt) > datetime('now', '-14 days')
     LIMIT 1`,
    [donorId, foodName, pickupLocation]
  );
  return rows.length > 0;
}

async function getActiveListingIds(donorId) {
  return dbAll(
    `SELECT id
     FROM listings
     WHERE donorId = ? AND status = 'active'
     ORDER BY datetime(createdAt) DESC, id DESC`,
    [donorId]
  );
}

async function createMumbaiListing(donor, template, area, templateIdx, sequenceOffset) {
  const now = new Date();
  const pickupLocation = `${area.name}, Mumbai`;

  const availableFrom = new Date(now);
  availableFrom.setMinutes(availableFrom.getMinutes() - (8 + (sequenceOffset * 4)));

  const bestBefore = new Date(now);
  bestBefore.setHours(bestBefore.getHours() + 34 + ((templateIdx + sequenceOffset) % 10) * 2);

  const createdAt = new Date(now);
  createdAt.setMinutes(createdAt.getMinutes() - (templateIdx % 60));

  const quantity = template.quantity + ((templateIdx + donor.id + sequenceOffset) % 4);
  const latOffset = ((donor.id % 5) - 2) * 0.0012;
  const lngOffset = ((templateIdx % 5) - 2) * 0.0011;

  await dbRun(
    `INSERT INTO listings (
      donorId,
      foodName,
      category,
      foodType,
      quantity,
      unit,
      description,
      images,
      availableFrom,
      bestBefore,
      pickupLocation,
      latitude,
      longitude,
      storageType,
      packagingType,
      status,
      createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    [
      donor.id,
      template.foodName,
      template.category,
      template.foodType,
      quantity,
      template.unit,
      template.description,
      JSON.stringify([]),
      toIso(availableFrom),
      toIso(bestBefore),
      pickupLocation,
      Number((area.lat + latOffset).toFixed(6)),
      Number((area.lng + lngOffset).toFixed(6)),
      template.storageType,
      template.packagingType,
      toIso(createdAt),
    ]
  );
}

async function seedMumbaiListings() {
  await ensureDonor1To25Accounts();

  const donors = await getVerifiedDonorsByEmailRange();
  const ngos = await getVerifiedNgos();

  const targetDonors = donors.filter((d) => {
    const match = d.email.match(/^donor(\d+)@gmail\.com$/);
    if (!match) return false;
    const idx = Number(match[1]);
    return idx >= 1 && idx <= 25;
  });

  if (!targetDonors.length) {
    throw new Error('No verified active donors found in donor1@gmail.com to donor25@gmail.com.');
  }

  if (!ngos.length) {
    throw new Error('No verified active NGOs found.');
  }

  console.log(`Found ${targetDonors.length} verified active donors (donor1..donor25).`);
  console.log(`Found ${ngos.length} verified active NGOs.`);

  await normalizeUsersToMumbai(targetDonors, ngos);
  console.log('Updated donor/NGO profile locations to Mumbai, Maharashtra.');

  const now = new Date();
  let areaIdx = 0;
  let templateIdx = 0;
  let created = 0;
  let deactivated = 0;

  for (const donor of targetDonors) {
    const donorNo = donorNumberFromEmail(donor.email);
    const perDonor = donorNo && donorNo % 2 === 0 ? 2 : 3;

    const existingActive = await getActiveListingIds(donor.id);

    if (existingActive.length > perDonor) {
      const toDeactivate = existingActive.slice(perDonor);
      for (const row of toDeactivate) {
        await dbRun(`UPDATE listings SET status = 'completed' WHERE id = ?`, [row.id]);
      }
      deactivated += toDeactivate.length;
    }

    const activeAfterTrim = await getActiveListingIds(donor.id);
    const missing = Math.max(0, perDonor - activeAfterTrim.length);

    for (let i = 0; i < missing; i += 1) {
      const template = FOOD_TEMPLATES[templateIdx % FOOD_TEMPLATES.length];
      const area = MUMBAI_AREAS[areaIdx % MUMBAI_AREAS.length];
      await createMumbaiListing(donor, template, area, templateIdx, i);

      created += 1;
      templateIdx += 1;
      areaIdx += 1;
    }
  }

  console.log('----------------------------------------');
  console.log(`Created listings: ${created}`);
  console.log(`Deactivated extra active listings: ${deactivated}`);
  console.log(`Donors covered: ${targetDonors.length}`);
  console.log(`NGOs normalized to Mumbai: ${ngos.length}`);
  console.log('Areas used: Borivali-Andheri-Churchgate side zones only');
  console.log('All seeded listings are active and set with future best-before windows.');
  console.log('----------------------------------------');
}

seedMumbaiListings()
  .catch((err) => {
    console.error('Failed to seed Mumbai listings:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
