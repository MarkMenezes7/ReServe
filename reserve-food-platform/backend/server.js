const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const { PORT, CORS_ORIGIN } = require('./config');
const { initializeDatabase, closeDatabase } = require('./db/database');
const { seedAdmin } = require('./utils/seedAdmin');
const { setupSocketHandlers } = require('./sockets/chat');

// Route modules
const authRoutes = require('./routes/auth');
const donorRoutes = require('./routes/donor');
const ngoRoutes = require('./routes/ngo');
const claimsRoutes = require('./routes/claims');
const chatRoutes = require('./routes/chat');
const reviewsRoutes = require('./routes/reviews');
const notificationsRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const supportRoutes = require('./routes/support');
const mlRoutes = require('./routes/ml');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CORS_ORIGIN } });

// Make io accessible to routes
app.set('io', io);

// Middleware
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/donor', donorRoutes);
app.use('/api/ngo', ngoRoutes);
app.use('/api/claims', claimsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/ml', mlRoutes);

// Socket.io
setupSocketHandlers(io);

// Initialize and start
initializeDatabase();

setTimeout(async () => {
  await seedAdmin();
}, 1000);

server.listen(PORT, () => {
  console.log(`ReServe server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await closeDatabase();
    console.log('Database connection closed');
  } catch (err) {
    console.error('Error closing database:', err);
  }
  process.exit(0);
});
