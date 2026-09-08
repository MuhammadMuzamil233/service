const express = require('express');
const router = express.Router();
const ServiceController = require('../controllers/serviceController');

router.get('/', ServiceController.getAll);
router.get('/:id', ServiceController.getById);
router.post('/', ServiceController.create);
router.patch('/:id', ServiceController.update);

module.exports = router;
