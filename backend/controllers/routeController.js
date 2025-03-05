// backend/controllers/routeController.js
const Route = require('../models/Route');
const Report = require('../models/Report');
const googleMapsService = require('../services/googleMaps');
const safetyCalculator = require('../services/safetyCalculator');

// Obtenir des itinéraires sécurisés
exports.getSafeRoutes = async (req, res) => {
  try {
    const { origin, destination, preferences } = req.query;
    let userPreferences = req.user ? req.user.preferences : null;

    // Si des préférences spécifiques sont fournies dans la requête, les utiliser
    if (preferences) {
      try {
        userPreferences = JSON.parse(preferences);
      } catch (e) {
        console.error('Error parsing preferences:', e);
      }
    }

    // Convertir les adresses en coordonnées si nécessaire
    const originCoords = typeof origin === 'string' 
      ? origin.startsWith('{') ? JSON.parse(origin) : await googleMapsService.geocode(origin)
      : origin;
    
    const destinationCoords = typeof destination === 'string'
      ? destination.startsWith('{') ? JSON.parse(destination) : await googleMapsService.geocode(destination)
      : destination;

    // Valider les coordonnées
    if (!originCoords || !destinationCoords || 
        !originCoords.lat || !originCoords.lng || 
        !destinationCoords.lat || !destinationCoords.lng) {
      return res.status(400).json({
        success: false,
        message: 'Coordonnées de départ ou de destination invalides'
      });
    }

    console.log(`Recherche d'itinéraires de ${JSON.stringify(originCoords)} à ${JSON.stringify(destinationCoords)}`);

    // Obtenir les itinéraires possibles via l'API Google Maps
    const routes = await googleMapsService.getDirections(originCoords, destinationCoords);

    if (!routes || routes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Aucun itinéraire trouvé pour ces coordonnées'
      });
    }

    // Récupérer tous les reports dans la zone englobant l'origine et la destination
    const buffer = 0.005; // ~500m de marge autour des coordonnées 
    const reports = await Report.find({
      location: {
        $geoWithin: {
          $box: [
            [Math.min(originCoords.lng, destinationCoords.lng) - buffer, 
             Math.min(originCoords.lat, destinationCoords.lat) - buffer],
            [Math.max(originCoords.lng, destinationCoords.lng) + buffer,
             Math.max(originCoords.lat, destinationCoords.lat) + buffer]
          ]
        }
      },
      // Ne pas inclure les signalements temporaires expirés
      $or: [
        { temporary: false },
        { temporary: true, expiresAt: { $gt: new Date() } }
      ]
    });

    console.log(`Trouvé ${reports.length} signalements dans la zone`);

    // Calculer le score de sécurité pour chaque itinéraire
    const safeRoutes = await Promise.all(routes.map(async (route, index) => {
      const { safetyScore, safetyFactors, hotspots } = await safetyCalculator.calculateSafetyScore(
        route.path,
        userPreferences
      );

      // Déterminer un nom approprié pour cet itinéraire
      let routeName;
      if (index === 0) {
        routeName = 'Itinéraire recommandé'; // Premier itinéraire par défaut
      } else if (route.distance < routes[0].distance * 0.95) {
        routeName = 'Itinéraire le plus rapide';
      } else if (safetyScore > routes[0].safetyScore * 1.1) {
        routeName = 'Itinéraire le plus sûr';
      } else {
        routeName = `Itinéraire alternatif ${index}`;
      }

      return {
        id: `route_${index}`,
        name: routeName,
        origin: {
          lat: originCoords.lat,
          lng: originCoords.lng,
          formattedAddress: originCoords.formattedAddress || null
        },
        destination: {
          lat: destinationCoords.lat,
          lng: destinationCoords.lng,
          formattedAddress: destinationCoords.formattedAddress || null
        },
        distance: route.distance,
        duration: route.duration,
        path: route.path,
        steps: route.steps,
        safetyScore,
        safetyFactors,
        hotspots: hotspots.slice(0, 5), // Limiter aux 5 points chauds les plus importants
        summary: route.summary || `Via ${determineMainStreet(route)}`
      };
    }));

    // Trier d'abord par score de sécurité, puis par durée en cas d'égalité
    safeRoutes.sort((a, b) => {
      // Si les scores sont proches (moins de 10% de différence), privilégier le plus rapide
      if (Math.abs(a.safetyScore - b.safetyScore) < 1.0) {
        return a.duration - b.duration;
      }
      return b.safetyScore - a.safetyScore;
    });

    // Renommer le premier itinéraire comme "recommandé" après le tri
    if (safeRoutes.length > 0) {
      safeRoutes[0].name = 'Itinéraire recommandé';
    }

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

// Déterminer la rue principale d'un itinéraire pour le résumé
const determineMainStreet = (route) => {
  if (route.summary) return route.summary;
  
  if (route.steps && route.steps.length > 0) {
    // Trouver l'étape la plus longue (en distance)
    const mainStep = route.steps.reduce((longest, current) => 
      current.distance > longest.distance ? current : longest, 
      route.steps[0]
    );
    
    // Extraire le nom de la rue de l'instruction (simplification)
    const instruction = mainStep.instruction || '';
    const match = instruction.match(/<b>([^<]+)<\/b>/);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return "route alternative";
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
    const { routeId, routeData } = req.body;
    
    if (!routeId && !routeData) {
      return res.status(400).json({
        success: false,
        message: 'Données d\'itinéraire manquantes'
      });
    }
    
    // Si nous avons les données d'itinéraire complètes, les enregistrer
    if (routeData) {
      // Créer un nouvel itinéraire favori pour l'utilisateur
      const favorite = await Route.create({
        userId: req.user._id,
        ...routeData,
        isFavorite: true
      });
      
      return res.status(201).json({
        success: true,
        favorite
      });
    }
    
    // Sinon, retourner une erreur (implémentation future)
    res.status(400).json({
      success: false,
      message: 'Fonctionnalité non implémentée complètement. Veuillez fournir les données d\'itinéraire.'
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
    const favorites = await Route.find({ 
      userId: req.user._id,
      isFavorite: true
    }).sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: favorites.length,
      favorites
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
    const favorite = await Route.findOne({ 
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!favorite) {
      return res.status(404).json({
        success: false,
        message: 'Favori non trouvé'
      });
    }
    
    await favorite.deleteOne();
    
    res.status(200).json({
      success: true,
      message: 'Favori supprimé avec succès'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du favori',
      error: error.message
    });
  }
};