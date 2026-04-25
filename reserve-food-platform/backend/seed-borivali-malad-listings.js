const { dbAll, dbGet, dbRun, closeDatabase } = require('./db/database');

function toIso(date) {
  return new Date(date).toISOString();
}

async function getOrCreateDonor() {
  const donor = await dbGet(
    `SELECT id, name
     FROM users
     WHERE userType = 'donor' AND isActive = 1
     ORDER BY isVerified DESC, id ASC
     LIMIT 1`
  );

  if (donor) return donor;

  const email = `map-demo-donor-${Date.now()}@reserve.local`;
  const result = await dbRun(
    `INSERT INTO users (name, email, password, userType, organizationName, isVerified, isActive)
     VALUES (?, ?, ?, 'donor', ?, 1, 1)`,
    ['Map Demo Donor', email, 'demo-password', 'Map Demo Kitchen']
  );

  return { id: result.lastID, name: 'Map Demo Donor' };
}

async function seed() {
  const donor = await getOrCreateDonor();
  const now = new Date();
  const availableFrom = new Date(now);
  availableFrom.setMinutes(availableFrom.getMinutes() - 15);

  const bestBefore = new Date(now);
  bestBefore.setHours(bestBefore.getHours() + 40);

  const rows = [
    {
      foodName: 'Borivali West Fresh Meal Pack',
      category: 'cooked-meals',
      foodType: 'vegetarian',
      quantity: 24,
      unit: 'kg',
      description: 'Guaranteed marker seed listing for Borivali West map testing.',
      pickupLocation: 'Borivali West, Mumbai',
      latitude: 19.2310,
      longitude: 72.8549,
    },
    {
      foodName: 'Malad West Community Food Box',
      category: 'snacks',
      foodType: 'vegetarian',
      quantity: 18,
      unit: 'kg',
      description: 'Guaranteed marker seed listing for Malad West map testing.',
      pickupLocation: 'Malad West, Mumbai',
      latitude: 19.1848,
      longitude: 72.8472,
    },
  ];

  for (const listing of rows) {
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
        listing.foodName,
        listing.category,
        listing.foodType,
        listing.quantity,
        listing.unit,
        listing.description,
        JSON.stringify([]),
        toIso(availableFrom),
        toIso(bestBefore),
        listing.pickupLocation,
        listing.latitude,
        listing.longitude,
        'room-temp',
        'container',
        toIso(now),
      ]
    );
  }

  const summary = await dbAll(
    `SELECT pickupLocation, COUNT(*) AS count
     FROM listings
     WHERE status = 'active'
       AND bestBefore > datetime('now')
       AND (pickupLocation LIKE '%Borivali West%' OR pickupLocation LIKE '%Malad West%')
     GROUP BY pickupLocation
     ORDER BY pickupLocation`
  );

  console.log(`Seeded test listings using donor ${donor.id} (${donor.name}).`);
  summary.forEach((row) => {
    console.log(`${row.pickupLocation}: ${row.count}`);
  });
}

seed()
  .catch((error) => {
    console.error('Failed to seed Borivali/Malad listings:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
