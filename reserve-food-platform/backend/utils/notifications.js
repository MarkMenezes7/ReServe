const { db, dbRun, dbGet } = require('../db/database');

function createNotification(io, { userId, type, title, message, relatedId, relatedType }) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO notifications (userId, type, title, message, relatedId, relatedType)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, type, title, message, relatedId || null, relatedType || null],
      function (err) {
        if (err) {
          console.error('Error creating notification:', err);
          return reject(err);
        }
        const notification = {
          id: this.lastID,
          userId,
          type,
          title,
          message,
          relatedId,
          relatedType,
          isRead: 0,
          createdAt: new Date().toISOString(),
        };
        // Emit to user's socket room
        if (io) {
          io.to(`user_${userId}`).emit('notification', notification);
        }
        resolve(notification);
      }
    );
  });
}

module.exports = { createNotification };
