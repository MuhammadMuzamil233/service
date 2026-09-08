/**
 * ProService Real-Time Intelligent Chatbot Client
 * Uses Socket.IO, Web Audio API chime, and smart quick actions
 */

(function () {
  // Sound synthesizer using Web Audio API
  class SoundFX {
    constructor() {
      this.ctx = null;
      this.muted = false;
    }

    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
      }
    }

    playReceive() {
      if (this.muted) return;
      try {
        this.init();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      } catch (e) {}
    }

    playSend() {
      if (this.muted) return;
      try {
        this.init();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now); // A4
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
      } catch (e) {}
    }
  }

  const sound = new SoundFX();

  // Session Management
  let sessionId = localStorage.getItem('proservice_session_id');
  if (!sessionId) {
    sessionId = 'cust_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    localStorage.setItem('proservice_session_id', sessionId);
  }

  let customerName = localStorage.getItem('proservice_customer_name') || 'Guest';
  let customerPhone = localStorage.getItem('proservice_customer_phone') || '';
  let unreadCount = 0;
  let isOpen = false;
  let typingTimeout = null;

  // DOM Elements
  const launcher = document.getElementById('chatbotLauncher');
  const chatWindow = document.getElementById('chatWindow');
  const closeChatBtn = document.getElementById('closeChatBtn');
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendChatBtn = document.getElementById('sendChatBtn');
  const unreadBadge = document.getElementById('unreadBadge');
  const chatStatusPill = document.getElementById('chatStatusPill');
  const muteBtn = document.getElementById('muteChatSoundBtn');
  const typingIndicator = document.getElementById('typingIndicator');
  const typingText = document.getElementById('typingText');

  // Connect Socket.IO
  let socket = null;
  try {
    if (typeof io === 'function') {
      socket = io({ transports: ['websocket', 'polling'], timeout: 5000, reconnectionAttempts: 3 });
    }
  } catch (e) {
    console.warn('Socket.IO bypassed:', e);
  }
  if (!socket) {
    socket = { on: () => {}, emit: () => {} };
  }

  // Join session on connect
  socket.on('connect', () => {
    socket.emit('customer_join', {
      sessionId,
      customerName,
      phone: customerPhone
    });
  });

  // Receive full chat history on load
  socket.on('chat_history', (session) => {
    chatMessages.innerHTML = '';
    updateModeDisplay(session.status);

    if (session.messages && session.messages.length > 0) {
      session.messages.forEach(msg => {
        appendMessage(msg, false);
      });
    }
    scrollToBottom();
  });

  // Receive bot reply
  socket.on('bot_reply', (msg) => {
    appendMessage(msg, true);
    sound.playReceive();
    notifyIfClosed();
  });

  // Receive live agent reply
  socket.on('agent_reply', (msg) => {
    appendMessage(msg, true);
    sound.playReceive();
    notifyIfClosed();
    updateModeDisplay('live');
  });

  // Bot typing indicator
  socket.on('bot_typing', ({ typing }) => {
    if (typing) {
      showTyping('🤖 ProService Bot is typing...');
    } else {
      hideTyping();
    }
  });

  // Live agent typing indicator
  socket.on('agent_is_typing', ({ isTyping, agentName }) => {
    if (isTyping) {
      showTyping(`👨‍💼 ${agentName || 'Agent'} is typing...`);
    } else {
      hideTyping();
    }
  });

  // Mode changed (bot vs live)
  socket.on('mode_changed', ({ mode }) => {
    updateModeDisplay(mode);
  });

  function updateModeDisplay(mode) {
    if (!chatStatusPill) return;
    if (mode === 'live') {
      chatStatusPill.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping mr-1.5"></span> Live Support Active`;
      chatStatusPill.className = 'text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center';
    } else {
      chatStatusPill.innerHTML = `<span class="w-2 h-2 rounded-full bg-blue-400 mr-1.5"></span> AI Support Bot`;
      chatStatusPill.className = 'text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center';
    }
  }

  function showTyping(text) {
    if (!typingIndicator) return;
    typingText.innerText = text;
    typingIndicator.classList.remove('hidden');
    scrollToBottom();
  }

  function hideTyping() {
    if (!typingIndicator) return;
    typingIndicator.classList.add('hidden');
  }

  function notifyIfClosed() {
    if (!isOpen) {
      unreadCount++;
      if (unreadBadge) {
        unreadBadge.innerText = unreadCount;
        unreadBadge.classList.remove('hidden');
      }
    }
  }

  // Format message text (support **bold**, bullet points, line breaks, links)
  function formatText(raw) {
    if (!raw) return '';
    let text = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Bold text **example**
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Bullet points
    text = text.replace(/^• (.*)$/gm, '<li class="ml-3 list-disc">$1</li>');

    // Newlines to breaks
    text = text.replace(/\n/g, '<br>');

    return text;
  }

  function appendMessage(msg, animate = true) {
    const bubble = document.createElement('div');
    const sender = msg.sender || 'bot';
    bubble.className = `chat-bubble ${sender}`;

    const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    let headerHtml = '';
    if (sender === 'bot') {
      headerHtml = `<div class="sender-tag text-blue-400"><svg class="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg> ProService AI Bot</div>`;
    } else if (sender === 'agent') {
      headerHtml = `<div class="sender-tag text-amber-300"><svg class="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg> ${msg.agentName || 'Live Support Agent'}</div>`;
    }

    let quickRepliesHtml = '';
    if (msg.quickReplies && msg.quickReplies.length > 0) {
      quickRepliesHtml = '<div class="quick-replies-container">';
      msg.quickReplies.forEach(qr => {
        quickRepliesHtml += `<button class="quick-reply-btn" data-text="${qr}">${qr}</button>`;
      });
      quickRepliesHtml += '</div>';
    }

    bubble.innerHTML = `
      ${headerHtml}
      <div class="message-content">${formatText(msg.text)}</div>
      ${quickRepliesHtml}
      <span class="timestamp">${timeStr}</span>
    `;

    // Attach click events for quick reply chips
    const btns = bubble.querySelectorAll('.quick-reply-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const text = e.target.getAttribute('data-text');
        handleQuickReply(text);
      });
    });

    chatMessages.appendChild(bubble);
    scrollToBottom();
  }

  function handleQuickReply(text) {
    // If it's a booking action
    if (text.startsWith('📹 Book') || text === 'Book Camera Service') {
      window.openBookingModal && window.openBookingModal('camera');
      return;
    }
    if (text.startsWith('💻 Book') || text === 'Book Laptop Repair') {
      window.openBookingModal && window.openBookingModal('computer');
      return;
    }
    if (text.startsWith('🚨 Emergency') || text === 'Book Wiring Work' || text.startsWith('⚡ Book')) {
      window.openBookingModal && window.openBookingModal('electricity');
      return;
    }
    if (text.startsWith('🖨️ Book') || text === 'Book Printer Repair') {
      window.openBookingModal && window.openBookingModal('printer');
      return;
    }

    // Otherwise send as normal user message
    sendMessage(text);
  }

  function sendMessage(customText) {
    const text = customText || chatInput.value.trim();
    if (!text) return;

    sound.playSend();

    // Append customer message immediately to UI
    const tempMsg = {
      sender: 'customer',
      text: text,
      timestamp: new Date().toISOString()
    };
    appendMessage(tempMsg, true);

    if (!customText) {
      chatInput.value = '';
    }

    // Emit via Socket.IO
    socket.emit('customer_message', {
      sessionId,
      text,
      customerName,
      phone: customerPhone
    });

    // Reset typing status
    socket.emit('customer_typing', { sessionId, isTyping: false });
  }

  function scrollToBottom() {
    setTimeout(() => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 50);
  }

  // Event Listeners
  launcher.addEventListener('click', () => {
    isOpen = !isOpen;
    if (isOpen) {
      chatWindow.classList.add('active');
      unreadCount = 0;
      if (unreadBadge) {
        unreadBadge.classList.add('hidden');
        unreadBadge.innerText = '0';
      }
      scrollToBottom();
      setTimeout(() => chatInput.focus(), 250);
    } else {
      chatWindow.classList.remove('active');
    }
  });

  closeChatBtn.addEventListener('click', () => {
    isOpen = false;
    chatWindow.classList.remove('active');
  });

  sendChatBtn.addEventListener('click', () => sendMessage());

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    } else {
      // Typing debounce
      socket.emit('customer_typing', { sessionId, isTyping: true });
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        socket.emit('customer_typing', { sessionId, isTyping: false });
      }, 1500);
    }
  });

  // Sound mute toggle
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      sound.muted = !sound.muted;
      muteBtn.innerHTML = sound.muted
        ? `<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clip-rule="evenodd" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/></svg>`
        : `<svg class="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>`;
    });
  }

  // Global helper to trigger chat from anywhere on website
  window.openChatWithPrompt = function (promptText) {
    isOpen = true;
    chatWindow.classList.add('active');
    unreadCount = 0;
    if (unreadBadge) unreadBadge.classList.add('hidden');
    if (promptText) {
      setTimeout(() => {
        sendMessage(promptText);
      }, 300);
    }
    scrollToBottom();
  };

  // Helper to switch to live agent
  window.requestLiveAgent = function () {
    window.openChatWithPrompt('Mujhe live support agent se rabata karna hai.');
  };
})();
