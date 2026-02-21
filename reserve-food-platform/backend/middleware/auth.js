const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const { dbGet } = require('../db/database');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.userType)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

function requireVerified(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  dbGet('SELECT isVerified FROM users WHERE id = ?', [req.user.userId])
    .then(user => {
      if (!user) return res.status(404).json({ error: 'User not found' });
      if (!user.isVerified) {
        return res.status(403).json({ error: 'Account not verified. Please wait for admin approval before performing this action.' });
      }
      next();
    })
    .catch(err => {
      console.error('Verification check error:', err);
      res.status(500).json({ error: 'Verification check failed' });
    });
}

module.exports = { authenticateToken, requireRole, requireVerified };
