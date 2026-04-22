/**
 * Backfill platform-delivery claims that incorrectly show 0 km.
 * Run: node fix-zero-km-claims.js
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
      else resolve({ changes: this.changes });
    });
  });
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

async function main() {
  const rows = await all(`
    SELECT c.id, c.ngoLatitude, c.ngoLongitude, l.latitude as pickupLat, l.longitude as pickupLng
    FROM claims c
    JOIN listings l ON c.listingId = l.id
    WHERE c.deliveryMethod = 'platform-delivery'
      AND (c.deliveryDistance IS NULL OR c.deliveryDistance <= 0)
  `);

  let fixed = 0;
  let markedUnknown = 0;

  for (const r of rows) {
    const ngoLat = Number(r.ngoLatitude);
    const ngoLng = Number(r.ngoLongitude);
    const pickupLat = Number(r.pickupLat);
    const pickupLng = Number(r.pickupLng);

    if ([ngoLat, ngoLng, pickupLat, pickupLng].every(Number.isFinite)) {
      const distance = Math.round(haversineKm(pickupLat, pickupLng, ngoLat, ngoLng) * 10) / 10;
      const fee = Math.round(30 + distance * 8);
      await run('UPDATE claims SET deliveryDistance = ?, deliveryFee = ? WHERE id = ?', [distance, fee, r.id]);
      fixed++;
    } else {
      await run('UPDATE claims SET deliveryDistance = NULL, deliveryFee = 30 WHERE id = ?', [r.id]);
      markedUnknown++;
    }
  }

  console.log(`Checked: ${rows.length}`);
  console.log(`Distance recalculated: ${fixed}`);
  console.log(`Marked as unknown distance: ${markedUnknown}`);
  db.close();
}

main().catch((e) => {
  console.error(e.message);
  db.close();
  process.exit(1);
});
