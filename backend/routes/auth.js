// backend/routes/auth.js
const express = require('express');
const { check } = require('express-validator');
const { validateRequest } = require('../middleware/validation');
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Route d'inscription
router.post(
  '/register',
  [
    check('name', 'Le nom est requis').not().isEmpty(),
    check('email', 'Veuillez inclure un email valide').isEmail(),
    check('password', 'Le mot de passe doit contenir au moins 6 caractères').isLength({ min: 6 })
  ],
  validateRequest,
  authController.register
);

// Route de connexion
router.post(
  '/login',
  [
    check('email', 'Veuillez inclure un email valide').isEmail(),
    check('password', 'Le mot de passe est requis').exists()
  ],
  validateRequest,
  authController.login
);

// Route pour obtenir le profil utilisateur (protégée)
router.get('/me', protect, authController.getMe);

module.exports = router;