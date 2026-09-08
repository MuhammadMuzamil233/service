const express = require('express');
const router = express.Router();
const InquiryController = require('../controllers/inquiryController');
const { validateInquiry } = require('../middlewares/validation');

// Public inquiry submission
router.post('/', validateInquiry, InquiryController.submit);

module.exports = router;
