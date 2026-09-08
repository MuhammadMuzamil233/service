const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { validateLogin } = require('../middlewares/validation');
const { authenticateToken } = require('../middlewares/authMiddleware');

router.post('/login', validateLogin, AuthController.login);
router.post('/staff-login', validateLogin, AuthController.login);
router.post('/staff-register', AuthController.staffRegister);
router.post('/staff-quick-login', AuthController.quickStaffLogin);
router.get('/me', authenticateToken, AuthController.getMe);
router.post('/change-password', authenticateToken, AuthController.changePassword);

// Customer Gmail Authentication & Password Reset Routes
router.post('/send-otp', AuthController.sendCustomerOtp);
router.post('/customer-register', AuthController.customerRegister);
router.post('/customer-login', AuthController.customerLogin);
router.post('/forgot-password', AuthController.forgotPassword);

module.exports = router;
