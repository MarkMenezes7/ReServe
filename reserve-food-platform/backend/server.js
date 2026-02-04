const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 5000;
const JWT_SECRET = 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());

// Initialize SQLite Database
const db = new sqlite3.Database('./reserve.db', (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize Database Tables
function initializeDatabase() {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
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
      isVerified INTEGER DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating users table:', err);
    } else {
      console.log('Users table ready');
    }
  });

  // Listings table
  db.run(`
    CREATE TABLE IF NOT EXISTS listings (
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
      status TEXT DEFAULT 'active',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (donorId) REFERENCES users(id)
    )
  `);

  // Claims table
  db.run(`
    CREATE TABLE IF NOT EXISTS claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listingId INTEGER NOT NULL,
      ngoId INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      scheduledTime DATETIME,
      collectedAt DATETIME,
      quantity REAL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (listingId) REFERENCES listings(id),
      FOREIGN KEY (ngoId) REFERENCES users(id)
    )
  `);

  // Reviews table
  db.run(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      claimId INTEGER NOT NULL,
      reviewerId INTEGER NOT NULL,
      revieweeId INTEGER NOT NULL,
      foodQuality INTEGER,
      communication INTEGER,
      timeliness INTEGER,
      overall INTEGER,
      comment TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (claimId) REFERENCES claims(id)
    )
  `);
}

// ============== AUTH ROUTES ==============

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, userType, organizationName } = req.body;

    // Validation
    if (!name || !email || !password || !userType) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!['donor', 'ngo'].includes(userType)) {
      return res.status(400).json({ error: 'Invalid user type' });
    }

    // Check if user exists
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, existingUser) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (existingUser) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert user
      const query = `
        INSERT INTO users (name, email, password, userType, organizationName)
        VALUES (?, ?, ?, ?, ?)
      `;

      db.run(query, [name, email, hashedPassword, userType, organizationName], function(err) {
        if (err) {
          console.error('Insert error:', err);
          return res.status(500).json({ error: 'Failed to create account' });
        }

        const userId = this.lastID;

        // Generate token
        const token = jwt.sign(
          { userId, email, userType },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        res.status(201).json({
          message: 'Account created successfully',
          token,
          user: {
            id: userId,
            name,
            email,
            userType,
            organizationName
          }
        });
      });
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Check password
      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Generate token
      const token = jwt.sign(
        { userId: user.id, email: user.email, userType: user.userType },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          userType: user.userType,
          organizationName: user.organizationName
        }
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============== DONOR ROUTES ==============

// Get donor stats
app.get('/api/donor/stats/:userId', (req, res) => {
  const { userId } = req.params;

  const stats = {
    totalDonations: 0,
    activeListings: 0,
    totalClaims: 0,
    foodSaved: 0
  };

  // Get listing counts
  db.get(
    'SELECT COUNT(*) as total FROM listings WHERE donorId = ?',
    [userId],
    (err, result) => {
      if (result) stats.totalDonations = result.total;

      db.get(
        'SELECT COUNT(*) as active FROM listings WHERE donorId = ? AND status = "active"',
        [userId],
        (err, result) => {
          if (result) stats.activeListings = result.active;

          db.get(
            'SELECT COUNT(*) as claims FROM claims c JOIN listings l ON c.listingId = l.id WHERE l.donorId = ?',
            [userId],
            (err, result) => {
              if (result) stats.totalClaims = result.claims;

              db.get(
                'SELECT SUM(quantity) as saved FROM listings WHERE donorId = ? AND status = "collected"',
                [userId],
                (err, result) => {
                  if (result && result.saved) stats.foodSaved = result.saved;
                  res.json(stats);
                }
              );
            }
          );
        }
      );
    }
  );
});

// Get donor listings
app.get('/api/donor/listings/:userId', (req, res) => {
  const { userId } = req.params;
  const { status } = req.query;

  // Auto-mark expired listings
  db.run(
    `UPDATE listings SET status = 'expired'
     WHERE status = 'active' AND datetime(bestBefore) <= datetime('now')`
  );

  let query = 'SELECT * FROM listings WHERE donorId = ?';
  const params = [userId];

  if (status && status !== 'all') {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY createdAt DESC';

  db.all(query, params, (err, listings) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(listings || []);
  });
});

// Get donor claims (claims on donor listings)
app.get('/api/donor/claims/:userId', (req, res) => {
  const { userId } = req.params;

  const query = `
    SELECT c.*, l.foodName, l.unit, l.pickupLocation, u.name as ngoName, u.organizationName
    FROM claims c
    JOIN listings l ON c.listingId = l.id
    JOIN users u ON c.ngoId = u.id
    WHERE l.donorId = ?
    ORDER BY c.createdAt DESC
  `;

  db.all(query, [userId], (err, claims) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(claims || []);
  });
});

// Create listing
app.post('/api/donor/listings', (req, res) => {
  const {
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
    longitude
  } = req.body;

  const query = `
    INSERT INTO listings (
      donorId, foodName, category, foodType, quantity, unit,
      description, images, availableFrom, bestBefore,
      pickupLocation, latitude, longitude
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
    query,
    [
      donorId, foodName, category, foodType, quantity, unit,
      description, JSON.stringify(images), availableFrom, bestBefore,
      pickupLocation, latitude, longitude
    ],
    function(err) {
      if (err) {
        console.error('Create listing error:', err);
        return res.status(500).json({ error: 'Failed to create listing' });
      }
      res.status(201).json({
        message: 'Listing created successfully',
        listingId: this.lastID
      });
    }
  );
});

// ============== NGO ROUTES ==============

// Get NGO stats
app.get('/api/ngo/stats/:userId', (req, res) => {
  const { userId } = req.params;

  const stats = {
    totalCollections: 0,
    activeClaims: 0,
    foodCollected: 0,
    peopleFed: 0
  };

  db.get(
    'SELECT COUNT(*) as total FROM claims WHERE ngoId = ? AND status = "collected"',
    [userId],
    (err, result) => {
      if (result) stats.totalCollections = result.total;

      db.get(
        'SELECT COUNT(*) as active FROM claims WHERE ngoId = ? AND status IN ("pending", "confirmed")',
        [userId],
        (err, result) => {
          if (result) stats.activeClaims = result.active;

          db.get(
            'SELECT SUM(c.quantity) as collected FROM claims c WHERE c.ngoId = ? AND c.status = "collected"',
            [userId],
            (err, result) => {
              if (result && result.collected) {
                stats.foodCollected = result.collected;
                stats.peopleFed = Math.floor(result.collected * 2.5); // Estimate: 1kg feeds 2.5 people
              }
              res.json(stats);
            }
          );
        }
      );
    }
  );
});

// Get available listings for NGO
app.get('/api/ngo/listings', (req, res) => {
  const query = `
    SELECT l.*, u.name as donorName, u.organizationName
    FROM listings l
    JOIN users u ON l.donorId = u.id
    WHERE l.status = 'active' AND datetime(l.bestBefore) > datetime('now')
    ORDER BY l.bestBefore ASC
  `;

  db.all(query, [], (err, listings) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(listings || []);
  });
});

// Claim listing
app.post('/api/ngo/claim', (req, res) => {
  const { listingId, ngoId, scheduledTime } = req.body;

  // First check if listing is still available
  db.get('SELECT * FROM listings WHERE id = ? AND status = "active"', [listingId], (err, listing) => {
    if (err || !listing) {
      return res.status(400).json({ error: 'Listing not available' });
    }

    const query = `
      INSERT INTO claims (listingId, ngoId, scheduledTime, quantity)
      VALUES (?, ?, ?, ?)
    `;

    db.run(query, [listingId, ngoId, scheduledTime, listing.quantity], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to claim listing' });
      }

      // Update listing status
      db.run('UPDATE listings SET status = ? WHERE id = ?', ['claimed', listingId]);

      res.status(201).json({
        message: 'Listing claimed successfully',
        claimId: this.lastID
      });
    });
  });
});

// Mark claim as collected (donor or NGO)
app.patch('/api/claims/:claimId/collect', (req, res) => {
  const { claimId } = req.params;

  db.get('SELECT * FROM claims WHERE id = ?', [claimId], (err, claim) => {
    if (err || !claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    db.run(
      'UPDATE claims SET status = ?, collectedAt = datetime("now") WHERE id = ?',
      ['collected', claimId],
      (updateErr) => {
        if (updateErr) {
          return res.status(500).json({ error: 'Failed to update claim' });
        }

        db.run(
          'UPDATE listings SET status = ? WHERE id = ?',
          ['collected', claim.listingId],
          () => {
            res.json({ message: 'Claim marked as collected' });
          }
        );
      }
    );
  });
});

// Get NGO claims
app.get('/api/ngo/claims/:userId', (req, res) => {
  const { userId } = req.params;

  const query = `
    SELECT c.*, l.*, u.name as donorName, u.organizationName, u.phone
    FROM claims c
    JOIN listings l ON c.listingId = l.id
    JOIN users u ON l.donorId = u.id
    WHERE c.ngoId = ?
    ORDER BY c.createdAt DESC
  `;

  db.all(query, [userId], (err, claims) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(claims || []);
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});
