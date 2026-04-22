const { dbAll, dbRun, closeDatabase } = require('./db/database');

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

async function getVerifiedDonors() {
  return dbAll(
    `SELECT id, name, email
     FROM users
     WHERE userType = 'donor' AND isActive = 1 AND isVerified = 1
     ORDER BY id ASC`
  );
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

async function seedMumbaiListings() {
  const donors = await getVerifiedDonors();
  if (!donors.length) {
    throw new Error('No verified active donors found.');
  }

  console.log(`Found ${donors.length} verified active donors.`);

  const now = new Date();
  let areaIdx = 0;
  let templateIdx = 0;
  let created = 0;
  let skipped = 0;

  for (const donor of donors) {
    const perDonor = donor.id % 2 === 0 ? 2 : 3;

    for (let i = 0; i < perDonor; i += 1) {
      const template = FOOD_TEMPLATES[templateIdx % FOOD_TEMPLATES.length];
      const area = MUMBAI_AREAS[areaIdx % MUMBAI_AREAS.length];

      const pickupLocation = `${area.name}, Mumbai`;

      const exists = await listingAlreadySeeded(donor.id, template.foodName, pickupLocation);
      if (exists) {
        skipped += 1;
        templateIdx += 1;
        areaIdx += 1;
        continue;
      }

      const availableFrom = new Date(now);
      availableFrom.setMinutes(availableFrom.getMinutes() - (5 + (i * 3)));

      // Demo-safe window: 34 to 52 hours from now, so it is still active tomorrow.
      const bestBefore = new Date(now);
      bestBefore.setHours(bestBefore.getHours() + 34 + ((templateIdx + i) % 10) * 2);

      const createdAt = new Date(now);
      createdAt.setMinutes(createdAt.getMinutes() - (templateIdx % 120));

      const quantity = template.quantity + ((templateIdx + donor.id + i) % 4);
      const latOffset = ((donor.id % 5) - 2) * 0.0012;
      const lngOffset = ((templateIdx % 5) - 2) * 0.0011;

      const description = template.description;

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
          description,
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

      created += 1;
      templateIdx += 1;
      areaIdx += 1;
    }
  }

  console.log('----------------------------------------');
  console.log(`Created listings: ${created}`);
  console.log(`Skipped duplicates: ${skipped}`);
  console.log(`Donors covered: ${donors.length}`);
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
