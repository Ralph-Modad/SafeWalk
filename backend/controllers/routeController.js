// backend/controllers/routeController.js
const Report = require('../models/Report');
const googleMapsService = require('../services/googleMaps');
const safetyCalculator = require('../services/safetyCalculator');
const helpers = require('../utils/helpers');
const config = require('../config/config');

/**
 * Obtenir des itinéraires sécurisés
 * @param {Object} req - Requête HTTP
 * @param {Object} res - Réponse HTTP
 */
exports.getSafeRoutes = async (req, res) => {
  try {
    const { origin, destination, preferences } = req.query;
    
    // Récupérer les préférences utilisateur ou utiliser des valeurs par défaut
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
    let originCoords, destinationCoords;
    
    try {
      originCoords = typeof origin === 'string' 
        ? origin.startsWith('{') ? JSON.parse(origin) : await googleMapsService.geocode(origin)
        : origin;
      
      destinationCoords = typeof destination === 'string'
        ? destination.startsWith('{') ? JSON.parse(destination) : await googleMapsService.geocode(destination)
        : destination;
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Erreur lors de la conversion des adresses en coordonnées. ' + error.message
      });
    }

    // Valider les coordonnées
    if (!originCoords || !destinationCoords || 
        !originCoords.lat || !originCoords.lng || 
        !destinationCoords.lat || !destinationCoords.lng) {
      return res.status(400).json({
        success: false,
        message: 'Coordonnées de départ ou de destination invalides'
      });
    }

    // Récupérer les signalements pertinents
    const reports = await getEnhancedReports(originCoords, destinationCoords);
    console.log(`Trouvé ${reports.length} signalements dans la zone`);

    // Obtenir les itinéraires possibles via Google Maps
    const initialRoutes = await googleMapsService.getDirections(originCoords, destinationCoords);

    if (!initialRoutes || initialRoutes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Aucun itinéraire trouvé pour ces coordonnées'
      });
    }

    // Créer des itinéraires sécurisés en s'appuyant sur l'itinéraire initial
    const safeRoutes = [];
    const mainRoute = initialRoutes[0];
    
    // Calculer le score de sécurité pour l'itinéraire principal
    const { safetyScore, safetyFactors, hotspots } = await safetyCalculator.calculateSafetyScore(
      mainRoute.path,
      userPreferences
    );
    
    // Ajouter l'itinéraire principal
    safeRoutes.push({
      id: `route_0`,
      name: 'Itinéraire principal',
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
      distance: mainRoute.distance,
      duration: mainRoute.duration,
      path: mainRoute.path,
      steps: mainRoute.steps || [],
      safetyScore,
      safetyFactors,
      hotspots: hotspots.slice(0, 5),
      summary: mainRoute.summary || 'Itinéraire principal'
    });
    
    // Si des signalements existent et le score de sécurité n'est pas excellent,
    // générer un itinéraire alternatif plus sûr
    if (reports.length > 0 && safetyScore < 9) {
      // Générer un itinéraire plus sûr
      const saferPath = await safetyCalculator.generateSaferRoute(
        mainRoute.path,
        reports,
        userPreferences
      );
      
      // Calculer le score de sécurité pour cet itinéraire alternatif
      const saferRouteStats = await safetyCalculator.calculateSafetyScore(
        saferPath,
        userPreferences
      );
      
      // Calculer la distance du nouvel itinéraire
      const saferDistance = helpers.calculateTotalPathLength(saferPath);
      
      // Estimer la durée (en minutes) du nouvel itinéraire basé sur une vitesse de marche de 5 km/h
      const saferDuration = Math.round((saferDistance / 5) * 60);
      
      // Uniquement ajouter l'itinéraire alternatif s'il est vraiment plus sûr
      if (saferRouteStats.safetyScore > safetyScore + 0.5) {
        safeRoutes.push({
          id: `route_1`,
          name: 'Itinéraire plus sûr',
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
          distance: saferDistance,
          duration: saferDuration,
          path: saferPath,
          steps: [], // Pas d'étapes détaillées pour l'itinéraire généré
          safetyScore: saferRouteStats.safetyScore,
          safetyFactors: saferRouteStats.safetyFactors,
          hotspots: saferRouteStats.hotspots.slice(0, 5),
          summary: 'Itinéraire sécurisé (évite les zones à risque)'
        });
      }
    }
    
    // Si l'itinéraire initial n'est pas très sûr, proposer une troisième option
    // maximisant la sécurité avec des détours plus importants
    if (safetyScore < 7) {
      const maxSafetyPath = generateMaxSafetyRoute(
        mainRoute.path,
        reports,
        userPreferences
      );
      
      // Ne pas ajouter si trop similaire au chemin sécurisé existant
      const routesToCheck = safeRoutes.slice(1); // Tous sauf l'itinéraire principal
      if (routesToCheck.length === 0 || !routesToCheck.some(route => helpers.isRouteSimilar(maxSafetyPath, route.path))) {
        const maxSafetyStats = await safetyCalculator.calculateSafetyScore(
          maxSafetyPath,
          userPreferences
        );
        
        const maxSafetyDistance = helpers.calculateTotalPathLength(maxSafetyPath);
        const maxSafetyDuration = Math.round((maxSafetyDistance / 5) * 60);
        
        safeRoutes.push({
          id: `route_${safeRoutes.length}`,
          name: 'Priorité sécurité',
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
          distance: maxSafetyDistance,
          duration: maxSafetyDuration,
          path: maxSafetyPath,
          steps: [],
          safetyScore: maxSafetyStats.safetyScore,
          safetyFactors: maxSafetyStats.safetyFactors,
          hotspots: maxSafetyStats.hotspots.slice(0, 5),
          summary: 'Parcours maximisant la sécurité'
        });
      }
    }
    
    // Si l'API a retourné un second itinéraire, l'ajouter également
    if (initialRoutes.length > 1) {
      const alternateRoute = initialRoutes[1];
      
      // Calculer le score de sécurité pour cet itinéraire alternatif
      const alternateStats = await safetyCalculator.calculateSafetyScore(
        alternateRoute.path,
        userPreferences
      );
      
      safeRoutes.push({
        id: `route_${safeRoutes.length}`,
        name: 'Itinéraire alternatif',
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
        distance: alternateRoute.distance,
        duration: alternateRoute.duration,
        path: alternateRoute.path,
        steps: alternateRoute.steps || [],
        safetyScore: alternateStats.safetyScore,
        safetyFactors: alternateStats.safetyFactors,
        hotspots: alternateStats.hotspots.slice(0, 5),
        summary: alternateRoute.summary || 'Itinéraire alternatif'
      });
    }

    // Trier les itinéraires par score de sécurité
    safeRoutes.sort((a, b) => {
      // Si la différence de sécurité est significative, privilégier le plus sûr
      if (Math.abs(a.safetyScore - b.safetyScore) >= 1.0) {
        return b.safetyScore - a.safetyScore;
      }
      // Sinon, privilégier le plus court
      return a.duration - b.duration;
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

/**
 * Récupérer des rapports améliorés avec pondération par âge
 * @param {Object} origin - Point d'origine {lat, lng}
 * @param {Object} destination - Point de destination {lat, lng}
 * @param {Number} buffer - Marge autour de la zone
 * @returns {Array} Signalements pondérés
 */
async function getEnhancedReports(origin, destination, buffer = 0.005) {
  try {
    // Trouver les limites de la zone
    const minLat = Math.min(origin.lat, destination.lat) - buffer;
    const maxLat = Math.max(origin.lat, destination.lat) + buffer;
    const minLng = Math.min(origin.lng, destination.lng) - buffer;
    const maxLng = Math.max(origin.lng, destination.lng) + buffer;
    
    // Requête utilisant un index spatial 2dsphere (nécessite MongoDB)
    const reports = await Report.find({
      // Utiliser le $geoWithin pour bénéficier des index spatiaux
      location: {
        $geoWithin: {
          $box: [
            [minLng, minLat],
            [maxLng, maxLat]
          ]
        }
      },
      // Ne pas inclure les signalements temporaires expirés
      $or: [
        { temporary: false },
        { temporary: true, expiresAt: { $gt: new Date() } }
      ],
      // Filtrer par âge du rapport (ne garder que les rapports récents)
      createdAt: { $gt: new Date(Date.now() - config.SAFETY_CONFIG.REPORT_VALIDITY_DAYS * 24 * 60 * 60 * 1000) }
    }).sort({ severity: -1 }); // Prioriser les signalements les plus graves
    
    // Pondérer les rapports selon leur âge
    return reports.map(report => {
      // Calculer l'âge du rapport en jours
      const ageInDays = (Date.now() - new Date(report.createdAt).getTime()) / (24 * 60 * 60 * 1000);
      
      // Facteur de pondération: diminue avec l'âge (1.0 pour les rapports récents, 0.5 pour les plus anciens)
      const ageFactor = Math.max(0.5, 1 - (ageInDays / config.SAFETY_CONFIG.REPORT_VALIDITY_DAYS));
      
      // Appliquer le facteur d'âge à la sévérité
      return {
        ...report.toObject(),
        originalSeverity: report.severity,
        severity: report.severity * ageFactor
      };
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des signalements:', error);
    return [];
  }
}

/**
 * Génère un itinéraire maximisant la sécurité avec des détours plus importants
 * @param {Array} originalPath - Chemin original
 * @param {Array} reports - Signalements
 * @param {Object} userPreferences - Préférences utilisateur
 * @returns {Array} Chemin alternatif
 */
function generateMaxSafetyRoute(originalPath, reports, userPreferences) {
  try {
    // Identifier les sections dangereuses
    const dangerousSections = findDangerousSections(originalPath, reports);
    
    // Si pas de sections dangereuses, retourner le chemin original
    if (dangerousSections.length === 0) {
      return originalPath;
    }
    
    // Créer une route avec des détours plus prononcés
    let maxSafetyPath = [...originalPath];
    
    // Remplacer chaque section dangereuse par une alternative avec détour important
    for (const section of dangerousSections) {
      const alternativeSection = createAlternativeSection(
        maxSafetyPath, 
        section, 
        reports,
        40 // Déviation plus importante (40m)
      );
      
      maxSafetyPath = replacePathSection(
        maxSafetyPath, 
        section.startIndex, 
        section.endIndex, 
        alternativeSection
      );
    }
    
    // Lisser le chemin pour éviter les zigzags
    return helpers.smoothPath(maxSafetyPath);
  } catch (error) {
    console.error('Erreur lors de la génération de route de sécurité maximale:', error);
    return originalPath;
  }
}

/**
 * Trouve les sections dangereuses d'un chemin
 * @param {Array} path - Chemin
 * @param {Array} reports - Signalements
 * @returns {Array} Sections dangereuses {startIndex, endIndex}
 */
function findDangerousSections(path, reports) {
  const sections = [];
  let currentSection = null;
  
  // Pour chaque point du chemin, vérifier s'il est dans une zone dangereuse
  for (let i = 0; i < path.length; i++) {
    const point = path[i];
    let isDangerous = false;
    
    // Vérifier tous les reports
    for (const report of reports) {
      const reportPoint = { 
        lat: report.location.coordinates[1], 
        lng: report.location.coordinates[0] 
      };
      
      const distance = helpers.calculateDistance(
        point.lat, point.lng,
        reportPoint.lat, reportPoint.lng
      ) * 1000; // convertir en mètres
      
      // Obtenir le rayon de danger pour cette catégorie
      const dangerRadius = config.SAFETY_CONFIG.DANGER_RADIUS[report.category] || 30;
      
      // Si le point est dans la zone de danger
      if (distance <= dangerRadius) {
        isDangerous = true;
        break;
      }
    }
    
    // Gérer les sections dangereuses
    if (isDangerous) {
      if (!currentSection) {
        currentSection = {
          startIndex: Math.max(0, i - 1), // Commencer un point avant
          endIndex: i
        };
      } else {
        currentSection.endIndex = i;
      }
    } else if (currentSection && i > currentSection.endIndex) {
      // Ajouter un point après la fin de la section dangereuse
      currentSection.endIndex = Math.min(path.length - 1, i);
      sections.push(currentSection);
      currentSection = null;
    }
  }
  
  // Ajouter la dernière section si elle existe
  if (currentSection) {
    currentSection.endIndex = Math.min(path.length - 1, currentSection.endIndex + 1);
    sections.push(currentSection);
  }
  
  return sections;
}

/**
 * Crée une section de chemin alternative pour éviter une zone dangereuse
 * @param {Array} originalPath - Chemin original
 * @param {Object} section - Section dangereuse {startIndex, endIndex}
 * @param {Array} reports - Signalements
 * @param {Number} maxDeviation - Déviation maximale en mètres
 * @returns {Array} Section alternative
 */
function createAlternativeSection(originalPath, section, reports, maxDeviation = 15) {
  const startPoint = originalPath[section.startIndex];
  const endPoint = originalPath[section.endIndex];
  
  // Calculer le point milieu direct
  const midPointDirect = {
    lat: (startPoint.lat + endPoint.lat) / 2,
    lng: (startPoint.lng + endPoint.lng) / 2
  };
  
  // Calculer la direction principale
  const dirVector = {
    lat: endPoint.lat - startPoint.lat,
    lng: endPoint.lng - startPoint.lng
  };
  
  // Calculer un vecteur perpendiculaire
  const perpVector = {
    lat: -dirVector.lng,
    lng: dirVector.lat
  };
  
  // Normaliser le vecteur perpendiculaire
  const magnitude = Math.sqrt(perpVector.lat * perpVector.lat + perpVector.lng * perpVector.lng);
  if (magnitude > 0) {
    perpVector.lat /= magnitude;
    perpVector.lng /= magnitude;
  }
  
  // Déterminer la direction optimale pour le détour
  let bestSide = 1; // par défaut, vers la droite
  let maxSafetyScore = -Infinity;
  
  // Essayer les deux côtés et choisir le plus sûr
  for (const side of [-1, 1]) {
    let score = 0;
    
    // Tester plusieurs amplitudes de déviation
    for (const deviationFactor of [10, 20, 30]) { // en mètres
      const testPoint = {
        lat: midPointDirect.lat + side * perpVector.lat * (deviationFactor / 111000),
        lng: midPointDirect.lng + side * perpVector.lng * (deviationFactor / 111000) * Math.cos(midPointDirect.lat * Math.PI / 180)
      };
      
      // Calculer la sécurité de ce point
      let pointScore = 10; // score de base
      
      for (const report of reports) {
        const reportPoint = { 
          lat: report.location.coordinates[1], 
          lng: report.location.coordinates[0] 
        };
        
        const distance = helpers.calculateDistance(
          testPoint.lat, testPoint.lng,
          reportPoint.lat, reportPoint.lng
        ) * 1000; // convertir en mètres
        
        // Obtenir le rayon de danger pour cette catégorie
        const dangerRadius = config.SAFETY_CONFIG.DANGER_RADIUS[report.category] || 30;
        
        // Réduire le score si proche d'un danger
        if (distance <= dangerRadius * 2) {
          const factor = 1 - Math.min(1, distance / (dangerRadius * 2));
          pointScore -= report.severity * factor;
        }
      }
      
      score += pointScore;
    }
    
    // Si ce côté est plus sûr, le choisir
    if (score > maxSafetyScore) {
      maxSafetyScore = score;
      bestSide = side;
    }
  }
  
  // Créer un détour avec la déviation spécifiée
  const deviationFactor = maxDeviation / 111000; // conversion approx de mètres en degrés
  const midPoint = {
    lat: midPointDirect.lat + bestSide * perpVector.lat * deviationFactor,
    lng: midPointDirect.lng + bestSide * perpVector.lng * deviationFactor * Math.cos(midPointDirect.lat * Math.PI / 180)
  };
  
  // Créer un chemin alternatif avec une courbe de Bézier quadratique
  const numPoints = section.endIndex - section.startIndex + 1;
  const alternativeSection = [];
  
  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    
    // Courbe de Bézier quadratique
    alternativeSection.push({
      lat: (1-t)*(1-t)*startPoint.lat + 2*(1-t)*t*midPoint.lat + t*t*endPoint.lat,
      lng: (1-t)*(1-t)*startPoint.lng + 2*(1-t)*t*midPoint.lng + t*t*endPoint.lng
    });
  }
  
  return alternativeSection;
}

/**
 * Remplace une section de chemin par une section alternative
 * @param {Array} path - Chemin original
 * @param {Number} startIndex - Index de début
 * @param {Number} endIndex - Index de fin
 * @param {Array} replacementSection - Section de remplacement
 * @returns {Array} Chemin modifié
 */
function replacePathSection(path, startIndex, endIndex, replacementSection) {
  const result = [];
  
  // Ajouter les points avant la section
  for (let i = 0; i < startIndex; i++) {
    result.push(path[i]);
  }
  
  // Ajouter la section de remplacement
  for (const point of replacementSection) {
    result.push(point);
  }
  
  // Ajouter les points après la section
  for (let i = endIndex + 1; i < path.length; i++) {
    result.push(path[i]);
  }
  
  return result;
}

/**
 * Obtenir un itinéraire spécifique
 * @param {Object} req - Requête HTTP
 * @param {Object} res - Réponse HTTP
 */
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

/**
 * Sauvegarder un itinéraire favori
 * @param {Object} req - Requête HTTP
 * @param {Object} res - Réponse HTTP
 */
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
    
    // Sinon, retourner une erreur
    res.status(400).json({
      success: false,
      message: 'Veuillez fournir les données d\'itinéraire complètes.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement du favori',
      error: error.message
    });
  }
};

/**
 * Obtenir les itinéraires favoris de l'utilisateur
 * @param {Object} req - Requête HTTP
 * @param {Object} res - Réponse HTTP
 */
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

/**
 * Supprimer un itinéraire favori
 * @param {Object} req - Requête HTTP
 * @param {Object} res - Réponse HTTP
 */
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