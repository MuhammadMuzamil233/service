/**
 * ProService - Customer Portal Logic
 * Gmail Authentication, OTP Verification, Booking Guard, Ticket Tracker & My Bookings
 */

document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  // Elements
  const bookingModal = document.getElementById('bookingModal');
  const trackingModal = document.getElementById('trackingModal');
  const successModal = document.getElementById('successModal');
  const customerAuthModal = document.getElementById('customerAuthModal');
  const myBookingsModal = document.getElementById('myBookingsModal');
  const bookingForm = document.getElementById('bookingForm');
  const trackingForm = document.getElementById('trackingForm');
  const serviceSelect = document.getElementById('serviceTypeSelect');
  const trackTicketInput = document.getElementById('trackTicketInput');
  const trackingResult = document.getElementById('trackingResult');
  const trackingError = document.getElementById('trackingError');

  // Customer Authentication State
  let customerToken = localStorage.getItem('proservice_customer_token') || '';
  let currentCustomer = null;
  try {
    currentCustomer = JSON.parse(localStorage.getItem('proservice_customer_user') || 'null');
  } catch (e) {
    currentCustomer = null;
  }
  let pendingServiceBooking = null;
  let otpTimerInterval = null;

  // Escape HTML helper
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.innerText = str;
    return div.innerHTML;
  }

  // ================= NAVBAR CUSTOMER PROFILE BADGE =================
  function updateCustomerNav() {
    const loginBtn = document.getElementById('custLoginNavBtn');
    const badge = document.getElementById('custUserBadge');
    const nameEl = document.getElementById('navCustName');
    const avatarEl = document.getElementById('navCustAvatar');

    if (customerToken && currentCustomer) {
      if (loginBtn) loginBtn.classList.add('hidden');
      if (badge) {
        badge.classList.remove('hidden');
        badge.classList.add('flex');
      }
      if (nameEl) nameEl.innerText = currentCustomer.name || 'Customer';
      if (avatarEl) avatarEl.innerText = (currentCustomer.name || 'C')[0].toUpperCase();
    } else {
      if (loginBtn) loginBtn.classList.remove('hidden');
      if (badge) {
        badge.classList.add('hidden');
        badge.classList.remove('flex');
      }
    }
  }
  updateCustomerNav();

  window.customerLogout = function () {
    localStorage.removeItem('proservice_customer_token');
    localStorage.removeItem('proservice_customer_user');
    customerToken = '';
    currentCustomer = null;
    updateCustomerNav();
    alert('Aap ProService account se log out ho chuke hain.');
  };

  // ================= CUSTOMER AUTH MODAL CONTROLS =================
  window.openCustomerAuthModal = function (tab = 'signin', alertMsg = '') {
    if (!customerAuthModal) return;
    customerAuthModal.classList.remove('hidden');
    customerAuthModal.classList.add('flex');
    window.switchCustAuthTab(tab);

    const alertEl = document.getElementById('custAuthAlert');
    const alertText = document.getElementById('custAuthAlertText');
    if (alertMsg && alertEl && alertText) {
      alertText.innerText = alertMsg;
      alertEl.classList.remove('hidden');
    } else if (alertEl) {
      alertEl.classList.add('hidden');
    }
    if (window.lucide) lucide.createIcons();
  };

  window.closeCustomerAuthModal = function () {
    if (!customerAuthModal) return;
    customerAuthModal.classList.add('hidden');
    customerAuthModal.classList.remove('flex');
  };

  window.switchCustAuthTab = function (tab) {
    const signInSection = document.getElementById('custSignInSection');
    const signUpSection = document.getElementById('custSignUpSection');
    const forgotSection = document.getElementById('custForgotSection');
    const tabSignInBtn = document.getElementById('tabCustSignInBtn');
    const tabSignUpBtn = document.getElementById('tabCustSignUpBtn');
    const titleEl = document.getElementById('custAuthModalTitle');
    const errEl = document.getElementById('custAuthError');
    const succEl = document.getElementById('custAuthSuccess');

    if (errEl) errEl.classList.add('hidden');
    if (succEl) succEl.classList.add('hidden');

    if (tab === 'signin') {
      if (signInSection) signInSection.classList.remove('hidden');
      if (signUpSection) signUpSection.classList.add('hidden');
      if (forgotSection) forgotSection.classList.add('hidden');
      if (tabSignInBtn) tabSignInBtn.className = 'flex-1 py-2 rounded-lg bg-blue-600 text-white transition flex items-center justify-center gap-1.5';
      if (tabSignUpBtn) tabSignUpBtn.className = 'flex-1 py-2 rounded-lg text-slate-400 hover:text-white transition flex items-center justify-center gap-1.5';
      if (titleEl) titleEl.innerText = 'Customer Sign In / کسٹمر لاگ ان';
    } else if (tab === 'signup') {
      if (signInSection) signInSection.classList.add('hidden');
      if (signUpSection) signUpSection.classList.remove('hidden');
      if (forgotSection) forgotSection.classList.add('hidden');
      if (tabSignInBtn) tabSignInBtn.className = 'flex-1 py-2 rounded-lg text-slate-400 hover:text-white transition flex items-center justify-center gap-1.5';
      if (tabSignUpBtn) tabSignUpBtn.className = 'flex-1 py-2 rounded-lg bg-blue-600 text-white transition flex items-center justify-center gap-1.5';
      if (titleEl) titleEl.innerText = 'Sign Up with Gmail / جی میل ویریفیکیشن';
    } else if (tab === 'forgot') {
      if (signInSection) signInSection.classList.add('hidden');
      if (signUpSection) signUpSection.classList.add('hidden');
      if (forgotSection) forgotSection.classList.remove('hidden');
      if (tabSignInBtn) tabSignInBtn.className = 'flex-1 py-2 rounded-lg text-slate-400 hover:text-white transition flex items-center justify-center gap-1.5';
      if (tabSignUpBtn) tabSignUpBtn.className = 'flex-1 py-2 rounded-lg text-slate-400 hover:text-white transition flex items-center justify-center gap-1.5';
      if (titleEl) titleEl.innerText = 'Reset Password / پاس ورڈ بھول گئے؟';
    }
  };

  // ================= GMAIL OTP REGISTRATION =================
  window.sendCustomerRegistrationOtp = async function () {
    const emailInput = document.getElementById('custRegEmail');
    const sendBtn = document.getElementById('custSendOtpBtn');
    const phoneInput = document.getElementById('custRegPhone');
    const errEl = document.getElementById('custAuthError');
    const succEl = document.getElementById('custAuthSuccess');
    const step2 = document.getElementById('custRegStep2');

    const phone = (phoneInput ? phoneInput.value : '').trim();
    const email = (emailInput ? emailInput.value : '').trim().toLowerCase();

    if (!phone) {
      alert('Pehle apna Pakistani mobile number (03XX-XXXXXXX) enter karein.');
      return;
    }

    const cleanPhone = phone.replace(/[\s\-()]/g, '');
    if (!/^(\+923|923|00923|03)[0-49][0-9]{8}$/.test(cleanPhone)) {
      alert('Barah-e-karam valid Pakistani mobile number enter karein (e.g. 0300-1234567 ya 03211234567).');
      return;
    }

    if (!email) {
      alert('Apna Gmail address enter karein.');
      return;
    }

    if (!email.endsWith('@gmail.com') && !email.endsWith('@googlemail.com')) {
      alert('Sirf authentic @gmail.com address accept kiya jata hai.');
      return;
    }

    sendBtn.disabled = true;
    sendBtn.innerText = 'Sending Code...';
    if (errEl) errEl.classList.add('hidden');
    if (succEl) succEl.classList.add('hidden');

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone, type: 'register' })
      });
      const data = await res.json();

      if (data.success) {
        if (succEl) {
          succEl.innerText = data.message;
          succEl.classList.remove('hidden');
        }
        if (step2) step2.classList.remove('hidden');
        // Clear any previous code so user enters real code from their Gmail
        const otpInput = document.getElementById('custRegOtp');
        if (otpInput) otpInput.value = '';
        startOtpCountdown();
      } else {
        if (errEl) {
          errEl.innerText = data.message || 'OTP sending failed.';
          errEl.classList.remove('hidden');
        } else {
          alert(data.message);
        }
      }
    } catch (err) {
      console.error(err);
      alert('Network error sending OTP code.');
    } finally {
      sendBtn.disabled = false;
      sendBtn.innerText = 'Send Code';
    }
  };

  function startOtpCountdown() {
    let secondsLeft = 60;
    const resendBtn = document.getElementById('custResendOtpBtn');
    const timerText = document.getElementById('custOtpTimerText');
    if (resendBtn) resendBtn.disabled = true;

    if (otpTimerInterval) clearInterval(otpTimerInterval);
    otpTimerInterval = setInterval(() => {
      secondsLeft--;
      if (timerText) timerText.innerText = `(${secondsLeft}s)`;
      if (secondsLeft <= 0) {
        clearInterval(otpTimerInterval);
        if (resendBtn) {
          resendBtn.disabled = false;
          resendBtn.innerText = 'Resend Code';
        }
        if (timerText) timerText.innerText = '';
      }
    }, 1000);
  }

  // Handle Registration Form Submit
  const custSignUpForm = document.getElementById('custSignUpForm');
  if (custSignUpForm) {
    custSignUpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('custRegName').value.trim();
      const phone = document.getElementById('custRegPhone').value.trim();
      const email = document.getElementById('custRegEmail').value.trim().toLowerCase();
      const otp = document.getElementById('custRegOtp').value.trim();
      const password = document.getElementById('custRegPassword').value;

      const errEl = document.getElementById('custAuthError');
      if (errEl) errEl.classList.add('hidden');

      const cleanPhone = phone.replace(/[\s\-()]/g, '');
      if (!/^(\+923|923|00923|03)[0-49][0-9]{8}$/.test(cleanPhone)) {
        if (errEl) {
          errEl.innerText = 'Barah-e-karam valid Pakistani mobile number enter karein (e.g. 0300-1234567).';
          errEl.classList.remove('hidden');
        } else {
          alert('Barah-e-karam valid Pakistani mobile number enter karein.');
        }
        return;
      }

      const submitBtn = document.getElementById('custRegSubmitBtn');
      const origText = submitBtn.innerText;
      submitBtn.disabled = true;
      submitBtn.innerText = 'Verifying & Registering...';

      try {
        const res = await fetch('/api/auth/customer-register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, phone, email, otp, password })
        });
        const data = await res.json();

        if (data.success && data.token) {
          localStorage.setItem('proservice_customer_token', data.token);
          localStorage.setItem('proservice_customer_user', JSON.stringify(data.user));
          localStorage.setItem('proservice_customer_name', data.user.name);
          localStorage.setItem('proservice_customer_phone', data.user.phone);

          customerToken = data.token;
          currentCustomer = data.user;
          updateCustomerNav();
          closeCustomerAuthModal();

          alert(`🎉 Mubarak! Welcome ${data.user.name}, aapka account kamyabi se verify aur register ho gaya hai.`);

          if (pendingServiceBooking) {
            const svc = pendingServiceBooking;
            pendingServiceBooking = null;
            openBookingModal(svc);
          }
        } else {
          if (errEl) {
            errEl.innerText = data.message || 'Registration failed.';
            errEl.classList.remove('hidden');
          } else {
            alert(data.message || 'Registration failed.');
          }
        }
      } catch (err) {
        console.error(err);
        alert('Network error registering customer account.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = origText;
      }
    });
  }

  // ================= CUSTOMER SIGN IN (GMAIL OR MOBILE NUMBER) =================
  const custSignInForm = document.getElementById('custSignInForm');
  if (custSignInForm) {
    custSignInForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const identifier = document.getElementById('custSignInEmail').value.trim();
      const password = document.getElementById('custSignInPassword').value;

      const submitBtn = document.getElementById('custSignInSubmitBtn');
      const origText = submitBtn.innerText;
      submitBtn.disabled = true;
      submitBtn.innerText = 'Signing In...';

      const errEl = document.getElementById('custAuthError');
      if (errEl) errEl.classList.add('hidden');

      try {
        const res = await fetch('/api/auth/customer-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password })
        });
        const data = await res.json();

        if (data.success && data.token) {
          localStorage.setItem('proservice_customer_token', data.token);
          localStorage.setItem('proservice_customer_user', JSON.stringify(data.user));
          localStorage.setItem('proservice_customer_name', data.user.name);
          localStorage.setItem('proservice_customer_phone', data.user.phone || '');

          customerToken = data.token;
          currentCustomer = data.user;
          updateCustomerNav();
          closeCustomerAuthModal();

          if (pendingServiceBooking) {
            const svc = pendingServiceBooking;
            pendingServiceBooking = null;
            openBookingModal(svc);
          }
        } else {
          if (errEl) {
            errEl.innerText = data.message || 'Invalid email or password.';
            errEl.classList.remove('hidden');
          } else {
            alert(data.message || 'Login failed.');
          }
        }
      } catch (err) {
        console.error(err);
        alert('Network error logging in.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = origText;
      }
    });
  }

  // ================= FORGOT PASSWORD (OTP RESET) =================
  window.sendForgotPasswordOtp = async function () {
    const email = document.getElementById('custForgotEmail').value.trim().toLowerCase();
    const sendBtn = document.getElementById('custForgotSendBtn');
    const step2 = document.getElementById('custForgotStep2');
    const errEl = document.getElementById('custAuthError');
    const succEl = document.getElementById('custAuthSuccess');

    if (!email) {
      alert('Apna registered Gmail address enter karein.');
      return;
    }

    sendBtn.disabled = true;
    sendBtn.innerText = 'Sending...';
    if (errEl) errEl.classList.add('hidden');
    if (succEl) succEl.classList.add('hidden');

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type: 'forgot_password' })
      });
      const data = await res.json();

      if (data.success) {
        if (succEl) {
          succEl.innerText = data.message;
          succEl.classList.remove('hidden');
        }
        if (step2) step2.classList.remove('hidden');
        const forgotOtpInput = document.getElementById('custForgotOtp');
        if (forgotOtpInput) forgotOtpInput.value = '';
      } else {
        if (errEl) {
          errEl.innerText = data.message || 'Failed to send reset code.';
          errEl.classList.remove('hidden');
        } else {
          alert(data.message);
        }
      }
    } catch (err) {
      console.error(err);
      alert('Network error sending reset code.');
    } finally {
      sendBtn.disabled = false;
      sendBtn.innerText = 'Send OTP';
    }
  };

  const custForgotForm = document.getElementById('custForgotForm');
  if (custForgotForm) {
    custForgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('custForgotEmail').value.trim().toLowerCase();
      const otp = document.getElementById('custForgotOtp').value.trim();
      const newPassword = document.getElementById('custForgotNewPass').value;

      const submitBtn = document.getElementById('custForgotSubmitBtn');
      const origText = submitBtn.innerText;
      submitBtn.disabled = true;
      submitBtn.innerText = 'Resetting Password...';

      const errEl = document.getElementById('custAuthError');
      if (errEl) errEl.classList.add('hidden');

      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp, newPassword })
        });
        const data = await res.json();

        if (data.success) {
          alert('✅ ' + data.message);
          window.switchCustAuthTab('signin');
          if (document.getElementById('custSignInEmail')) {
            document.getElementById('custSignInEmail').value = email;
          }
        } else {
          if (errEl) {
            errEl.innerText = data.message || 'Password reset failed.';
            errEl.classList.remove('hidden');
          } else {
            alert(data.message);
          }
        }
      } catch (err) {
        console.error(err);
        alert('Network error resetting password.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = origText;
      }
    });
  }

  // ================= BOOKING MODAL (STRICTLY GUARDED BY LOGIN) =================
  window.openBookingModal = function (serviceType = 'camera') {
    // Check if customer is authenticated!
    if (!customerToken || !currentCustomer) {
      pendingServiceBooking = serviceType;
      openCustomerAuthModal('signin', 'Tech book karne ke liye Gmail se sign in karna zaroori hai.');
      return;
    }

    if (serviceSelect) {
      serviceSelect.value = serviceType;
    }
    // Pre-fill name and phone from current authenticated customer
    if (document.getElementById('custName')) {
      document.getElementById('custName').value = currentCustomer.name || '';
    }
    if (document.getElementById('custPhone')) {
      document.getElementById('custPhone').value = currentCustomer.phone || '';
    }

    bookingModal.classList.remove('hidden');
    bookingModal.classList.add('flex');
    if (window.lucide) lucide.createIcons();
  };

  window.closeBookingModal = function () {
    bookingModal.classList.add('hidden');
    bookingModal.classList.remove('flex');
  };

  // ================= TRACKING MODAL =================
  window.openTrackingModal = function (prefillTicketId = '') {
    trackingModal.classList.remove('hidden');
    trackingModal.classList.add('flex');
    if (prefillTicketId && trackTicketInput) {
      trackTicketInput.value = prefillTicketId;
      fetchTicketStatus(prefillTicketId);
    }
  };

  window.closeTrackingModal = function () {
    trackingModal.classList.add('hidden');
    trackingModal.classList.remove('flex');
  };

  window.closeSuccessModal = function () {
    successModal.classList.add('hidden');
    successModal.classList.remove('flex');
  };

  // Close modals on escape or backdrop click
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeBookingModal();
      closeTrackingModal();
      closeSuccessModal();
      closeCustomerAuthModal();
      closeMyBookingsModal();
    }
  });

  [bookingModal, trackingModal, successModal, customerAuthModal, myBookingsModal].forEach(modal => {
    if (!modal) return;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
      }
    });
  });

  // Handle Booking Form Submit
  if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!customerToken || !currentCustomer) {
        closeBookingModal();
        openCustomerAuthModal('signin', 'Tech book karne ke liye Gmail se sign in karna zaroori hai.');
        return;
      }

      const submitBtn = bookingForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg> Submitting Booking...`;

      const payload = {
        customerName: document.getElementById('custName').value.trim(),
        phone: document.getElementById('custPhone').value.trim(),
        serviceType: document.getElementById('serviceTypeSelect').value,
        urgency: document.getElementById('urgencySelect').value,
        address: document.getElementById('custAddress').value.trim(),
        problemDescription: document.getElementById('problemDesc').value.trim()
      };

      try {
        const res = await fetch('/api/tickets', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${customerToken}`
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.status === 401) {
          alert('Aapka session expire ho gaya hai. Barah-e-karam dobara sign in karein.');
          customerLogout();
          openCustomerAuthModal('signin', 'Tech book karne ke liye Gmail se sign in karna zaroori hai.');
          return;
        }

        if (data.success && data.ticket) {
          localStorage.setItem('proservice_customer_name', payload.customerName);
          localStorage.setItem('proservice_customer_phone', payload.phone);
          localStorage.setItem('proservice_last_ticket', data.ticket.id);

          bookingForm.reset();
          closeBookingModal();

          // Show success popup with ticket
          showSuccessTicket(data.ticket);
        } else {
          alert(data.message || 'Booking failed. Please try again.');
        }
      } catch (err) {
        console.error('Error booking ticket:', err);
        alert('Could not submit booking. Please check your network connection.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

  function showSuccessTicket(ticket) {
    document.getElementById('successTicketId').innerText = ticket.id;
    document.getElementById('successServiceName').innerText = ticket.serviceName;
    document.getElementById('successCustomerName').innerText = ticket.customerName;
    document.getElementById('successUrgency').innerText = ticket.urgency;

    const trackBtn = document.getElementById('successTrackBtn');
    trackBtn.onclick = () => {
      closeSuccessModal();
      openTrackingModal(ticket.id);
    };

    const copyBtn = document.getElementById('copyTicketBtn');
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(ticket.id).then(() => {
        copyBtn.innerText = 'Copied!';
        setTimeout(() => copyBtn.innerText = 'Copy ID', 2000);
      });
    };

    successModal.classList.remove('hidden');
    successModal.classList.add('flex');
    if (window.lucide) lucide.createIcons();
  }

  // ================= MY BOOKINGS MODAL LOGIC =================
  window.openMyBookingsModal = async function () {
    if (!customerToken || !currentCustomer) {
      openCustomerAuthModal('signin', 'Apni bookings dekhne ke liye sign in karein.');
      return;
    }
    if (!myBookingsModal) return;
    myBookingsModal.classList.remove('hidden');
    myBookingsModal.classList.add('flex');

    const loadingEl = document.getElementById('myBookingsLoading');
    const emptyEl = document.getElementById('myBookingsEmpty');
    const listEl = document.getElementById('myBookingsList');

    if (loadingEl) loadingEl.classList.remove('hidden');
    if (emptyEl) emptyEl.classList.add('hidden');
    if (listEl) listEl.classList.add('hidden');

    try {
      const res = await fetch('/api/tickets/my/bookings', {
        headers: { 'Authorization': `Bearer ${customerToken}` }
      });
      const data = await res.json();

      if (loadingEl) loadingEl.classList.add('hidden');
      if (data.success && data.tickets && data.tickets.length > 0) {
        if (listEl) {
          listEl.innerHTML = data.tickets.map(t => `
            <div class="p-4 rounded-xl bg-slate-800/70 border border-slate-700/80 hover:border-blue-500/50 transition">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">${t.id}</span>
                    <span class="text-xs font-bold text-white">${escapeHtml(t.serviceName || t.serviceType)}</span>
                  </div>
                  <p class="text-xs text-slate-400 mt-1">${escapeHtml(t.problemDescription || 'No description')}</p>
                  <div class="text-[11px] text-slate-500 mt-1.5 flex items-center gap-3">
                    <span>📅 ${new Date(t.createdAt).toLocaleDateString()}</span>
                    <span>📍 ${escapeHtml(t.address)}</span>
                    ${t.assignedTo ? `<span class="text-emerald-400">👨‍🔧 ${escapeHtml(t.assignedTo)}</span>` : '<span class="text-amber-400">⏳ Assigning Staff...</span>'}
                  </div>
                </div>
                <div class="text-right flex-shrink-0">
                  <span class="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    t.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                    t.status === 'In Progress' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                    'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }">${t.status}</span>
                  <div class="mt-2">
                    <button onclick="closeMyBookingsModal(); openTrackingModal('${t.id}')" class="text-xs text-blue-400 hover:text-blue-300 underline font-medium">
                      Track Live ↗
                    </button>
                  </div>
                </div>
              </div>
            </div>
          `).join('');
          listEl.classList.remove('hidden');
        }
      } else {
        if (emptyEl) emptyEl.classList.remove('hidden');
      }
    } catch (err) {
      console.error('Error fetching bookings:', err);
      if (loadingEl) loadingEl.innerText = 'Failed to load bookings. Please try again.';
    }
  };

  window.closeMyBookingsModal = function () {
    if (!myBookingsModal) return;
    myBookingsModal.classList.add('hidden');
    myBookingsModal.classList.remove('flex');
  };

  // ================= TICKET TRACKING =================
  if (trackingForm) {
    trackingForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const ticketId = trackTicketInput.value.trim();
      if (ticketId) {
        fetchTicketStatus(ticketId);
      }
    });
  }

  async function fetchTicketStatus(ticketId) {
    trackingError.classList.add('hidden');
    trackingResult.classList.add('hidden');

    try {
      const res = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}`);
      const data = await res.json();

      if (data.success && data.ticket) {
        renderTicketDetails(data.ticket);
      } else {
        trackingError.innerText = data.message || `No ticket found matching ID "${ticketId}".`;
        trackingError.classList.remove('hidden');
      }
    } catch (err) {
      console.error(err);
      trackingError.innerText = 'Failed to load ticket information. Please try again.';
      trackingError.classList.remove('hidden');
    }
  }

  function renderTicketDetails(ticket) {
    document.getElementById('tktDetailId').innerText = ticket.id;
    document.getElementById('tktDetailService').innerText = ticket.serviceName;
    document.getElementById('tktDetailCustomer').innerText = ticket.customerName;
    document.getElementById('tktDetailPhone').innerText = ticket.phone;
    document.getElementById('tktDetailAddress').innerText = ticket.address;
    document.getElementById('tktDetailDesc').innerText = ticket.problemDescription || 'No description provided.';
    document.getElementById('tktDetailCreated').innerText = new Date(ticket.createdAt).toLocaleString();
    document.getElementById('tktDetailTech').innerText = ticket.assignedTo || 'Assigning nearest technician...';
    document.getElementById('tktDetailNotes').innerText = ticket.notes || 'Ticket created and in queue.';

    // Urgency badge
    const urgEl = document.getElementById('tktDetailUrgency');
    urgEl.innerText = ticket.urgency;
    urgEl.className = `text-xs px-2 py-0.5 rounded font-semibold ${
      ticket.urgency === 'Emergency' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
    }`;

    // Timeline steps: 1: Pending, 2: Assigned, 3: In Progress, 4: Completed
    const statusMap = {
      'Pending': 1,
      'Assigned': 2,
      'In Progress': 3,
      'Completed': 4,
      'Cancelled': -1
    };

    const currentStep = statusMap[ticket.status] || 1;
    const progressFill = document.getElementById('timelineProgressFill');
    const statusBadge = document.getElementById('tktDetailStatusBadge');

    statusBadge.innerText = ticket.status.toUpperCase();
    if (ticket.status === 'Completed') {
      statusBadge.className = 'text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    } else if (ticket.status === 'In Progress') {
      statusBadge.className = 'text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse';
    } else {
      statusBadge.className = 'text-xs font-bold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30';
    }

    if (progressFill) {
      if (currentStep === 1) progressFill.style.width = '12%';
      else if (currentStep === 2) progressFill.style.width = '38%';
      else if (currentStep === 3) progressFill.style.width = '70%';
      else if (currentStep === 4) progressFill.style.width = '100%';
    }

    for (let i = 1; i <= 4; i++) {
      const nodeEl = document.getElementById(`stepNode${i}`);
      if (!nodeEl) continue;
      if (i <= currentStep) {
        nodeEl.classList.remove('bg-gray-800', 'text-gray-500', 'border-gray-700');
        nodeEl.classList.add('bg-emerald-600', 'text-white', 'border-emerald-400');
      } else {
        nodeEl.classList.remove('bg-emerald-600', 'text-white', 'border-emerald-400');
        nodeEl.classList.add('bg-gray-800', 'text-gray-500', 'border-gray-700');
      }
    }

    trackingResult.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }

  // Real-time Ticket Status Update via WebSocket
  socket.on('ticket_updated', (updatedTicket) => {
    const activeTrackingId = trackTicketInput ? trackTicketInput.value.trim().toUpperCase() : '';
    if (activeTrackingId === updatedTicket.id) {
      renderTicketDetails(updatedTicket);
    }
  });

  // Language bilingual toggle helper
  let currentLang = 'bilingual';
  const langToggleBtn = document.getElementById('langToggleBtn');
  if (langToggleBtn) {
    langToggleBtn.addEventListener('click', () => {
      if (currentLang === 'bilingual') {
        currentLang = 'urdu';
        document.querySelectorAll('.urdu-only').forEach(el => el.classList.remove('hidden'));
        document.querySelectorAll('.eng-only').forEach(el => el.classList.add('hidden'));
        langToggleBtn.innerText = 'Language: اردو';
      } else if (currentLang === 'urdu') {
        currentLang = 'eng';
        document.querySelectorAll('.urdu-only').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.eng-only').forEach(el => el.classList.remove('hidden'));
        langToggleBtn.innerText = 'Language: English';
      } else {
        currentLang = 'bilingual';
        document.querySelectorAll('.urdu-only').forEach(el => el.classList.remove('hidden'));
        document.querySelectorAll('.eng-only').forEach(el => el.classList.remove('hidden'));
        langToggleBtn.innerText = 'Language: Auto / دونوں';
      }
    });
  }
});
