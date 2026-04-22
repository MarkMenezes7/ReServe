const { db } = require('../db/database');

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    // Join user-specific room for notifications
    socket.on('joinUserRoom', ({ userId, userType }) => {
      if (userId) {
        socket.join(`user_${userId}`);
      }
      if (userType === 'admin') {
        socket.join('admins');
      }
    });

    // Join claim room for chat
    socket.on('joinRoom', ({ claimId }) => {
      if (claimId) {
        socket.join(`claim_${claimId}`);
      }
    });

    // Send message
    socket.on('sendMessage', (payload) => {
      const { claimId, senderId, receiverId, content, messageType, imageUrl } = payload || {};
      if (!claimId || !senderId || !receiverId || !content) return;

      db.run(
        `INSERT INTO messages (claimId, senderId, receiverId, content, messageType, imageUrl)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [claimId, senderId, receiverId, content, messageType || 'text', imageUrl || null],
        function (err) {
          if (err) {
            console.error('Socket message save error:', err);
            return;
          }
          const message = {
            id: this.lastID,
            claimId,
            senderId,
            receiverId,
            content,
            messageType: messageType || 'text',
            imageUrl: imageUrl || null,
            isRead: 0,
            createdAt: new Date().toISOString(),
          };
          io.to(`claim_${claimId}`).emit('newMessage', message);

          // Notify receiver
          io.to(`user_${receiverId}`).emit('notification', {
            type: 'message_new',
            title: 'New Message',
            message: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
            relatedId: claimId,
            relatedType: 'chat',
          });
        }
      );
    });

    // Typing indicators
    socket.on('typing', ({ claimId, userId, userName }) => {
      socket.to(`claim_${claimId}`).emit('userTyping', { claimId, userId, userName });
    });

    socket.on('stopTyping', ({ claimId, userId }) => {
      socket.to(`claim_${claimId}`).emit('userStopTyping', { claimId, userId });
    });

    // Mark messages as read
    socket.on('markRead', ({ claimId, userId }) => {
      db.run(
        'UPDATE messages SET isRead = 1 WHERE claimId = ? AND receiverId = ? AND isRead = 0',
        [claimId, userId],
        (err) => {
          if (!err) {
            io.to(`claim_${claimId}`).emit('messagesRead', { claimId, userId });
          }
        }
      );
    });
  });
}

module.exports = { setupSocketHandlers };
