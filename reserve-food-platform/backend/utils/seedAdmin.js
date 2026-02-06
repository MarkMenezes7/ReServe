const bcrypt = require('bcryptjs');
const { dbGet, dbRun } = require('../db/database');

async function seedAdmin() {
  try {
    const admin = await dbGet("SELECT id FROM users WHERE userType = 'admin' LIMIT 1");
    if (!admin) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await dbRun(
        `INSERT INTO users (name, email, password, userType, organizationName, isVerified, isActive)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['Admin', 'admin@reserve.org', hashedPassword, 'admin', 'ReServe Platform', 1, 1]
      );
      console.log('Admin user seeded: admin@reserve.org / admin123');
    }
  } catch (err) {
    console.error('Error seeding admin:', err.message);
  }
}

module.exports = { seedAdmin };
