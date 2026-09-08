const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { readDb, saveDb } = require('../config/db');
const EmailService = require('../services/emailService');

const JWT_SECRET = process.env.JWT_SECRET || 'proservice_super_secret_jwt_key_2026_secure';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Validate that an email is a real, authentic Gmail address
 */
function isValidGmail(email) {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();
  // Format: username@gmail.com or username@googlemail.com
  // Google standard username: letters, numbers, dots, minimum 4 characters
  const gmailRegex = /^[a-z0-9](\.?[a-z0-9]){3,}@(gmail|googlemail)\.com$/i;
  return gmailRegex.test(clean);
}

/**
 * Validate Pakistani mobile number format:
 * Matches: 03001234567, 0300-1234567, +923001234567, 923001234567, 00923001234567
 */
function isValidPakistaniPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.replace(/[\s\-()]/g, '');
  return /^(\+923|923|00923|03)[0-49][0-9]{8}$/.test(cleaned);
}

/**
 * Standardize phone number to 11 digits: 03XXXXXXXXX
 */
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  let cleaned = phone.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+92')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('0092')) {
    cleaned = '0' + cleaned.slice(4);
  } else if (cleaned.startsWith('92')) {
    cleaned = '0' + cleaned.slice(2);
  }
  return cleaned;
}

class AuthController {
  /**
   * User / Admin Login
   */
  static async login(req, res) {
    try {
      const { email, password } = req.body;
      const cleanEmail = (email || '').toLowerCase().trim();

      const db = readDb();
      const user = (db.users || []).find(u => u.email.toLowerCase() === cleanEmail);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email address or password.'
        });
      }

      const isMatch = bcrypt.compareSync(password, user.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email address or password.'
        });
      }

      // Generate JWT Token
      const token = jwt.sign(
        {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          technicianId: user.technicianId || null,
          specialty: user.specialty || null
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.json({
        success: true,
        message: 'Login successful!',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          technicianId: user.technicianId || null,
          specialty: user.specialty || null,
          phone: user.phone || null
        }
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ success: false, message: 'Server error during login.' });
    }
  }

  /**
   * Quick Staff Login (Demo/Testing Switcher by Technician ID)
   */
  static async quickStaffLogin(req, res) {
    try {
      const { technicianId } = req.body;
      const db = readDb();

      let user = (db.users || []).find(u => u.technicianId === technicianId);
      if (!user) {
        // Fallback: look up in technicians table and link
        const tech = (db.technicians || []).find(t => t.id === technicianId);
        if (tech) {
          user = {
            id: `usr_${tech.id.toLowerCase()}`,
            name: tech.name,
            email: tech.email.toLowerCase(),
            role: 'technician',
            technicianId: tech.id,
            specialty: tech.specialty,
            phone: tech.phone
          };
        }
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          message: `Technician with ID ${technicianId} not found.`
        });
      }

      const token = jwt.sign(
        {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          technicianId: user.technicianId,
          specialty: user.specialty
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.json({
        success: true,
        message: `Switched to staff account: ${user.name}`,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          technicianId: user.technicianId,
          specialty: user.specialty,
          phone: user.phone
        }
      });
    } catch (err) {
      console.error('Quick staff login error:', err);
      res.status(500).json({ success: false, message: 'Server error during quick switch.' });
    }
  }

  /**
   * Staff / Technician Registration (Sign Up)
   */
  static async staffRegister(req, res) {
    try {
      const { name, email, password, phone, specialty, address } = req.body;

      if (!name || !email || !password || !phone) {
        return res.status(400).json({
          success: false,
          message: 'Full name, email, password, and phone are required.'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long.'
        });
      }

      const cleanEmail = email.toLowerCase().trim();
      const db = readDb();

      // Check if email already exists
      if ((db.users || []).some(u => u.email.toLowerCase() === cleanEmail)) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email already exists. Please sign in.'
        });
      }

      // Generate unique Technician ID
      let techCode;
      let technicianId;
      do {
        techCode = Math.floor(100 + Math.random() * 900);
        technicianId = `TECH-${techCode}`;
      } while ((db.technicians || []).some(t => t.id === technicianId));

      const validSpecialty = (specialty || 'general').toLowerCase();
      const specialtyLabels = {
        camera: 'Camera & CCTV Specialist',
        computer: 'Computer & Laptop Expert',
        electricity: 'Certified Electrician',
        printer: 'Printer & Toner Tech',
        general: 'General Technician'
      };

      const newTechnician = {
        id: technicianId,
        name: name.trim(),
        phone: phone.trim(),
        email: cleanEmail,
        specialty: validSpecialty,
        specialtyLabel: specialtyLabels[validSpecialty] || `${validSpecialty.toUpperCase()} Specialist`,
        rating: 5.0,
        jobsCompleted: 0,
        status: 'available',
        address: (address || 'Pakistan').trim(),
        createdAt: new Date().toISOString()
      };

      const hashedPassword = bcrypt.hashSync(password, 10);
      const newUser = {
        id: `usr_${technicianId.toLowerCase()}`,
        name: name.trim(),
        email: cleanEmail,
        password: hashedPassword,
        role: 'technician',
        technicianId: technicianId,
        specialty: validSpecialty,
        phone: phone.trim(),
        createdAt: new Date().toISOString()
      };

      if (!db.technicians) db.technicians = [];
      if (!db.users) db.users = [];

      db.technicians.push(newTechnician);
      db.users.push(newUser);
      saveDb(db);

      // Generate JWT Token
      const token = jwt.sign(
        {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          technicianId: newUser.technicianId,
          specialty: newUser.specialty
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.status(201).json({
        success: true,
        message: `Welcome ${name.trim()}! Staff registration successful.`,
        token,
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          technicianId: newUser.technicianId,
          specialty: newUser.specialty,
          phone: newUser.phone
        },
        technician: newTechnician
      });
    } catch (err) {
      console.error('Staff registration error:', err);
      res.status(500).json({ success: false, message: 'Server error registering staff account.' });
    }
  }

  /**
   * Get current authenticated user profile
   */
  static async getMe(req, res) {
    res.json({
      success: true,
      user: req.user
    });
  }

  /**
   * Change admin password
   */
  static async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters long.'
        });
      }

      const db = readDb();
      const userIndex = db.users.findIndex(u => u.id === req.user.id);
      if (userIndex === -1) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      const user = db.users[userIndex];
      const isMatch = bcrypt.compareSync(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
      }

      user.password = bcrypt.hashSync(newPassword, 10);
      user.updatedAt = new Date().toISOString();
      db.users[userIndex] = user;
      saveDb(db);

      res.json({
        success: true,
        message: 'Password changed successfully!'
      });
    } catch (err) {
      console.error('Password change error:', err);
      res.status(500).json({ success: false, message: 'Server error changing password.' });
    }
  }

  /**
   * Send 6-Digit OTP Code to Customer Gmail
   */
  static async sendCustomerOtp(req, res) {
    try {
      const { email, phone, type = 'register' } = req.body;
      const cleanEmail = (email || '').toLowerCase().trim();

      if (!cleanEmail) {
        return res.status(400).json({
          success: false,
          message: 'Gmail address is required.'
        });
      }

      if (!isValidGmail(cleanEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid Gmail address. Barah-e-karam authentic @gmail.com email likhein.'
        });
      }

      const db = readDb();
      const existingUser = (db.users || []).find(u => u.email.toLowerCase() === cleanEmail);

      if (type === 'register') {
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'Is Gmail address par pehle se account registered hai. Barah-e-karam sign in karein.'
          });
        }

        // Check phone uniqueness if phone is provided
        if (phone) {
          if (!isValidPakistaniPhone(phone)) {
            return res.status(400).json({
              success: false,
              message: 'Barah-e-karam valid Pakistani mobile number enter karein (e.g. 0300-1234567 ya 03211234567).'
            });
          }
          const normPhone = normalizePhone(phone);
          const phoneExists = (db.users || []).some(u => u.phone && normalizePhone(u.phone) === normPhone);
          if (phoneExists) {
            return res.status(400).json({
              success: false,
              message: 'Ye mobile number pehle se doosre account ke sath registered hai. Har number par sirf aik hi account allow hai.'
            });
          }
        }
      }

      if (type === 'forgot_password' && !existingUser) {
        return res.status(404).json({
          success: false,
          message: 'Is Gmail address par koi account registered nahi hai. Barah-e-karam pehle sign up karein.'
        });
      }

      // Generate OTP and dispatch via real Gmail
      const { code } = EmailService.generateOtp(cleanEmail, type);
      const emailResult = await EmailService.sendOtpEmail({ to: cleanEmail, code, type });

      if (!emailResult.success) {
        return res.status(emailResult.status || 500).json({
          success: false,
          message: emailResult.message
        });
      }

      res.json({
        success: true,
        message: `6-digit verification code aapke Gmail (${cleanEmail}) par real-time send kar diya gaya hai. Barah-e-karam apna Inbox aur Spam/Junk folder check karein.`
      });
    } catch (err) {
      console.error('Send OTP error:', err);
      res.status(500).json({ success: false, message: 'Verification code send karne me masla pesh aaya. Dobara koshish karein.' });
    }
  }

  /**
   * Register Customer with Gmail and Verified OTP
   * Enforces Unique Gmail, Unique Valid Pakistani Mobile Number
   */
  static async customerRegister(req, res) {
    try {
      const { name, email, password, phone, otp } = req.body;
      const cleanEmail = (email || '').toLowerCase().trim();

      if (!name || !cleanEmail || !password || !phone || !otp) {
        return res.status(400).json({
          success: false,
          message: 'Naam, Gmail address, mobile number, password aur 6-digit OTP tamam zaroori hain.'
        });
      }

      if (!isValidGmail(cleanEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Barah-e-karam authentic @gmail.com email address provide karein.'
        });
      }

      // Strict Pakistani Mobile Number Validation
      if (!isValidPakistaniPhone(phone)) {
        return res.status(400).json({
          success: false,
          message: 'Barah-e-karam valid Pakistani mobile number enter karein (e.g. 0300-1234567 ya 03211234567).'
        });
      }

      const normalizedPhone = normalizePhone(phone);

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password kam az kam 6 characters ka hona chahiye.'
        });
      }

      // Verify OTP
      const otpCheck = EmailService.verifyOtp(cleanEmail, 'register', otp);
      if (!otpCheck.valid) {
        return res.status(400).json({
          success: false,
          message: otpCheck.message
        });
      }

      const db = readDb();

      // Enforce: One Account per Gmail
      if ((db.users || []).some(u => u.email.toLowerCase() === cleanEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Is Gmail address par pehle se account registered hai. Barah-e-karam sign in karein.'
        });
      }

      // Enforce: One Account per Mobile Number
      if ((db.users || []).some(u => u.phone && normalizePhone(u.phone) === normalizedPhone)) {
        return res.status(400).json({
          success: false,
          message: `Ye mobile number (${phone}) pehle se kisi doosre account ke sath registered hai. Har phone number par sirf aik hi account ban sakta hai.`
        });
      }

      const hashedPassword = bcrypt.hashSync(password, 10);
      const newCustomer = {
        id: `cust_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
        name: name.trim(),
        email: cleanEmail,
        password: hashedPassword,
        phone: normalizedPhone,
        role: 'customer',
        emailVerified: true,
        createdAt: new Date().toISOString()
      };

      if (!db.users) db.users = [];
      db.users.push(newCustomer);
      saveDb(db);

      const token = jwt.sign(
        {
          id: newCustomer.id,
          name: newCustomer.name,
          email: newCustomer.email,
          role: 'customer',
          phone: newCustomer.phone
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.status(201).json({
        success: true,
        message: `Welcome, ${newCustomer.name}! Aapka account kamyabi se verify aur register ho gaya hai.`,
        token,
        user: {
          id: newCustomer.id,
          name: newCustomer.name,
          email: newCustomer.email,
          role: newCustomer.role,
          phone: newCustomer.phone
        }
      });
    } catch (err) {
      console.error('Customer registration error:', err);
      res.status(500).json({ success: false, message: 'Customer registration me server error pesh aaya.' });
    }
  }

  /**
   * Customer Sign In (Supports EITHER Gmail OR Mobile Number + Password/OTP)
   */
  static async customerLogin(req, res) {
    try {
      const { email, identifier, password, otp } = req.body;
      const inputId = (identifier || email || '').trim();

      if (!inputId) {
        return res.status(400).json({
          success: false,
          message: 'Gmail address ya mobile number likhein.'
        });
      }

      const db = readDb();
      let user = null;

      // Check if input is an email address
      if (inputId.includes('@')) {
        const cleanEmail = inputId.toLowerCase();
        user = (db.users || []).find(u => u.email.toLowerCase() === cleanEmail);
      } else {
        // Mobile number login
        const normInput = normalizePhone(inputId);
        user = (db.users || []).find(u => u.phone && normalizePhone(u.phone) === normInput);
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Is Gmail address ya mobile number se koi registered account nahi mila. Barah-e-karam sign up karein.'
        });
      }

      // Check auth via OTP if provided, else check password
      if (otp) {
        const otpCheck = EmailService.verifyOtp(user.email, 'login', otp);
        if (!otpCheck.valid) {
          return res.status(400).json({ success: false, message: otpCheck.message });
        }
      } else {
        if (!password) {
          return res.status(400).json({
            success: false,
            message: 'Sign in karne ke liye password zaroori hai.'
          });
        }
        const isMatch = bcrypt.compareSync(password, user.password);
        if (!isMatch) {
          return res.status(401).json({
            success: false,
            message: 'Ghalat password. Agar password bhool gaye hain toh "Forgot Password" ka option use karein.'
          });
        }
      }

      const token = jwt.sign(
        {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role || 'customer',
          phone: user.phone || null
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.json({
        success: true,
        message: `Welcome back, ${user.name}!`,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role || 'customer',
          phone: user.phone || null
        }
      });
    } catch (err) {
      console.error('Customer login error:', err);
      res.status(500).json({ success: false, message: 'Customer login me masla pesh aaya.' });
    }
  }

  /**
   * Forgot Password - Reset Password with Verified Gmail OTP
   */
  static async forgotPassword(req, res) {
    try {
      const { email, otp, newPassword } = req.body;
      const cleanEmail = (email || '').toLowerCase().trim();

      if (!cleanEmail || !otp || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Gmail address, 6-digit OTP code, and new password are required.'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters long.'
        });
      }

      // Verify OTP for forgot_password
      const otpCheck = EmailService.verifyOtp(cleanEmail, 'forgot_password', otp);
      if (!otpCheck.valid) {
        return res.status(400).json({
          success: false,
          message: otpCheck.message
        });
      }

      const db = readDb();
      const userIndex = (db.users || []).findIndex(u => u.email.toLowerCase() === cleanEmail);

      if (userIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'No registered user found with this Gmail address.'
        });
      }

      // Update password
      db.users[userIndex].password = bcrypt.hashSync(newPassword, 10);
      db.users[userIndex].updatedAt = new Date().toISOString();
      saveDb(db);

      res.json({
        success: true,
        message: 'Password has been reset successfully! You can now log in with your new password.'
      });
    } catch (err) {
      console.error('Forgot password error:', err);
      res.status(500).json({ success: false, message: 'Server error resetting password.' });
    }
  }
}

module.exports = AuthController;
