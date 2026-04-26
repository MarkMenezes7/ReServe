const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./reserve.db');
db.all("SELECT count(*) as count FROM users WHERE userType = 'Verified'", function(err, rows) {
  console.log("Remaining bad users:", rows);
  db.close();
});
