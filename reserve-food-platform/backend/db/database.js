const sqlite3 = require('sqlite3').verbose();
const { DB_PATH } = require('../config');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to SQLite database');
    db.run('PRAGMA journal_mode=WAL');
    db.run('PRAGMA foreign_keys=ON');
  }
});

// Promise wrappers
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function initializeDatabase() {
  db.serialize(() => {
    // Users
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      userType TEXT NOT NULL,
      organizationName TEXT,
      phone TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      pincode TEXT,
      bio TEXT,
      profileImage TEXT,
      isVerified INTEGER DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Listings
    db.run(`CREATE TABLE IF NOT EXISTS listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donorId INTEGER NOT NULL,
      foodName TEXT NOT NULL,
      category TEXT NOT NULL,
      foodType TEXT,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      description TEXT,
      images TEXT,
      availableFrom DATETIME NOT NULL,
      bestBefore DATETIME NOT NULL,
      pickupLocation TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      storageType TEXT DEFAULT 'room-temp',
      packagingType TEXT,
      handlingInstructions TEXT,
      status TEXT DEFAULT 'active',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (donorId) REFERENCES users(id)
    )`);

    // Claims
    db.run(`CREATE TABLE IF NOT EXISTS claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listingId INTEGER NOT NULL,
      ngoId INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      scheduledTime DATETIME,
      collectedAt DATETIME,
      quantity REAL,
      cancelReason TEXT,
      proofImage TEXT,
      deliveryMethod TEXT DEFAULT 'self-pickup',
      deliveryFee REAL DEFAULT 0,
      deliveryStatus TEXT DEFAULT NULL,
      deliveryDistance REAL DEFAULT 0,
      paymentUpiId TEXT,
      paymentTransactionId TEXT,
      paymentScreenshotUrl TEXT,
      paymentStatus TEXT DEFAULT 'not-required',
      paymentVerifiedBy INTEGER,
      paymentVerifiedAt DATETIME,
      paymentRejectReason TEXT,
      ngoLatitude REAL,
      ngoLongitude REAL,
      driverId INTEGER,
      driverCurrentLat REAL,
      driverCurrentLng REAL,
      driverRouteProgress REAL DEFAULT 0,
      driverRouteStage TEXT,
      dispatchedAt DATETIME,
      deliveredAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (listingId) REFERENCES listings(id),
      FOREIGN KEY (ngoId) REFERENCES users(id),
      FOREIGN KEY (driverId) REFERENCES users(id),
      FOREIGN KEY (paymentVerifiedBy) REFERENCES users(id)
    )`);

    // Reviews
    db.run(`CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      claimId INTEGER NOT NULL,
      reviewerId INTEGER NOT NULL,
      revieweeId INTEGER NOT NULL,
      foodQuality INTEGER,
      communication INTEGER,
      timeliness INTEGER,
      overall INTEGER,
      comment TEXT,
      isAnonymous INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (claimId) REFERENCES claims(id),
      FOREIGN KEY (reviewerId) REFERENCES users(id),
      FOREIGN KEY (revieweeId) REFERENCES users(id)
    )`);

    // Messages
    db.run(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      claimId INTEGER NOT NULL,
      senderId INTEGER NOT NULL,
      receiverId INTEGER NOT NULL,
      content TEXT NOT NULL,
      messageType TEXT DEFAULT 'text',
      imageUrl TEXT,
      isRead INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (claimId) REFERENCES claims(id),
      FOREIGN KEY (senderId) REFERENCES users(id),
      FOREIGN KEY (receiverId) REFERENCES users(id)
    )`);

    // Notifications
    db.run(`CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      relatedId INTEGER,
      relatedType TEXT,
      isRead INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id)
    )`);

    // Contact messages
    db.run(`CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      organization TEXT,
      interestType TEXT,
      subject TEXT,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'new',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Wall of gratitude
    db.run(`CREATE TABLE IF NOT EXISTS gratitude_wall (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      displayName TEXT NOT NULL,
      message TEXT,
      amount REAL,
      tier TEXT,
      isVisible INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id)
    )`);

    // Verification requests
    db.run(`CREATE TABLE IF NOT EXISTS verification_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      businessName TEXT,
      businessType TEXT,
      fssaiNumber TEXT,
      gstNumber TEXT,
      description TEXT,
      certificateDetails TEXT,
      documentUrl TEXT,
      status TEXT DEFAULT 'pending',
      adminNotes TEXT,
      reviewedBy INTEGER,
      submittedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      reviewedAt DATETIME,
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (reviewedBy) REFERENCES users(id)
    )`);

    // Add documentUrl column to verification_requests if missing (migration-safe)
    db.all("PRAGMA table_info(verification_requests)", (err, cols) => {
      if (!err && cols) {
        const colNames = cols.map(c => c.name);
        if (!colNames.includes('documentUrl')) {
          db.run("ALTER TABLE verification_requests ADD COLUMN documentUrl TEXT", () => {});
        }
      }
    });

    // Add columns to existing messages table if they don't exist (migration-safe)
    db.all("PRAGMA table_info(messages)", (err, cols) => {
      if (!err && cols) {
        const colNames = cols.map(c => c.name);
        if (!colNames.includes('messageType')) {
          db.run("ALTER TABLE messages ADD COLUMN messageType TEXT DEFAULT 'text'", () => {});
        }
        if (!colNames.includes('imageUrl')) {
          db.run("ALTER TABLE messages ADD COLUMN imageUrl TEXT", () => {});
        }
        if (!colNames.includes('isRead')) {
          db.run("ALTER TABLE messages ADD COLUMN isRead INTEGER DEFAULT 0", () => {});
        }
      }
    });

    // Add columns to existing users table if they don't exist
    db.all("PRAGMA table_info(users)", (err, cols) => {
      if (!err && cols) {
        const colNames = cols.map(c => c.name);
        if (!colNames.includes('bio')) {
          db.run("ALTER TABLE users ADD COLUMN bio TEXT", () => {});
        }
        if (!colNames.includes('profileImage')) {
          db.run("ALTER TABLE users ADD COLUMN profileImage TEXT", () => {});
        }
        if (!colNames.includes('latitude')) {
          db.run("ALTER TABLE users ADD COLUMN latitude REAL", () => {});
        }
        if (!colNames.includes('longitude')) {
          db.run("ALTER TABLE users ADD COLUMN longitude REAL", () => {});
        }
      }
    });

    // Add columns to existing listings table if they don't exist
    db.all("PRAGMA table_info(listings)", (err, cols) => {
      if (!err && cols) {
        const colNames = cols.map(c => c.name);
        if (!colNames.includes('storageType')) {
          db.run("ALTER TABLE listings ADD COLUMN storageType TEXT DEFAULT 'room-temp'", () => {});
        }
        if (!colNames.includes('packagingType')) {
          db.run("ALTER TABLE listings ADD COLUMN packagingType TEXT", () => {});
        }
        if (!colNames.includes('handlingInstructions')) {
          db.run("ALTER TABLE listings ADD COLUMN handlingInstructions TEXT", () => {});
        }
      }
    });

    // Add columns to existing claims table if they don't exist
    db.all("PRAGMA table_info(claims)", (err, cols) => {
      if (!err && cols) {
        const colNames = cols.map(c => c.name);
        if (!colNames.includes('cancelReason')) {
          db.run("ALTER TABLE claims ADD COLUMN cancelReason TEXT", () => {});
        }
        if (!colNames.includes('proofImage')) {
          db.run("ALTER TABLE claims ADD COLUMN proofImage TEXT", () => {});
        }
        if (!colNames.includes('deliveryMethod')) {
          db.run("ALTER TABLE claims ADD COLUMN deliveryMethod TEXT DEFAULT 'self-pickup'", () => {});
        }
        if (!colNames.includes('deliveryFee')) {
          db.run("ALTER TABLE claims ADD COLUMN deliveryFee REAL DEFAULT 0", () => {});
        }
        if (!colNames.includes('deliveryStatus')) {
          db.run("ALTER TABLE claims ADD COLUMN deliveryStatus TEXT DEFAULT NULL", () => {});
        }
        if (!colNames.includes('deliveryDistance')) {
          db.run("ALTER TABLE claims ADD COLUMN deliveryDistance REAL DEFAULT 0", () => {});
        }
        if (!colNames.includes('paymentUpiId')) {
          db.run("ALTER TABLE claims ADD COLUMN paymentUpiId TEXT", () => {});
        }
        if (!colNames.includes('paymentTransactionId')) {
          db.run("ALTER TABLE claims ADD COLUMN paymentTransactionId TEXT", () => {});
        }
        if (!colNames.includes('paymentScreenshotUrl')) {
          db.run("ALTER TABLE claims ADD COLUMN paymentScreenshotUrl TEXT", () => {});
        }
        if (!colNames.includes('paymentStatus')) {
          db.run("ALTER TABLE claims ADD COLUMN paymentStatus TEXT DEFAULT 'not-required'", () => {});
        }
        if (!colNames.includes('paymentVerifiedBy')) {
          db.run("ALTER TABLE claims ADD COLUMN paymentVerifiedBy INTEGER", () => {});
        }
        if (!colNames.includes('paymentVerifiedAt')) {
          db.run("ALTER TABLE claims ADD COLUMN paymentVerifiedAt DATETIME", () => {});
        }
        if (!colNames.includes('paymentRejectReason')) {
          db.run("ALTER TABLE claims ADD COLUMN paymentRejectReason TEXT", () => {});
        }
        if (!colNames.includes('ngoLatitude')) {
          db.run("ALTER TABLE claims ADD COLUMN ngoLatitude REAL", () => {});
        }
        if (!colNames.includes('ngoLongitude')) {
          db.run("ALTER TABLE claims ADD COLUMN ngoLongitude REAL", () => {});
        }
        if (!colNames.includes('driverId')) {
          db.run("ALTER TABLE claims ADD COLUMN driverId INTEGER", () => {});
        }
        if (!colNames.includes('driverCurrentLat')) {
          db.run("ALTER TABLE claims ADD COLUMN driverCurrentLat REAL", () => {});
        }
        if (!colNames.includes('driverCurrentLng')) {
          db.run("ALTER TABLE claims ADD COLUMN driverCurrentLng REAL", () => {});
        }
        if (!colNames.includes('driverRouteProgress')) {
          db.run("ALTER TABLE claims ADD COLUMN driverRouteProgress REAL DEFAULT 0", () => {});
        }
        if (!colNames.includes('driverRouteStage')) {
          db.run("ALTER TABLE claims ADD COLUMN driverRouteStage TEXT", () => {});
        }
        if (!colNames.includes('dispatchedAt')) {
          db.run("ALTER TABLE claims ADD COLUMN dispatchedAt DATETIME", () => {});
        }
        if (!colNames.includes('deliveredAt')) {
          db.run("ALTER TABLE claims ADD COLUMN deliveredAt DATETIME", () => {});
        }
      }
    });

    // Add columns to existing reviews table if they don't exist
    db.all("PRAGMA table_info(reviews)", (err, cols) => {
      if (!err && cols) {
        const colNames = cols.map(c => c.name);
        if (!colNames.includes('isAnonymous')) {
          db.run("ALTER TABLE reviews ADD COLUMN isAnonymous INTEGER DEFAULT 0", () => {});
        }
      }
    });

    console.log('Database tables initialized');
  });
}

function closeDatabase() {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

module.exports = { db, dbRun, dbGet, dbAll, initializeDatabase, closeDatabase };
