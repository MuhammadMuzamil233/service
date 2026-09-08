/**
 * ProService - Admin & Support Agent Control Center
 * Real-time Customer Live Chat Desk & Ticket Management System
 */

document.addEventListener('DOMContentLoaded', () => {
  let socket = null;
  try {
    if (typeof io === 'function') {
      socket = io({ transports: ['websocket', 'polling'], timeout: 5000, reconnectionAttempts: 3 });
    }
  } catch (e) {
    console.warn('Socket.IO initialization bypassed:', e);
  }
  if (!socket) {
    socket = { on: () => {}, emit: () => {} };
  }

  let activeSessionId = null;
  let allSessions = [];
  let allTickets = [];
  let currentTicketFilter = 'all';

  // Sound alert
  function playAlertSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {}
  }

  let authToken = localStorage.getItem('proservice_admin_token') || '';
  let allTechnicians = [];

  function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    return headers;
  }

  // Check auth state
  async function checkAuth() {
    const loginModal = document.getElementById('adminLoginModal');
    const userBadge = document.getElementById('adminUserBadge');
    const userNameEl = document.getElementById('adminUserName');

    if (!authToken) {
      if (loginModal) {
        loginModal.classList.remove('hidden');
        loginModal.classList.add('flex');
      }
      return false;
    }

    try {
      const res = await fetch('/api/auth/me', { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success && data.user) {
        if (loginModal) {
          loginModal.classList.add('hidden');
          loginModal.classList.remove('flex');
        }
        if (userBadge) userBadge.classList.remove('hidden');
        if (userNameEl) userNameEl.innerText = data.user.name || 'Admin';
        const agentInput = document.getElementById('agentNameInput');
        if (agentInput && data.user.name) agentInput.value = data.user.name;
        return true;
      } else {
        localStorage.removeItem('proservice_admin_token');
        authToken = '';
        if (loginModal) {
          loginModal.classList.remove('hidden');
          loginModal.classList.add('flex');
        }
        return false;
      }
    } catch (e) {
      return true; // offline / fallback
    }
  }

  // Initialize Dashboard immediately via REST APIs
  checkAuth().then(() => loadInitialData());

  // Real-Time Socket Connection (if supported)
  if (socket && typeof socket.on === 'function') {
    socket.on('connect', () => {
      console.log('Connected as Admin to Socket.IO');
      socket.emit('admin_join');
    });
  }

  async function loadInitialData() {
    try {
      const [chatsRes, ticketsRes, techsRes] = await Promise.all([
        fetch('/api/admin/chats', { headers: getAuthHeaders() }),
        fetch('/api/admin/tickets', { headers: getAuthHeaders() }),
        fetch('/api/admin/technicians', { headers: getAuthHeaders() })
      ]);

      const chatsData = await chatsRes.json();
      const ticketsData = await ticketsRes.json();
      const techsData = await techsRes.json();

      if (chatsData.success) {
        allSessions = chatsData.chats || [];
        renderChatList();
      }

      if (ticketsData.success) {
        allTickets = ticketsData.tickets || [];
        renderTicketsList();
        updateStats();
      }

      if (techsData.success) {
        allTechnicians = techsData.technicians || [];
        populateTechniciansDropdown();
        renderStaffRoster();
        updateStaffStats();
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
    }
  }

  function populateTechniciansDropdown(ticketServiceType = '') {
    const select = document.getElementById('assignTechSelect');
    if (!select) return;

    select.innerHTML = '<option value="">-- Choose a Registered Technician --</option>' +
      allTechnicians.map(t => {
        const isMatch = ticketServiceType && t.specialty === ticketServiceType;
        const star = '★'.repeat(Math.round(t.rating || 5));
        const activeText = t.activeJobs > 0 ? `(${t.activeJobs} active jobs)` : '(Available)';
        return `<option value="${t.id}" data-name="${escapeHtml(t.name)}" data-phone="${escapeHtml(t.phone)}" ${isMatch ? 'class="bg-blue-900/40 text-blue-200 font-bold"' : ''}>
          ${escapeHtml(t.name)} [${t.specialty.toUpperCase()}] ${star} ${activeText}
        </option>`;
      }).join('');
  }

  // ---------------- TICKETS MANAGEMENT ---------------- //

  function updateStats() {
    document.getElementById('statTotalTickets').innerText = allTickets.length;
    document.getElementById('statPending').innerText = allTickets.filter(t => t.status === 'Pending').length;
    document.getElementById('statInProgress').innerText = allTickets.filter(t => t.status === 'In Progress' || t.status === 'Assigned').length;
    document.getElementById('statCompleted').innerText = allTickets.filter(t => t.status === 'Completed').length;
    
    // Live chats count
    const liveSessionsCount = allSessions.filter(s => s.status === 'live').length;
    const badge = document.getElementById('statLiveChats');
    if (badge) badge.innerText = liveSessionsCount;
  }

  function renderTicketsList() {
    const container = document.getElementById('ticketsTableBody');
    if (!container) return;

    let filtered = allTickets;
    if (currentTicketFilter !== 'all') {
      filtered = allTickets.filter(t => t.serviceType === currentTicketFilter || t.status.toLowerCase() === currentTicketFilter.toLowerCase());
    }

    const searchVal = document.getElementById('ticketSearchInput')?.value.toLowerCase().trim();
    if (searchVal) {
      filtered = filtered.filter(t => 
        t.id.toLowerCase().includes(searchVal) ||
        t.customerName.toLowerCase().includes(searchVal) ||
        t.phone.includes(searchVal) ||
        t.serviceName.toLowerCase().includes(searchVal)
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-400">No tickets found.</td></tr>`;
      return;
    }

    container.innerHTML = filtered.map(ticket => {
      let statusBadgeColor = 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      if (ticket.status === 'Completed') statusBadgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      if (ticket.status === 'In Progress') statusBadgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      if (ticket.status === 'Pending') statusBadgeColor = 'bg-red-500/20 text-red-300 border-red-500/30';

      const urgencyBadge = ticket.urgency === 'Emergency' 
        ? '<span class="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400 border border-red-500/30 font-semibold animate-pulse">🚨 Emergency</span>'
        : `<span class="px-2 py-0.5 rounded text-xs bg-gray-700/60 text-gray-300">${ticket.urgency}</span>`;

      return `
        <tr class="border-b border-gray-800 hover:bg-slate-800/40 transition">
          <td class="py-3 px-4 font-mono font-bold text-blue-400">${ticket.id}</td>
          <td class="py-3 px-4">
            <div class="font-semibold text-white">${escapeHtml(ticket.customerName)}</div>
            <div class="text-xs text-gray-400">${escapeHtml(ticket.phone)}</div>
          </td>
          <td class="py-3 px-4">
            <div class="text-sm font-medium text-gray-200">${escapeHtml(ticket.serviceName)}</div>
            <div class="text-xs text-gray-400 truncate max-w-xs" title="${escapeHtml(ticket.problemDescription)}">${escapeHtml(ticket.problemDescription)}</div>
          </td>
          <td class="py-3 px-4 text-xs text-gray-300">${escapeHtml(ticket.address)}</td>
          <td class="py-3 px-4">${urgencyBadge}</td>
          <td class="py-3 px-4">
            <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusBadgeColor}">
              ${ticket.status}
            </span>
          </td>
          <td class="py-3 px-4">
            <div class="flex items-center gap-2">
              <select onchange="updateTicketStatus('${ticket.id}', this.value)" class="bg-slate-900 border border-gray-700 text-xs rounded px-2 py-1 text-gray-200 focus:outline-none focus:border-blue-500">
                <option value="Pending" ${ticket.status === 'Pending' ? 'selected' : ''}>Pending</option>
                <option value="Assigned" ${ticket.status === 'Assigned' ? 'selected' : ''}>Assigned</option>
                <option value="In Progress" ${ticket.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                <option value="Completed" ${ticket.status === 'Completed' ? 'selected' : ''}>Completed</option>
              </select>
              <button onclick="openAssignModal('${ticket.id}')" title="Assign Technician & Notes" class="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-gray-300 hover:text-white transition">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
              </button>
            </div>
            <div class="text-[11px] text-gray-400 mt-1">${ticket.assignedTo ? '👤 ' + escapeHtml(ticket.assignedTo) : '⚠️ Unassigned'}</div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Update Ticket Status via API
  window.updateTicketStatus = async function (ticketId, newStatus) {
    try {
      const res = await fetch(`/api/admin/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        const idx = allTickets.findIndex(t => t.id === ticketId);
        if (idx !== -1) allTickets[idx] = data.ticket;
        renderTicketsList();
        updateStats();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Create & Assign Task Modal (Admin)
  window.openCreateTaskModal = function () {
    const modal = document.getElementById('createTaskModal');
    const select = document.getElementById('newTaskStaffSelect');
    if (select) {
      select.innerHTML = '<option value="">-- Choose Registered Staff Member --</option>' +
        allTechnicians.map(t => {
          return `<option value="${t.id}" data-name="${escapeHtml(t.name)}">
            ${escapeHtml(t.name)} [${t.specialty.toUpperCase()}] ★${t.rating || 5.0} (${t.activeJobs || 0} active)
          </option>`;
        }).join('');
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  };

  window.closeCreateTaskModal = function () {
    const modal = document.getElementById('createTaskModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  };

  // Submit Create Task Form
  const createTaskForm = document.getElementById('adminCreateTaskForm');
  if (createTaskForm) {
    createTaskForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const staffSelect = document.getElementById('newTaskStaffSelect');
      const selectedOption = staffSelect.options[staffSelect.selectedIndex];
      const assignedTechId = staffSelect.value;
      const assignedTo = selectedOption ? selectedOption.getAttribute('data-name') : null;

      const payload = {
        customerName: document.getElementById('newTaskCustomer').value.trim(),
        phone: document.getElementById('newTaskPhone').value.trim(),
        serviceType: document.getElementById('newTaskService').value,
        urgency: document.getElementById('newTaskUrgency').value,
        address: document.getElementById('newTaskAddress').value.trim(),
        problemDescription: document.getElementById('newTaskDesc').value.trim(),
        assignedTechId,
        assignedTo,
        notes: document.getElementById('newTaskNotes').value.trim(),
        estimatedCost: document.getElementById('newTaskCost').value || 2500
      };

      const submitBtn = document.getElementById('submitCreateTaskBtn');
      const origText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerText = 'Creating & Dispatching...';

      try {
        const res = await fetch('/api/tickets', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.success && data.ticket) {
          closeCreateTaskModal();
          createTaskForm.reset();
          showToast(`🚀 Task <strong>${data.ticket.id}</strong> dispatched to <strong>${escapeHtml(data.ticket.assignedTo || 'Staff')}</strong>!`);
          loadInitialData();
        } else {
          alert(data.message || 'Failed to create task.');
        }
      } catch (err) {
        console.error('Error creating task:', err);
        alert('Network error creating task.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origText;
      }
    });
  }

  // Assign Modal
  window.openAssignModal = function (ticketId) {
    const ticket = allTickets.find(t => t.id === ticketId);
    if (!ticket) return;

    const modal = document.getElementById('assignModal');
    document.getElementById('assignTicketId').innerText = ticket.id;
    document.getElementById('assignCustomer').innerText = ticket.customerName;
    document.getElementById('assignTechName').value = ticket.assignedTo || '';
    document.getElementById('assignNotes').value = ticket.notes || '';

    // Populate dropdown highlighting specialists for this ticket
    populateTechniciansDropdown(ticket.serviceType);

    const techSelect = document.getElementById('assignTechSelect');
    if (techSelect) {
      techSelect.value = ticket.assignedTechId || '';
      techSelect.onchange = () => {
        const opt = techSelect.options[techSelect.selectedIndex];
        if (opt && opt.value) {
          const name = opt.getAttribute('data-name');
          const phone = opt.getAttribute('data-phone');
          document.getElementById('assignTechName').value = `${name} (${phone})`;
        }
      };
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    document.getElementById('saveAssignBtn').onclick = async () => {
      const assignedTo = document.getElementById('assignTechName').value.trim();
      const notes = document.getElementById('assignNotes').value.trim();
      const assignedTechId = techSelect ? techSelect.value : undefined;
      const newStatus = ticket.status === 'Pending' ? 'Assigned' : ticket.status;

      const res = await fetch(`/api/admin/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ assignedTo, notes, assignedTechId, status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        const idx = allTickets.findIndex(t => t.id === ticketId);
        if (idx !== -1) allTickets[idx] = data.ticket;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        renderTicketsList();
        updateStats();
        showToast(`👨‍🔧 Ticket ${ticketId} assigned to <strong>${escapeHtml(assignedTo)}</strong>!`);
      }
    };
  };

  window.closeAssignModal = function () {
    const modal = document.getElementById('assignModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  };

  // Real-time socket events for Tickets
  socket.on('new_ticket', (ticket) => {
    allTickets.unshift(ticket);
    renderTicketsList();
    updateStats();
    playAlertSound();
    showToast(`🔔 New Ticket: ${ticket.id} (${ticket.serviceName}) booked by ${ticket.customerName}!`);
  });

  socket.on('ticket_updated', (ticket) => {
    const idx = allTickets.findIndex(t => t.id === ticket.id);
    if (idx !== -1) {
      allTickets[idx] = ticket;
      renderTicketsList();
      updateStats();
    }
  });

  // Filter tickets
  document.querySelectorAll('.ticket-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ticket-filter-btn').forEach(b => b.classList.remove('bg-blue-600', 'text-white'));
      btn.classList.add('bg-blue-600', 'text-white');
      currentTicketFilter = btn.getAttribute('data-filter');
      renderTicketsList();
    });
  });

  document.getElementById('ticketSearchInput')?.addEventListener('input', () => {
    renderTicketsList();
  });

  // ---------------- FIELD STAFF ROSTER & MANAGEMENT ---------------- //
  let currentStaffFilter = 'all';

  function updateStaffStats() {
    const statStaff = document.getElementById('statStaffCount');
    if (statStaff) statStaff.innerText = allTechnicians.length;

    const countAll = document.getElementById('staffFilterCountAll');
    const countAvail = document.getElementById('staffFilterCountAvailable');
    const countBusy = document.getElementById('staffFilterCountBusy');
    const countLeave = document.getElementById('staffFilterCountLeave');

    if (countAll) countAll.innerText = allTechnicians.length;
    if (countAvail) countAvail.innerText = allTechnicians.filter(t => (t.status || 'available') === 'available').length;
    if (countBusy) countBusy.innerText = allTechnicians.filter(t => (t.status || '') === 'busy').length;
    if (countLeave) countLeave.innerText = allTechnicians.filter(t => (t.status || '') === 'on-leave').length;
  }

  window.loadStaffRoster = async function() {
    try {
      const res = await fetch('/api/admin/technicians', { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        allTechnicians = data.technicians || [];
        renderStaffRoster();
        updateStaffStats();
        populateTechniciansDropdown();
      }
    } catch (e) {
      console.error('Error loading staff roster:', e);
    }
  };

  function renderStaffRoster() {
    const grid = document.getElementById('staffRosterGrid');
    if (!grid) return;

    let filtered = allTechnicians;
    if (currentStaffFilter !== 'all') {
      filtered = allTechnicians.filter(t => (t.status || 'available').toLowerCase() === currentStaffFilter);
    }

    const search = (document.getElementById('staffSearchInput')?.value || '').toLowerCase().trim();
    if (search) {
      filtered = filtered.filter(t => 
        (t.name || '').toLowerCase().includes(search) ||
        (t.id || '').toLowerCase().includes(search) ||
        (t.phone || '').includes(search) ||
        (t.specialty || '').toLowerCase().includes(search) ||
        (t.specialtyLabel || '').toLowerCase().includes(search)
      );
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full p-12 text-center text-slate-400 glass-card rounded-2xl border border-slate-800">
          <div class="w-12 h-12 rounded-xl bg-slate-800 text-slate-500 mx-auto flex items-center justify-center mb-3">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
          </div>
          <h4 class="text-white font-bold text-base">No Staff Members Found</h4>
          <p class="text-xs text-slate-500 mt-1">Try adjusting your filter or click "Add New Staff" to register a technician.</p>
        </div>
      `;
      return;
    }

    const specialtyIcons = {
      camera: '📹',
      computer: '💻',
      electricity: '⚡',
      printer: '🖨️',
      general: '🔧'
    };

    grid.innerHTML = filtered.map(tech => {
      const status = tech.status || 'available';
      let statusPill = '';
      let borderGlow = 'border-slate-800';

      if (status === 'available') {
        statusPill = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Available</span>';
      } else if (status === 'busy') {
        statusPill = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30"><span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Busy / In Field</span>';
        borderGlow = 'border-amber-800/40';
      } else if (status === 'on-leave') {
        statusPill = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30"><span class="w-1.5 h-1.5 rounded-full bg-purple-400"></span> On Leave</span>';
      } else {
        statusPill = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-700/40 text-slate-400 border border-slate-700"><span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span> Offline</span>';
      }

      const icon = specialtyIcons[tech.specialty] || '🔧';
      const activeJobs = tech.activeJobs || 0;
      const activeJobsBadge = activeJobs > 0 
        ? `<span class="bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded text-[11px] border border-amber-500/30">${activeJobs} Active Task(s)</span>`
        : `<span class="bg-slate-800 text-slate-400 font-medium px-2 py-0.5 rounded text-[11px]">0 Active Tasks</span>`;

      return `
        <div class="glass-card bg-slate-900/90 border ${borderGlow} rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition shadow-lg relative group">
          <!-- Top Row -->
          <div>
            <div class="flex items-start justify-between gap-2 mb-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-sm shadow-md flex-shrink-0">
                  ${tech.name ? tech.name.charAt(0).toUpperCase() : 'T'}
                </div>
                <div>
                  <h4 class="font-bold text-white text-sm flex items-center gap-1.5">
                    ${escapeHtml(tech.name)}
                    <span class="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-slate-800 text-blue-300 border border-slate-700">${tech.id}</span>
                  </h4>
                  <div class="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <span>${icon} ${escapeHtml(tech.specialtyLabel || (tech.specialty ? tech.specialty.toUpperCase() : 'GENERAL'))}</span>
                    <span>•</span>
                    <span class="text-amber-400">★ ${tech.rating || 5.0}</span>
                  </div>
                </div>
              </div>
              <div>${statusPill}</div>
            </div>

            <!-- Contact & Stats Box -->
            <div class="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800/80 space-y-1.5 text-xs">
              <div class="flex items-center justify-between text-slate-300">
                <span class="text-slate-500 flex items-center gap-1">📞 Phone:</span>
                <a href="tel:${escapeHtml(tech.phone)}" class="text-blue-400 hover:underline font-mono">${escapeHtml(tech.phone)}</a>
              </div>
              <div class="flex items-center justify-between text-slate-300">
                <span class="text-slate-500 flex items-center gap-1">✉️ Email:</span>
                <span class="text-slate-300 truncate max-w-[170px]" title="${escapeHtml(tech.email || '')}">${escapeHtml(tech.email || 'N/A')}</span>
              </div>
              <div class="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px]">
                <span class="text-slate-400">Active Workload:</span>
                ${activeJobsBadge}
              </div>
            </div>
          </div>

          <!-- Bottom Control Bar -->
          <div class="mt-4 pt-3 border-t border-slate-800 flex flex-col gap-2.5">
            <!-- Status Switcher -->
            <div class="flex items-center justify-between gap-2">
              <label class="text-[11px] font-semibold text-slate-400 flex items-center gap-1">Status:</label>
              <select onchange="updateStaffStatus('${tech.id}', this.value)" class="bg-slate-800 border border-slate-700 text-xs rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-blue-500 flex-1">
                <option value="available" ${status === 'available' ? 'selected' : ''}>🟢 Available</option>
                <option value="busy" ${status === 'busy' ? 'selected' : ''}>🟡 Busy / In Field</option>
                <option value="on-leave" ${status === 'on-leave' ? 'selected' : ''}>🟣 On Leave</option>
                <option value="offline" ${status === 'offline' ? 'selected' : ''}>⚪ Offline</option>
              </select>
            </div>

            <!-- Action Buttons: Assign & Delete -->
            <div class="flex items-center gap-2">
              <button onclick="quickAssignToStaff('${tech.id}')" class="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition flex items-center justify-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                <span>Assign Task</span>
              </button>
              <button onclick="deleteStaff('${tech.id}', '${escapeHtml(tech.name)}')" title="Delete staff member and revoke portal access" class="py-1.5 px-3 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 text-xs font-semibold transition flex items-center justify-center gap-1">
                <svg class="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  window.updateStaffStatus = async function(techId, newStatus) {
    try {
      const res = await fetch(`/api/admin/technicians/${techId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ ${data.message || 'Staff status updated!'}`);
        await loadStaffRoster();
      } else {
        alert(data.message || 'Failed to update staff status.');
      }
    } catch (err) {
      console.error('Error updating staff status:', err);
      alert('Network error updating staff status.');
    }
  };

  window.deleteStaff = async function(techId, techName) {
    if (!confirm(`Are you sure you want to delete staff member "${techName}" (${techId})?\n\n- Their staff login account will be permanently deleted.\n- Any active tasks will be safely returned to the Pending queue for reassignment.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/technicians/${techId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        showToast(`🗑️ Staff member <strong>${escapeHtml(techName)}</strong> has been removed.`);
        await loadInitialData();
        await loadStaffRoster();
      } else {
        alert(data.message || 'Failed to delete staff member.');
      }
    } catch (err) {
      console.error('Error deleting staff:', err);
      alert('Network error deleting staff member.');
    }
  };

  window.quickAssignToStaff = function(techId) {
    openCreateTaskModal();
    const select = document.getElementById('newTaskStaffSelect');
    if (select) {
      select.value = techId;
    }
  };

  window.openAddStaffModal = function() {
    const modal = document.getElementById('addStaffModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  };

  window.closeAddStaffModal = function() {
    const modal = document.getElementById('addStaffModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  };

  // Add Staff Form submission
  const addStaffForm = document.getElementById('addStaffForm');
  if (addStaffForm) {
    addStaffForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('submitAddStaffBtn');
      const origText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerText = 'Registering...';

      const payload = {
        name: document.getElementById('newStaffName').value.trim(),
        phone: document.getElementById('newStaffPhone').value.trim(),
        specialty: document.getElementById('newStaffSpecialty').value,
        email: document.getElementById('newStaffEmail').value.trim(),
        status: document.getElementById('newStaffStatus').value,
        password: document.getElementById('newStaffPassword').value.trim() || 'tech123',
        address: document.getElementById('newStaffAddress').value.trim() || 'Pakistan'
      };

      try {
        const res = await fetch('/api/admin/technicians', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          closeAddStaffModal();
          addStaffForm.reset();
          showToast(`🎉 Staff member <strong>${escapeHtml(data.technician?.name || payload.name)}</strong> added!`);
          await loadInitialData();
          await loadStaffRoster();
        } else {
          alert(data.message || 'Failed to add staff member.');
        }
      } catch (err) {
        console.error('Error adding staff:', err);
        alert('Network error adding staff member.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origText;
      }
    });
  }

  // Staff Filters
  document.querySelectorAll('.staff-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.staff-filter-btn').forEach(b => b.classList.remove('bg-blue-600', 'text-white'));
      btn.classList.add('bg-blue-600', 'text-white');
      currentStaffFilter = btn.getAttribute('data-staff-filter');
      renderStaffRoster();
    });
  });

  document.getElementById('staffSearchInput')?.addEventListener('input', () => {
    renderStaffRoster();
  });

  // ---------------- LIVE CHAT SUPPORT CENTER ---------------- //

  function renderChatList() {
    const container = document.getElementById('chatSessionsList');
    if (!container) return;

    if (allSessions.length === 0) {
      container.innerHTML = `<div class="p-6 text-center text-sm text-gray-400">No chat sessions yet.</div>`;
      return;
    }

    container.innerHTML = allSessions.map(session => {
      const isActive = session.sessionId === activeSessionId;
      const isLive = session.status === 'live';
      const lastMsgText = session.lastMessage || (session.messages && session.messages.length > 0 ? session.messages[session.messages.length - 1].text : 'Joined chat');
      const timeStr = session.updatedAt ? new Date(session.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

      return `
        <div onclick="selectChat('${session.sessionId}')" class="p-3.5 border-b border-gray-800 cursor-pointer transition flex items-center justify-between ${
          isActive ? 'bg-blue-900/30 border-l-4 border-l-blue-500' : 'hover:bg-slate-800/50'
        }">
          <div class="flex-1 min-w-0 pr-2">
            <div class="flex items-center justify-between mb-1">
              <span class="font-semibold text-sm text-white truncate">${escapeHtml(session.customerName || 'Customer')}</span>
              <span class="text-[10px] text-gray-400">${timeStr}</span>
            </div>
            <p class="text-xs text-gray-300 truncate">${escapeHtml(lastMsgText)}</p>
            <div class="flex items-center gap-2 mt-1.5">
              ${isLive ? '<span class="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold flex items-center"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping mr-1"></span> LIVE</span>' : '<span class="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-semibold">🤖 Bot</span>'}
              ${session.phone ? `<span class="text-[10px] text-gray-400">${escapeHtml(session.phone)}</span>` : ''}
            </div>
          </div>
          ${session.unreadCount > 0 ? `<span class="bg-red-500 text-white text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">${session.unreadCount}</span>` : ''}
        </div>
      `;
    }).join('');
  }

  window.selectChat = function (sessionId) {
    activeSessionId = sessionId;
    const session = allSessions.find(s => s.sessionId === sessionId);
    if (!session) return;

    session.unreadCount = 0;
    renderChatList();
    renderActiveChatMessages(session);
  };

  function renderActiveChatMessages(session) {
    const headerEl = document.getElementById('activeChatHeader');
    const messagesEl = document.getElementById('activeChatMessages');
    const inputArea = document.getElementById('adminChatInputArea');
    const placeholder = document.getElementById('chatEmptyPlaceholder');

    if (placeholder) placeholder.classList.add('hidden');
    if (inputArea) inputArea.classList.remove('hidden');

    // Header info
    headerEl.innerHTML = `
      <div class="flex items-center justify-between w-full">
        <div>
          <h3 class="font-bold text-white text-base flex items-center gap-2">
            ${escapeHtml(session.customerName)}
            <span class="text-xs font-normal text-gray-400 font-mono">(${session.sessionId})</span>
          </h3>
          <div class="text-xs text-gray-300 flex items-center gap-3">
            <span>📞 ${session.phone || 'No phone provided'}</span>
            <span class="flex items-center">
              Mode: <strong class="ml-1 text-${session.status === 'live' ? 'emerald-400' : 'blue-400'}">${session.status.toUpperCase()}</strong>
            </span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="toggleSessionMode('${session.sessionId}', '${session.status === 'live' ? 'bot' : 'live'}')" class="px-3 py-1.5 rounded-lg text-xs font-semibold ${
            session.status === 'live' ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' : 'bg-emerald-600 text-white hover:bg-emerald-500'
          } transition">
            ${session.status === 'live' ? '🤖 Switch Back to Bot' : '👨‍💼 Take Over (Live Support)'}
          </button>
        </div>
      </div>
    `;

    // Messages
    messagesEl.innerHTML = '';
    (session.messages || []).forEach(msg => {
      const bubble = document.createElement('div');
      const isAgent = msg.sender === 'agent';
      const isCust = msg.sender === 'customer';

      bubble.className = `p-3 rounded-xl max-w-[80%] text-sm ${
        isAgent
          ? 'bg-blue-600 text-white ml-auto rounded-br-none'
          : isCust
          ? 'bg-slate-800 text-gray-100 mr-auto rounded-bl-none border border-slate-700'
          : 'bg-slate-900 text-gray-300 mr-auto rounded-bl-none border border-blue-900/50'
      }`;

      const senderLabel = isAgent ? '👨‍💼 Support Agent' : isCust ? '👤 Customer' : '🤖 ProService Bot';
      const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

      bubble.innerHTML = `
        <div class="text-[10px] font-bold opacity-75 mb-1">${senderLabel}</div>
        <div class="whitespace-pre-wrap">${escapeHtml(msg.text)}</div>
        <div class="text-[10px] opacity-60 text-right mt-1">${timeStr}</div>
      `;
      messagesEl.appendChild(bubble);
    });

    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Toggle Mode
  window.toggleSessionMode = function (sessionId, newMode) {
    socket.emit('admin_toggle_mode', { sessionId, mode: newMode });
    const session = allSessions.find(s => s.sessionId === sessionId);
    if (session) {
      session.status = newMode;
      renderChatList();
      renderActiveChatMessages(session);
    }
  };

  // Admin Send Message
  const adminMsgForm = document.getElementById('adminMsgForm');
  const adminMsgInput = document.getElementById('adminMsgInput');

  if (adminMsgForm) {
    adminMsgForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = adminMsgInput.value.trim();
      if (!text || !activeSessionId) return;

      const agentName = document.getElementById('agentNameInput')?.value || 'Support Agent';

      socket.emit('admin_message', {
        sessionId: activeSessionId,
        text,
        agentName
      });

      adminMsgInput.value = '';
    });
  }

  // Real-time Chat Socket Events
  socket.on('new_customer_message', ({ sessionId, session, message }) => {
    const idx = allSessions.findIndex(s => s.sessionId === sessionId);
    if (idx !== -1) {
      allSessions[idx] = session;
    } else {
      allSessions.unshift(session);
    }

    renderChatList();
    if (activeSessionId === sessionId) {
      renderActiveChatMessages(session);
    }

    playAlertSound();
    showToast(`💬 Message from ${session.customerName}: "${message.text.substring(0, 30)}..."`);
  });

  socket.on('agent_handoff_alert', ({ sessionId, session, alert }) => {
    const idx = allSessions.findIndex(s => s.sessionId === sessionId);
    if (idx !== -1) allSessions[idx] = session;
    else allSessions.unshift(session);

    renderChatList();
    if (activeSessionId === sessionId) {
      renderActiveChatMessages(session);
    }

    playAlertSound();
    showToast(`🚨 URGENT: ${session.customerName} requested a human support agent!`);
  });

  socket.on('session_updated', ({ sessionId, session }) => {
    const idx = allSessions.findIndex(s => s.sessionId === sessionId);
    if (idx !== -1) allSessions[idx] = session;
    renderChatList();
    if (activeSessionId === sessionId) {
      renderActiveChatMessages(session);
    }
  });

  socket.on('admin_message_sent', ({ sessionId, session }) => {
    const idx = allSessions.findIndex(s => s.sessionId === sessionId);
    if (idx !== -1) allSessions[idx] = session;
    renderChatList();
    if (activeSessionId === sessionId) {
      renderActiveChatMessages(session);
    }
  });

  socket.on('customer_is_typing', ({ sessionId, isTyping }) => {
    const indicator = document.getElementById('customerTypingNotice');
    if (!indicator) return;
    if (activeSessionId === sessionId && isTyping) {
      indicator.classList.remove('hidden');
    } else {
      indicator.classList.add('hidden');
    }
  });

  // Admin Login & Logout Handlers
  const loginForm = document.getElementById('adminLoginForm');
  const loginModal = document.getElementById('adminLoginModal');
  const loginError = document.getElementById('loginError');
  const quickDemoLoginBtn = document.getElementById('quickDemoLoginBtn');
  const logoutBtn = document.getElementById('adminLogoutBtn');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginError.classList.add('hidden');
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value.trim();
      const submitBtn = document.getElementById('loginSubmitBtn');
      const originalText = submitBtn.innerText;
      submitBtn.disabled = true;
      submitBtn.innerText = 'Signing In...';

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success && data.token) {
          authToken = data.token;
          localStorage.setItem('proservice_admin_token', authToken);
          loginModal.classList.add('hidden');
          loginModal.classList.remove('flex');
          checkAuth();
          loadInitialData();
          showToast('👋 Welcome back, ' + (data.user?.name || 'Admin') + '!');
        } else {
          loginError.innerText = data.message || 'Invalid credentials.';
          loginError.classList.remove('hidden');
        }
      } catch (err) {
        loginError.innerText = 'Network error during login.';
        loginError.classList.remove('hidden');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = originalText;
      }
    });
  }

  if (quickDemoLoginBtn) {
    quickDemoLoginBtn.addEventListener('click', () => {
      document.getElementById('loginEmail').value = 'admin@proservice.com';
      document.getElementById('loginPassword').value = 'admin123';
      loginForm.dispatchEvent(new Event('submit'));
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('proservice_admin_token');
      authToken = '';
      document.getElementById('adminUserBadge')?.classList.add('hidden');
      loginModal.classList.remove('hidden');
      loginModal.classList.add('flex');
    });
  }

  // Utilities
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-5 right-5 bg-blue-600 text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-2xl z-50 animate-bounce flex items-center gap-2 border border-blue-400';
    toast.innerHTML = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 4500);
  }
});

