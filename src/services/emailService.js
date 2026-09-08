const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // In-memory OTP store: key -> { code, expiresAt, attempts }
    this.otpStore = new Map();
    this.OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
  }

  /**
   * Helper to format store key
   */
  _getStoreKey(email, type) {
    return `${(email || '').toLowerCase().trim()}::${type}`;
  }

  /**
   * Generate and store 6-digit OTP
   */
  generateOtp(email, type = 'register') {
    const cleanEmail = (email || '').toLowerCase().trim();
    const key = this._getStoreKey(cleanEmail, type);

    // Cryptographically sensible 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + this.OTP_EXPIRY_MS;

    this.otpStore.set(key, {
      code,
      expiresAt,
      attempts: 0
    });

    return { code, expiresAt };
  }

  /**
   * Verify an OTP provided by customer
   */
  verifyOtp(email, type, inputCode) {
    const cleanEmail = (email || '').toLowerCase().trim();
    const key = this._getStoreKey(cleanEmail, type);
    const entry = this.otpStore.get(key);

    if (!entry) {
      return { valid: false, message: 'No active verification code found. Please request a new one.' };
    }

    if (Date.now() > entry.expiresAt) {
      this.otpStore.delete(key);
      return { valid: false, message: 'Verification code has expired. Please request a new one.' };
    }

    entry.attempts = (entry.attempts || 0) + 1;
    if (entry.attempts > 5) {
      this.otpStore.delete(key);
      return { valid: false, message: 'Too many incorrect attempts. Please request a new code.' };
    }

    if (entry.code !== (inputCode || '').toString().trim()) {
      return { valid: false, message: 'Invalid verification code. Please check your Gmail and try again.' };
    }

    // Valid code - consume it
    this.otpStore.delete(key);
    return { valid: true };
  }

  /**
   * Send OTP email via Nodemailer (Gmail) or log in fallback mode
   */
  async sendOtpEmail({ to, code, type = 'register' }) {
    const cleanEmail = (to || '').toLowerCase().trim();
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    const subjects = {
      register: `ProService - Your Verification Code is ${code}`,
      login: `ProService - Your Sign In Code is ${code}`,
      forgot_password: `ProService - Password Reset Code is ${code}`
    };

    const actionNames = {
      register: 'Account Registration & Verification',
      login: 'Customer Sign In',
      forgot_password: 'Password Reset Request'
    };

    const subject = subjects[type] || `ProService Verification Code: ${code}`;
    const actionName = actionNames[type] || 'Verification';

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 16px; overflow: hidden; border: 1px solid #1e293b;">
        <div style="background: linear-gradient(135deg, #2563eb, #0284c7); padding: 28px 24px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">ProService</h1>
          <p style="margin: 4px 0 0 0; color: #bfdbfe; font-size: 13px; font-weight: 500;">Customer Support & Services Platform</p>
        </div>
        <div style="padding: 32px 28px;">
          <h2 style="margin: 0 0 12px 0; color: #ffffff; font-size: 18px;">${actionName}</h2>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
            Use the following 6-digit verification code to complete your ${actionName.toLowerCase()} on ProService. This code is valid for <strong>10 minutes</strong>.
          </p>
          <div style="background: #1e293b; border: 2px dashed #38bdf8; border-radius: 12px; padding: 18px; text-align: center; margin-bottom: 24px;">
            <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #38bdf8; display: inline-block;">
              ${code}
            </span>
          </div>
          <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0;">
            🔒 If you did not request this verification code, please ignore this email or contact support. Do not share this code with anyone.
          </p>
        </div>
        <div style="background: #090d16; padding: 16px 28px; text-align: center; border-top: 1px solid #1e293b; font-size: 11px; color: #475569;">
          &copy; ${new Date().getFullYear()} ProService Pakistan. All rights reserved.
        </div>
      </div>
    `;

    // Enforce real Gmail transmission using Nodemailer
    if (!emailUser || !emailPass) {
      console.warn('⚠️ [GMAIL NOT CONFIGURED] EMAIL_USER or EMAIL_PASS is empty in .env');
      return {
        success: false,
        status: 503,
        message: 'Gmail credentials not configured in .env. Barah-e-karam apne .env file me EMAIL_USER aur EMAIL_PASS (Google App Password) enter karein taake code real-time aapke Gmail par jaye.'
      };
    }

    try {
      const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
          user: emailUser,
          pass: emailPass
        }
      });

      const info = await transporter.sendMail({
        from: `"ProService" <${emailUser}>`,
        to: cleanEmail,
        subject,
        html: htmlContent,
        text: `Your ProService ${actionName} code is: ${code}. Valid for 10 minutes.`
      });

      console.log(`📧 [REAL GMAIL SENT] ID: ${info.messageId} to ${cleanEmail}`);
      return {
        success: true,
        sent: true,
        messageId: info.messageId
      };
    } catch (err) {
      console.error('⚠️ [REAL GMAIL FAILED]:', err.message);
      return {
        success: false,
        status: 500,
        message: `Gmail SMTP se email bhejna nakam raha: ${err.message}. Barah-e-karam apna Gmail address aur Google App Password check karein.`
      };
    }
  }
}

module.exports = new EmailService();
