const { dbAll, closeDatabase } = require('./db/database');

async function run() {
  const rows = await dbAll(
    `SELECT pickupLocation, COUNT(*) AS count
     FROM listings
     WHERE status = 'active'
       AND bestBefore > datetime('now')
       AND (pickupLocation LIKE '%Borivali West%' OR pickupLocation LIKE '%Malad West%')
     GROUP BY pickupLocation
     ORDER BY pickupLocation`
  );

  console.log('Active listings in target areas:');
  if (!rows.length) {
    console.log('None found');
    return;
  }

  rows.forEach((row) => {
    console.log(`${row.pickupLocation}: ${row.count}`);
  });
}

run()
  .catch((error) => {
    console.error('Verification failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
