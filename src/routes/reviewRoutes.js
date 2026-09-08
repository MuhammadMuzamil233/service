const express = require('express');
const router = express.Router();
const ReviewController = require('../controllers/reviewController');
const { validateReview } = require('../middlewares/validation');

router.get('/', ReviewController.getAll);
router.post('/', validateReview, ReviewController.submit);

module.exports = router;
