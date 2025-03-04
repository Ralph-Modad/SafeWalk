// backend/routes/reports.js
const express = require('express');
const { check } = require('express-validator');
const { validateRequest } = require('../middleware/validation');
const reportController = require('../controllers/reportController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Protéger toutes les routes de reports
router.use(protect);

// Route pour créer un nouveau rapport
router.post(
  '/',
  [
    check('location', 'La localisation est requise').not().isEmpty(),
    check('location.lat', 'La latitude est requise').not().isEmpty(),
    check('location.lng', 'La longitude est requise').not().isEmpty(),
    check('category', 'La catégorie est requise').isIn([
      'poor_lighting', 'unsafe_area', 'construction', 'obstacle', 'bad_weather'
    ]),
    check('severity', 'La sévérité doit être entre 1 et 5').isInt({ min: 1, max: 5 })
  ],
  validateRequest,
  reportController.createReport
);

// Route pour obtenir les rapports dans une zone
router.get('/', reportController.getReports);

// Route pour obtenir un rapport spécifique
router.get('/:id', reportController.getReport);

// Route pour mettre à jour un rapport
router.put(
  '/:id',
  [
    check('category', 'La catégorie doit être valide').optional().isIn([
      'poor_lighting', 'unsafe_area', 'construction', 'obstacle', 'bad_weather'
    ]),
    check('severity', 'La sévérité doit être entre 1 et 5').optional().isInt({ min: 1, max: 5 })
  ],
  validateRequest,
  reportController.updateReport
);

// Route pour supprimer un rapport
router.delete('/:id', reportController.deleteReport);

module.exports = router;