const { dbGet, dbAll, closeDatabase } = require('./db/database');
const LOCATION_FILTER = '%Mumbai%';
const CREATED_WINDOW = "-14 days";

async function verify() {
  const summary = await dbGet(
    `SELECT
       COUNT(*) as count,
       MIN(bestBefore) as earliestBestBefore,
       MAX(bestBefore) as latestBestBefore
     FROM listings
     WHERE pickupLocation LIKE ?
       AND datetime(createdAt) > datetime('now', ?)`,
    [LOCATION_FILTER, CREATED_WINDOW]
  );

  const sample = await dbAll(
    `SELECT id, donorId, foodName, pickupLocation, bestBefore, status
     FROM listings
     WHERE pickupLocation LIKE ?
       AND datetime(createdAt) > datetime('now', ?)
     ORDER BY id DESC
     LIMIT 15`,
    [LOCATION_FILTER, CREATED_WINDOW]
  );

  const stillFreshAfter16h = await dbGet(
    `SELECT COUNT(*) as count
     FROM listings
     WHERE pickupLocation LIKE ?
       AND datetime(createdAt) > datetime('now', ?)
       AND datetime(bestBefore) > datetime('now', '+16 hours')`,
    [LOCATION_FILTER, CREATED_WINDOW]
  );

  console.log(JSON.stringify({ summary, stillFreshAfter16h, sample }, null, 2));
}

verify()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
