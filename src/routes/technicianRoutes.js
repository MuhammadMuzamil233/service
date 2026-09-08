const express = require('express');
const router = express.Router();
const TechnicianController = require('../controllers/technicianController');
const { validateTechnician } = require('../middlewares/validation');
const { optionalAuth } = require('../middlewares/authMiddleware');

router.get('/', optionalAuth, TechnicianController.getAll);
router.get('/:id', TechnicianController.getById);
router.post('/', validateTechnician, TechnicianController.create);
router.patch('/:id', TechnicianController.update);
router.delete('/:id', TechnicianController.delete);

module.exports = router;
