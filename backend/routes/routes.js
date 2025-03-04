// backend/routes/routes.js
const express = require('express');
const { check } = require('express-validator');
const { validateRequest } = require('../middleware/validation');
const routeController = require('../controllers/routeController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Obtenir des itinéraires sécurisés (accessible sans authentification)
router.get(
  '/',
  [
    check('origin', 'L\'origine est requise').not().isEmpty(),
    check('destination', 'La destination est requise').not().isEmpty()
  ],
  validateRequest,
  routeController.getSafeRoutes
);

// Obtenir un itinéraire spécifique
router.get('/:id', routeController.getRoute);

// Routes protégées
router.use(protect);

// Sauvegarder un itinéraire favori
router.post(
  '/favorites',
  [
    check('routeId', 'L\'ID de l\'itinéraire est requis').not().isEmpty()
  ],
  validateRequest,
  routeController.saveFavorite
);

// Obtenir les itinéraires favoris de l'utilisateur
router.get('/favorites', routeController.getFavorites);

// Supprimer un itinéraire favori
router.delete('/favorites/:id', routeController.removeFavorite);

module.exports = router;