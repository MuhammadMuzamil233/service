const { readDb, saveDb } = require('../config/db');
const { analyzeBotResponse } = require('./chatbotService');

let ioInstance = null;

function setupSocketIO(io) {
  ioInstance = io;

  io.on('connection', (socket) => {
    let currentSessionId = null;

    // Customer joins chat session
    socket.on('customer_join', ({ sessionId, customerName, phone }) => {
      currentSessionId = sessionId;
      socket.join(sessionId);

      const db = readDb();
      if (!db.chats) db.chats = {};

      if (!db.chats[sessionId]) {
        db.chats[sessionId] = {
          sessionId,
          customerName: customerName || 'Customer',
          phone: phone || '',
          status: 'bot', // 'bot' or 'live'
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          unreadCount: 0,
          messages: [
            {
              id: 'msg-welcome',
              sender: 'bot',
              text: "Assalam-o-Alaikum! 🌟 ProService Customer Support me khushamdeed. Mai aapki kya madad kar sakta hoon?",
              quickReplies: ['📹 Camera Installation', '💻 Computer Repair', '⚡ Electricity Problem', '🖨️ Printer Problem', '👨‍💼 Live Agent'],
              timestamp: new Date().toISOString()
            }
          ]
        };
        saveDb(db);
      } else {
        let changed = false;
        if (customerName && db.chats[sessionId].customerName !== customerName) {
          db.chats[sessionId].customerName = customerName;
          changed = true;
        }
        if (phone && db.chats[sessionId].phone !== phone) {
          db.chats[sessionId].phone = phone;
          changed = true;
        }
        if (changed) saveDb(db);
      }

      // Send complete chat history to customer
      socket.emit('chat_history', db.chats[sessionId]);

      // Notify admins about customer presence
      io.to('admins').emit('customer_presence', {
        sessionId,
        session: db.chats[sessionId],
        online: true
      });
    });

    // Customer sends message
    socket.on('customer_message', ({ sessionId, text, customerName, phone }) => {
      if (!sessionId || !text) return;

      const db = readDb();
      if (!db.chats) db.chats = {};

      if (!db.chats[sessionId]) {
        db.chats[sessionId] = {
          sessionId,
          customerName: customerName || 'Customer',
          phone: phone || '',
          status: 'bot',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          unreadCount: 0,
          messages: []
        };
      }

      const session = db.chats[sessionId];
      if (customerName) session.customerName = customerName;
      if (phone) session.phone = phone;

      const userMessageObj = {
        id: 'msg-' + Date.now(),
        sender: 'customer',
        text,
        timestamp: new Date().toISOString()
      };

      session.messages.push(userMessageObj);
      session.updatedAt = new Date().toISOString();
      session.unreadCount = (session.unreadCount || 0) + 1;
      session.lastMessage = text;

      saveDb(db);

      // Broadcast customer message to admins
      io.to('admins').emit('new_customer_message', {
        sessionId,
        session,
        message: userMessageObj
      });

      // Check if session is handled by Bot
      if (session.status === 'bot') {
        socket.emit('bot_typing', { typing: true });

        setTimeout(() => {
          const botAnalysis = analyzeBotResponse(text, session);

          // If human handoff requested
          if (botAnalysis.type === 'agent_handoff') {
            session.status = 'live';
            saveDb(db);
            io.to('admins').emit('agent_handoff_alert', {
              sessionId,
              session,
              alert: 'Customer requested human support agent!'
            });
          }

          const botMessageObj = {
            id: 'bot-' + Date.now(),
            sender: 'bot',
            text: botAnalysis.text,
            quickReplies: botAnalysis.quickReplies,
            timestamp: new Date().toISOString()
          };

          session.messages.push(botMessageObj);
          session.updatedAt = new Date().toISOString();
          saveDb(db);

          socket.emit('bot_typing', { typing: false });
          socket.emit('bot_reply', botMessageObj);

          // Update admin view with bot reply
          io.to('admins').emit('session_updated', { sessionId, session });
        }, 600);
      }
    });

    // Admin joins support room
    socket.on('admin_join', () => {
      socket.join('admins');
      const db = readDb();
      socket.emit('admin_all_chats', Object.values(db.chats || {}));
    });

    // Admin sends message to customer
    socket.on('admin_message', ({ sessionId, text, agentName }) => {
      if (!sessionId || !text) return;

      const db = readDb();
      const session = db.chats ? db.chats[sessionId] : null;
      if (!session) return;

      // Switch to live mode if admin responds
      session.status = 'live';
      session.unreadCount = 0;

      const agentMsgObj = {
        id: 'agent-' + Date.now(),
        sender: 'agent',
        agentName: agentName || 'Support Specialist',
        text,
        timestamp: new Date().toISOString()
      };

      session.messages.push(agentMsgObj);
      session.updatedAt = new Date().toISOString();
      session.lastMessage = text;
      saveDb(db);

      // Send to customer
      io.to(sessionId).emit('agent_reply', agentMsgObj);

      // Confirm to all admins
      io.to('admins').emit('admin_message_sent', {
        sessionId,
        session,
        message: agentMsgObj
      });
    });

    // Admin toggles bot / live mode
    socket.on('admin_toggle_mode', ({ sessionId, mode }) => {
      const db = readDb();
      if (db.chats && db.chats[sessionId]) {
        db.chats[sessionId].status = mode; // 'bot' or 'live'
        saveDb(db);
        io.to('admins').emit('session_updated', { sessionId, session: db.chats[sessionId] });
        io.to(sessionId).emit('mode_changed', { mode });
      }
    });

    // Typing indicators
    socket.on('customer_typing', ({ sessionId, isTyping }) => {
      io.to('admins').emit('customer_is_typing', { sessionId, isTyping });
    });

    socket.on('admin_typing', ({ sessionId, isTyping, agentName }) => {
      io.to(sessionId).emit('agent_is_typing', { isTyping, agentName });
    });

    // Staff / Technician joins room
    socket.on('staff_join', ({ technicianId }) => {
      if (technicianId) {
        socket.join(`tech_${technicianId}`);
        console.log(`[Socket] Staff joined room: tech_${technicianId}`);
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      if (currentSessionId) {
        io.to('admins').emit('customer_presence', {
          sessionId: currentSessionId,
          online: false
        });
      }
    });
  });
}

function broadcastNewTicket(ticket) {
  if (ioInstance) {
    ioInstance.to('admins').emit('new_ticket', ticket);
    if (ticket.assignedTechId) {
      ioInstance.to(`tech_${ticket.assignedTechId}`).emit('job_assigned', ticket);
    }
  }
}

function broadcastTicketUpdated(ticket) {
  if (ioInstance) {
    ioInstance.emit('ticket_updated', ticket);
    if (ticket.assignedTechId) {
      ioInstance.to(`tech_${ticket.assignedTechId}`).emit('job_assigned', ticket);
    }
  }
}

function broadcastJobAssigned(ticket) {
  if (ioInstance && ticket.assignedTechId) {
    ioInstance.to(`tech_${ticket.assignedTechId}`).emit('job_assigned', ticket);
  }
}

module.exports = {
  setupSocketIO,
  broadcastNewTicket,
  broadcastTicketUpdated,
  broadcastJobAssigned
};
