// backend/controllers/routeController.js
const Route = require('../models/Route');
const googleMapsService = require('../services/googleMaps');
const safetyCalculator = require('../services/safetyCalculator');

// Obtenir des itinéraires sécurisés
exports.getSafeRoutes = async (req, res) => {
  try {
    const { origin, destination } = req.query;
    const userPreferences = req.user ? req.user.preferences : null;

    // Convertir les adresses en coordonnées si nécessaire
    const originCoords = typeof origin === 'string' 
      ? await googleMapsService.geocode(origin)
      : JSON.parse(origin);
    
    const destinationCoords = typeof destination === 'string'
      ? await googleMapsService.geocode(destination)
      : JSON.parse(destination);

    // Obtenir les itinéraires possibles via l'API Google Maps
    const routes = await googleMapsService.getDirections(originCoords, destinationCoords);

    // Calculer le score de sécurité pour chaque itinéraire
    const safeRoutes = await Promise.all(routes.map(async (route, index) => {
      const { safetyScore, safetyFactors } = await safetyCalculator.calculateSafetyScore(
        route.path,
        userPreferences
      );

      return {
        id: `route_${index}`,
        name: index === 0 ? 'Itinéraire le plus sûr' : 
              index === 1 ? 'Itinéraire le plus rapide' : 
              `Itinéraire alternatif ${index}`,
        origin: {
          lat: originCoords.lat,
          lng: originCoords.lng
        },
        destination: {
          lat: destinationCoords.lat,
          lng: destinationCoords.lng
        },
        distance: route.distance,
        duration: route.duration,
        path: route.path,
        steps: route.steps,
        safetyScore,
        safetyFactors
      };
    }));

    // Trier par score de sécurité (du plus sûr au moins sûr)
    safeRoutes.sort((a, b) => b.safetyScore - a.safetyScore);

    res.status(200).json({
      success: true,
      count: safeRoutes.length,
      routes: safeRoutes
    });
  } catch (error) {
    console.error('Error getting safe routes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche d\'itinéraires',
      error: error.message
    });
  }
};

// Obtenir un itinéraire spécifique
exports.getRoute = async (req, res) => {
  try {
    const route = await Route.findById(req.params.id);
    
    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Itinéraire non trouvé'
      });
    }
    
    res.status(200).json({
      success: true,
      route
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'itinéraire',
      error: error.message
    });
  }
};

// Sauvegarder un itinéraire favori
exports.saveFavorite = async (req, res) => {
  try {
    // Implémentation à venir pour sauvegarder un itinéraire favori
    res.status(501).json({
      success: false,
      message: 'Fonctionnalité non implémentée'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement du favori',
      error: error.message
    });
  }
};

// Obtenir les itinéraires favoris de l'utilisateur
exports.getFavorites = async (req, res) => {
  try {
    // Implémentation à venir pour récupérer les itinéraires favoris
    res.status(501).json({
      success: false,
      message: 'Fonctionnalité non implémentée'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des favoris',
      error: error.message
    });
  }
};

// Supprimer un itinéraire favori
exports.removeFavorite = async (req, res) => {
  try {
    // Implémentation à venir pour supprimer un itinéraire favori
    res.status(501).json({
      success: false,
      message: 'Fonctionnalité non implémentée'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du favori',
      error: error.message
    });
  }
};