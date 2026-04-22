const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('reserve.db');

const sql = `
  SELECT id, email, userType, isVerified, isActive
  FROM users
  WHERE userType = ?
    AND email LIKE ?
  ORDER BY email
`;

db.all(sql, ['driver', 'driver%@gmail.com'], (err, rows) => {
  if (err) {
    console.error('Query error:', err.message);
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(rows, null, 2));
  }

  db.close();
});
