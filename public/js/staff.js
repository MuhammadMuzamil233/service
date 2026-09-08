/**
 * ProService Field Staff & Technician Portal Logic
 * Real-time job notifications, map directions, customer calling, and status workflow
 */

document.addEventListener('DOMContentLoaded', () => {
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

  let authToken = localStorage.getItem('proservice_staff_token') || '';
  let currentStaffUser = null;
  let allStaffTickets = [];
  let currentFilter = 'all';
  let activeCompleteTicketId = null;

  // Sound Synthesizer for Job Dispatch Alert
  function playDispatchAlert() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      
      // Chime sequence: C5 -> G5
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.2);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, now + 0.15); // G5
      gain2.gain.setValueAtTime(0.25, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.45);
    } catch (e) {}
  }

  function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    return headers;
  }

  // Socket Connection & Joining Staff Room
  socket.on('connect', () => {
    console.log('Connected to Socket.IO as Staff');
    if (currentStaffUser && currentStaffUser.technicianId) {
      socket.emit('staff_join', { technicianId: currentStaffUser.technicianId });
    }
  });

  // Real-time listener for when Admin assigns a job to this staff member
  socket.on('job_assigned', (ticket) => {
    console.log('Real-time job assigned received:', ticket);
    playDispatchAlert();
    showToast(`🔔 <strong>NEW JOB DISPATCHED!</strong><br>${ticket.id}: ${ticket.serviceName} for ${ticket.customerName}`, 'emerald');
    loadStaffTickets();
  });

  // Real-time listener for ticket updates
  socket.on('ticket_updated', (ticket) => {
    const isMine = currentStaffUser && (
      ticket.assignedTechId === currentStaffUser.technicianId ||
      (ticket.assignedTo && ticket.assignedTo.includes(currentStaffUser.name))
    );

    if (isMine) {
      const idx = allStaffTickets.findIndex(t => t.id === ticket.id);
      if (idx !== -1) {
        allStaffTickets[idx] = ticket;
      } else {
        allStaffTickets.unshift(ticket);
      }
      renderTickets();
    }
  });

  // Auth Initialization
  async function initAuth() {
    if (!authToken) {
      // Auto login as default demo technician Engr. Zohaib (TECH-101)
      await quickLoginStaff('TECH-101');
      return;
    }

    try {
      const res = await fetch('/api/auth/me', { headers: getAuthHeaders() });
      const data = await res.json();

      if (data.success && data.user) {
        currentStaffUser = data.user;
        updateStaffUI();
        if (socket.connected) {
          socket.emit('staff_join', { technicianId: currentStaffUser.technicianId });
        }
        loadStaffTickets();
      } else {
        await quickLoginStaff('TECH-101');
      }
    } catch (e) {
      showLoginModal();
    }
  }

  // Switch Staff Member (Quick Switcher)
  window.switchStaffMember = async function (techId) {
    await quickLoginStaff(techId);
  };

  window.quickLoginStaff = async function (technicianId) {
    try {
      const res = await fetch('/api/auth/staff-quick-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technicianId })
      });

      const data = await res.json();
      if (data.success && data.token) {
        authToken = data.token;
        currentStaffUser = data.user;
        localStorage.setItem('proservice_staff_token', authToken);
        localStorage.setItem('proservice_staff_tech_id', technicianId);

        closeLoginModal();
        updateStaffUI();

        if (socket.connected) {
          socket.emit('staff_join', { technicianId });
        }

        showToast(`Switched account to: <strong>${data.user.name}</strong>`);
        loadStaffTickets();
      }
    } catch (err) {
      console.error('Error switching staff:', err);
    }
  };

  function updateStaffUI() {
    if (!currentStaffUser) return;
    const badge = document.getElementById('staffBadge');
    const nameEl = document.getElementById('staffNameDisplay');
    const specialtyEl = document.getElementById('staffSpecialtyDisplay');
    const avatarEl = document.getElementById('staffAvatarInitial');

    badge.classList.remove('hidden');
    nameEl.innerText = currentStaffUser.name;
    specialtyEl.innerText = currentStaffUser.specialty ? `${currentStaffUser.specialty.toUpperCase()} Specialist` : 'Specialist';
    avatarEl.innerText = (currentStaffUser.name || 'T').charAt(0).toUpperCase();

    // Highlight active switcher button
    document.querySelectorAll('.staff-switch-btn').forEach(btn => {
      const techIdMatch = currentStaffUser.technicianId;
      if (btn.getAttribute('onclick')?.includes(techIdMatch)) {
        btn.classList.add('bg-emerald-600', 'text-white', 'border-emerald-500');
        btn.classList.remove('bg-slate-800', 'text-slate-300');
      } else {
        btn.classList.remove('bg-emerald-600', 'text-white', 'border-emerald-500');
        btn.classList.add('bg-slate-800', 'text-slate-300');
      }
    });

    if (window.lucide) lucide.createIcons();
  }

  // Load Tickets for this Staff Member
  async function loadStaffTickets() {
    const container = document.getElementById('staffJobsContainer');
    try {
      const res = await fetch('/api/staff/my-tickets', { headers: getAuthHeaders() });
      const data = await res.json();

      if (data.success) {
        allStaffTickets = data.tickets || [];
        updateStats(data.stats);
        renderTickets();
      } else {
        container.innerHTML = `<div class="col-span-full p-8 text-center text-red-400">Failed to load assigned jobs.</div>`;
      }
    } catch (err) {
      console.error('Error loading tickets:', err);
      container.innerHTML = `<div class="col-span-full p-8 text-center text-red-400">Network error loading jobs.</div>`;
    }
  }

  function updateStats(stats) {
    if (!stats) {
      stats = {
        total: allStaffTickets.length,
        assigned: allStaffTickets.filter(t => t.status === 'Assigned').length,
        inProgress: allStaffTickets.filter(t => t.status === 'In Progress').length,
        completed: allStaffTickets.filter(t => t.status === 'Completed').length
      };
    }

    document.getElementById('statStaffTotal').innerText = stats.total || 0;
    document.getElementById('statStaffAssigned').innerText = stats.assigned || 0;
    document.getElementById('statStaffInProgress').innerText = stats.inProgress || 0;
    document.getElementById('statStaffCompleted').innerText = stats.completed || 0;
  }

  // Render Job Cards
  function renderTickets() {
    const container = document.getElementById('staffJobsContainer');
    if (!container) return;

    let filtered = allStaffTickets;
    if (currentFilter !== 'all') {
      filtered = allStaffTickets.filter(t => t.status.toLowerCase() === currentFilter.toLowerCase());
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="col-span-full p-12 text-center glass-card bg-slate-900/40 rounded-2xl border border-slate-800">
          <div class="w-12 h-12 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <i data-lucide="inbox" class="w-6 h-6"></i>
          </div>
          <h4 class="font-bold text-white text-base">No ${currentFilter === 'all' ? '' : currentFilter} jobs found</h4>
          <p class="text-xs text-slate-400 mt-1">When Admin assigns new service orders to you, they will appear here with customer location and contact details.</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    container.innerHTML = filtered.map(ticket => {
      const isEmergency = ticket.urgency === 'Emergency';
      const isPending = ticket.status === 'Assigned' || ticket.status === 'Pending';
      const isInProgress = ticket.status === 'In Progress';
      const isCompleted = ticket.status === 'Completed';

      // Status pill color
      let statusPill = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">⏳ Assigned (Pending Start)</span>`;
      if (isInProgress) {
        statusPill = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 animate-pulse">🛠️ In Progress</span>`;
      } else if (isCompleted) {
        statusPill = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">✅ Completed</span>`;
      }

      // Action Button
      let actionButtons = '';
      if (isPending) {
        actionButtons = `
          <button onclick="startJob('${ticket.id}')" class="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2">
            <i data-lucide="play" class="w-4 h-4"></i> Accept & Start Job (On the way)
          </button>
        `;
      } else if (isInProgress) {
        actionButtons = `
          <button onclick="openCompleteModal('${ticket.id}')" class="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2">
            <i data-lucide="check-circle" class="w-4 h-4"></i> Mark Job Completed & Close
          </button>
        `;
      } else {
        actionButtons = `
          <div class="text-center py-2 px-3 rounded-xl bg-slate-800/60 text-slate-300 text-xs font-semibold border border-slate-700/50 flex items-center justify-center gap-1.5">
            <i data-lucide="check" class="w-4 h-4 text-emerald-400"></i> Job Finished Successfully
          </div>
        `;
      }

      // Phone formatting for WhatsApp (strip non-digits, replace leading 0 with 92)
      const cleanPhone = (ticket.phone || '').replace(/[^\d]/g, '');
      const waNumber = cleanPhone.startsWith('0') ? '92' + cleanPhone.substring(1) : cleanPhone;
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ticket.address)}`;

      return `
        <div class="glass-card bg-slate-900 border ${isEmergency ? 'border-red-500/40 shadow-red-950/20' : 'border-slate-800'} rounded-2xl p-5 shadow-xl flex flex-col justify-between transition hover:border-slate-700 relative overflow-hidden">
          ${isEmergency ? '<div class="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-black uppercase tracking-wider px-3 py-0.5 rounded-bl-xl flex items-center gap-1 shadow"><span class="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span> 🚨 EMERGENCY</div>' : ''}
          
          <div>
            <!-- Header ID & Time -->
            <div class="flex items-center justify-between mb-2">
              <span class="font-mono font-extrabold text-blue-400 text-sm tracking-wide">${ticket.id}</span>
              <span class="text-[11px] text-slate-400">${new Date(ticket.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>

            <!-- Service Title -->
            <div class="text-base font-bold text-white mb-2 flex items-center gap-2">
              ${escapeHtml(ticket.serviceName)}
            </div>

            <!-- Status Pill -->
            <div class="mb-4">
              ${statusPill}
            </div>

            <!-- Customer Details Card -->
            <div class="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/80 mb-3 space-y-2.5 text-xs">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5 font-semibold text-white">
                  <i data-lucide="user" class="w-3.5 h-3.5 text-blue-400"></i>
                  <span>${escapeHtml(ticket.customerName)}</span>
                </div>
                <span class="text-[11px] font-bold text-emerald-400">Rs. ${(ticket.estimatedCost || 1500).toLocaleString()}</span>
              </div>

              <!-- Phone & Quick Actions -->
              <div class="flex items-center justify-between pt-1 border-t border-slate-800/60">
                <div class="text-slate-300 font-mono">${escapeHtml(ticket.phone)}</div>
                <div class="flex items-center gap-1.5">
                  <a href="tel:${escapeHtml(ticket.phone)}" class="px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30 font-semibold text-[11px] flex items-center gap-1 transition">
                    <i data-lucide="phone" class="w-3 h-3"></i> Call
                  </a>
                  <a href="https://wa.me/${waNumber}?text=Assalam-o-Alaikum!%20Mai%20ProService%20se%20technician%20baat%20kar%20raha%20hoon%20aapke%20ticket%20(${ticket.id})%20ke%20silsile%20mein." target="_blank" class="px-2.5 py-1 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-500/30 font-semibold text-[11px] flex items-center gap-1 transition">
                    <i data-lucide="message-circle" class="w-3 h-3"></i> WhatsApp
                  </a>
                </div>
              </div>

              <!-- Address & Google Maps -->
              <div class="pt-1 border-t border-slate-800/60">
                <div class="text-slate-300 flex items-start justify-between gap-2">
                  <div class="flex items-start gap-1 flex-1">
                    <i data-lucide="map-pin" class="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5"></i>
                    <span class="line-clamp-2">${escapeHtml(ticket.address)}</span>
                  </div>
                  <a href="${mapsUrl}" target="_blank" class="px-2 py-1 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30 font-semibold text-[10px] flex-shrink-0 flex items-center gap-1 transition" title="Open in Google Maps">
                    <i data-lucide="navigation" class="w-3 h-3"></i> Maps
                  </a>
                </div>
              </div>
            </div>

            <!-- Problem Description -->
            <div class="bg-slate-800/40 rounded-xl p-3 border border-slate-800 mb-3 text-xs">
              <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Customer Problem:</div>
              <p class="text-slate-200">${escapeHtml(ticket.problemDescription || 'No details provided.')}</p>
            </div>

            <!-- Admin Dispatch Instructions / Notes -->
            ${ticket.notes ? `
              <div class="bg-blue-950/40 border border-blue-800/50 rounded-xl p-3 mb-4 text-xs">
                <div class="text-[10px] text-blue-300 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                  <i data-lucide="info" class="w-3 h-3"></i> Admin Dispatch Instructions:
                </div>
                <p class="text-blue-100">${escapeHtml(ticket.notes)}</p>
              </div>
            ` : ''}

            <!-- Completed Info (if completed) -->
            ${ticket.partsReplaced ? `
              <div class="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-2.5 mb-4 text-xs">
                <div class="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">Parts Replaced:</div>
                <div class="text-emerald-100 font-medium">${escapeHtml(ticket.partsReplaced)}</div>
              </div>
            ` : ''}
          </div>

          <!-- Bottom Action Buttons -->
          <div class="pt-3 border-t border-slate-800/80">
            ${actionButtons}
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  // Filter Buttons
  document.querySelectorAll('.staff-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.staff-filter-btn').forEach(b => {
        b.classList.remove('bg-blue-600', 'text-white');
        b.classList.add('bg-slate-800', 'text-slate-300');
      });
      btn.classList.add('bg-blue-600', 'text-white');
      btn.classList.remove('bg-slate-800', 'text-slate-300');

      currentFilter = btn.getAttribute('data-filter');
      renderTickets();
    });
  });

  // Action: Start Job
  window.startJob = async function (ticketId) {
    if (!confirm(`Are you ready to accept job ${ticketId} and mark yourself 'In Progress' / on the way?`)) return;

    try {
      const res = await fetch(`/api/staff/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status: 'In Progress',
          notes: 'Technician accepted job and dispatched to location.'
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast(`🚗 You are now on the way for ticket <strong>${ticketId}</strong>!`);
        loadStaffTickets();
      } else {
        alert(data.message || 'Could not start job.');
      }
    } catch (e) {
      console.error(e);
      alert('Network error starting job.');
    }
  };

  // Action: Open Complete Modal
  window.openCompleteModal = function (ticketId) {
    activeCompleteTicketId = ticketId;
    document.getElementById('completeModalTicketId').innerText = ticketId;
    document.getElementById('completeWorkNotes').value = '';
    document.getElementById('completeParts').value = '';

    const ticket = allStaffTickets.find(t => t.id === ticketId);
    if (ticket) {
      document.getElementById('completeCost').value = ticket.estimatedCost || 2000;
    }

    const modal = document.getElementById('completeJobModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  };

  window.closeCompleteModal = function () {
    const modal = document.getElementById('completeJobModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    activeCompleteTicketId = null;
  };

  // Submit Complete Form
  const completeForm = document.getElementById('completeJobForm');
  if (completeForm) {
    completeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeCompleteTicketId) return;

      const notes = document.getElementById('completeWorkNotes').value.trim();
      const partsReplaced = document.getElementById('completeParts').value.trim();
      const actualCost = document.getElementById('completeCost').value;

      try {
        const res = await fetch(`/api/staff/tickets/${activeCompleteTicketId}/status`, {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            status: 'Completed',
            notes,
            partsReplaced,
            actualCost
          })
        });

        const data = await res.json();
        if (data.success) {
          closeCompleteModal();
          showToast(`🎉 Job <strong>${activeCompleteTicketId}</strong> marked as COMPLETED! Great job!`, 'emerald');
          loadStaffTickets();
        } else {
          alert(data.message || 'Could not complete job.');
        }
      } catch (err) {
        console.error(err);
        alert('Network error completing job.');
      }
    });
  }

  // Auth View Switcher (Sign In vs Sign Up)
  window.toggleStaffAuthMode = function (mode) {
    const signInSection = document.getElementById('staffSignInSection');
    const signUpSection = document.getElementById('staffSignUpSection');
    const tabSignInBtn = document.getElementById('tabSignInBtn');
    const tabSignUpBtn = document.getElementById('tabSignUpBtn');
    const errorEl = document.getElementById('staffLoginError');
    if (errorEl) errorEl.classList.add('hidden');

    if (mode === 'signup') {
      signInSection.classList.add('hidden');
      signUpSection.classList.remove('hidden');
      tabSignUpBtn.className = 'flex-1 py-1.5 rounded-lg bg-emerald-600 text-white transition flex items-center justify-center gap-1';
      tabSignInBtn.className = 'flex-1 py-1.5 rounded-lg text-slate-300 hover:text-white transition flex items-center justify-center gap-1';
      document.getElementById('modalTitle').innerText = 'Staff Registration';
      document.getElementById('modalSubtitle').innerText = 'Create your field technician account';
    } else {
      signUpSection.classList.add('hidden');
      signInSection.classList.remove('hidden');
      tabSignInBtn.className = 'flex-1 py-1.5 rounded-lg bg-emerald-600 text-white transition flex items-center justify-center gap-1';
      tabSignUpBtn.className = 'flex-1 py-1.5 rounded-lg text-slate-300 hover:text-white transition flex items-center justify-center gap-1';
      document.getElementById('modalTitle').innerText = 'Field Staff Portal';
      document.getElementById('modalSubtitle').innerText = 'Sign in or register your technician profile';
    }
  };

  // Staff Registration Form Handler
  const staffRegForm = document.getElementById('staffRegisterForm');
  if (staffRegForm) {
    staffRegForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById('staffLoginError');
      errorEl.classList.add('hidden');

      const submitBtn = document.getElementById('staffRegSubmitBtn');
      const originalText = submitBtn.innerText;
      submitBtn.disabled = true;
      submitBtn.innerText = 'Creating Account...';

      const payload = {
        name: document.getElementById('regName').value.trim(),
        email: document.getElementById('regEmail').value.trim(),
        phone: document.getElementById('regPhone').value.trim(),
        specialty: document.getElementById('regSpecialty').value,
        address: document.getElementById('regAddress').value.trim(),
        password: document.getElementById('regPassword').value
      };

      try {
        const res = await fetch('/api/auth/staff-register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.success && data.token) {
          authToken = data.token;
          currentStaffUser = data.user;
          localStorage.setItem('proservice_staff_token', authToken);
          localStorage.setItem('proservice_staff_tech_id', data.user.technicianId);

          closeLoginModal();
          updateStaffUI();

          if (socket.connected) {
            socket.emit('staff_join', { technicianId: data.user.technicianId });
          }

          showToast(`🎉 Welcome <strong>${data.user.name}</strong> (${data.user.technicianId})! Registration successful.`, 'emerald');
          loadStaffTickets();
        } else {
          errorEl.innerText = data.message || 'Registration failed.';
          errorEl.classList.remove('hidden');
        }
      } catch (err) {
        errorEl.innerText = 'Network error during registration.';
        errorEl.classList.remove('hidden');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = originalText;
      }
    });
  }

  // Staff Login Form Handler (Password based)
  const staffLoginForm = document.getElementById('staffLoginForm');
  if (staffLoginForm) {
    staffLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById('staffLoginError');
      errorEl.classList.add('hidden');

      const submitBtn = document.getElementById('staffLoginSubmitBtn');
      const originalText = submitBtn.innerText;
      submitBtn.disabled = true;
      submitBtn.innerText = 'Signing In...';

      const email = document.getElementById('staffEmail').value.trim();
      const password = document.getElementById('staffPassword').value;

      try {
        const res = await fetch('/api/auth/staff-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (data.success && data.token) {
          authToken = data.token;
          currentStaffUser = data.user;
          localStorage.setItem('proservice_staff_token', authToken);
          localStorage.setItem('proservice_staff_tech_id', data.user.technicianId);

          closeLoginModal();
          updateStaffUI();

          if (socket.connected) {
            socket.emit('staff_join', { technicianId: data.user.technicianId });
          }

          showToast(`Welcome back, <strong>${data.user.name}</strong>!`, 'emerald');
          loadStaffTickets();
        } else {
          errorEl.innerText = data.message || 'Invalid email or password.';
          errorEl.classList.remove('hidden');
        }
      } catch (err) {
        errorEl.innerText = 'Network error during login.';
        errorEl.classList.remove('hidden');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = originalText;
      }
    });
  }

  // Logout
  const logoutBtn = document.getElementById('staffLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('proservice_staff_token');
      localStorage.removeItem('proservice_staff_tech_id');
      authToken = '';
      currentStaffUser = null;
      document.getElementById('staffBadge')?.classList.add('hidden');
      toggleStaffAuthMode('signin');
      showLoginModal();
    });
  }

  function showLoginModal() {
    const modal = document.getElementById('staffLoginModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  function closeLoginModal() {
    const modal = document.getElementById('staffLoginModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  // Toast Alerts
  function showToast(html, color = 'blue') {
    const toast = document.createElement('div');
    const border = color === 'emerald' ? 'border-emerald-400 bg-emerald-700' : 'border-blue-400 bg-blue-600';
    toast.className = `fixed bottom-5 right-5 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-2xl z-50 animate-bounce flex items-center gap-2.5 border ${border} max-w-sm`;
    toast.innerHTML = html;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 5000);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Start initialization
  initAuth();
});
