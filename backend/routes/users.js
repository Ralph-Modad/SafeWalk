// backend/routes/users.js
const express = require('express');
const { check } = require('express-validator');
const { validateRequest } = require('../middleware/validation');
const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Protéger toutes les routes utilisateur
router.use(protect);

// Route pour mettre à jour le profil
router.put(
  '/profile',
  [
    check('name', 'Le nom est requis').optional().not().isEmpty(),
    check('preferences', 'Les préférences doivent être un objet').optional().isObject()
  ],
  validateRequest,
  userController.updateProfile
);

// Route pour mettre à jour le mot de passe
router.put(
  '/password',
  [
    check('currentPassword', 'Le mot de passe actuel est requis').not().isEmpty(),
    check('newPassword', 'Le nouveau mot de passe doit contenir au moins 6 caractères').isLength({ min: 6 })
  ],
  validateRequest,
  userController.updatePassword
);

module.exports = router;