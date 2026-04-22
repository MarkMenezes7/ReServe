const bcrypt = require('bcryptjs');
const { dbGet, dbRun, closeDatabase } = require('./db/database');

async function addDemoDrivers() {
  const basePassword = 'Password@123';
  const passwordHash = await bcrypt.hash(basePassword, 10);

  let created = 0;
  let skipped = 0;

  for (let i = 1; i <= 10; i += 1) {
    const email = `driver${i}@gmail.com`;
    const existing = await dbGet('SELECT id FROM users WHERE email = ?', [email]);

    if (existing) {
      skipped += 1;
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
        city,
        isVerified,
        isActive
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `Driver ${i}`,
        email,
        passwordHash,
        'driver',
        'ReServe Delivery Fleet',
        `90000000${String(i).padStart(2, '0')}`,
        'Mumbai',
        1,
        1,
      ]
    );

    created += 1;
  }

  console.log(`Drivers created: ${created}`);
  console.log(`Drivers skipped (already existed): ${skipped}`);
  console.log('Default password for all: Password@123');
}

addDemoDrivers()
  .catch((err) => {
    console.error('Failed to add demo drivers:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
