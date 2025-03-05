// backend/controllers/routeController.js
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

    // AMÉLIORATION: Récupérer les rapports avec filtrage par âge
    const buffer = 0.005; // ~500m de marge autour des coordonnées 
    const reports = await getEnhancedReports(
      originCoords, 
      destinationCoords, 
      buffer
    );

    console.log(`Trouvé ${reports.length} signalements dans la zone`);

    // Obtenir les itinéraires possibles via le service Google Maps mis à jour (API Routes)
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
    
    // Si des signalements existent, générer un itinéraire alternatif plus sûr
    if (reports.length > 0 && safetyScore < 9) {
      // AMÉLIORATION 1: Générer un itinéraire qui évite les zones dangereuses avec plus de précision
      const saferPath = await generateEnhancedSaferRoute(
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
      const saferDistance = calculateTotalPathLength(saferPath);
      
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
      
      // AMÉLIORATION 2: Créer une troisième option maximisant la sécurité avec détours plus prononcés
      if (safetyScore < 7) {
        const maxSafetyPath = await generateMaxSafetyRoute(
          mainRoute.path,
          reports,
          userPreferences
        );
        
        // Ne pas ajouter si trop similaire au saferPath
        if (!isRouteSimilar(maxSafetyPath, saferPath)) {
          const maxSafetyStats = await safetyCalculator.calculateSafetyScore(
            maxSafetyPath,
            userPreferences
          );
          
          const maxSafetyDistance = calculateTotalPathLength(maxSafetyPath);
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
    }
    
    // Si l'itinéraire initial a une bonne note de sécurité et qu'on a un second itinéraire de l'API
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

// NOUVELLE FONCTION: Récupérer des rapports améliorés avec pondération par âge
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
      // AMÉLIORATION: Filtrer par âge du rapport (ne garder que les rapports récents)
      createdAt: { $gt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // 30 jours
    }).sort({ severity: -1 }); // Prioriser les signalements les plus graves
    
    // AMÉLIORATION: Pondérer les rapports selon leur âge
    return reports.map(report => {
      // Calculer l'âge du rapport en jours
      const ageInDays = (Date.now() - new Date(report.createdAt).getTime()) / (24 * 60 * 60 * 1000);
      
      // Facteur de pondération: diminue avec l'âge (1.0 pour les rapports récents, 0.5 pour les plus anciens)
      const ageFactor = Math.max(0.5, 1 - (ageInDays / 30));
      
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

// NOUVELLE FONCTION: Générer une route plus sûre avec des améliorations
async function generateEnhancedSaferRoute(originalPath, reports, userPreferences) {
  try {
    // Utiliser la fonction existante du module safetyCalculator
    const saferPath = await safetyCalculator.generateSaferRoute(originalPath, reports, userPreferences);
    
    // S'assurer que la route n'est pas trop longue (max 20% plus longue que l'original)
    const originalLength = calculateTotalPathLength(originalPath);
    const newLength = calculateTotalPathLength(saferPath);
    
    if (newLength > originalLength * 1.2) {
      // Trouver un équilibre entre sûreté et longueur
      return findDangerousSegmentsAndCreateAlternatives(originalPath, reports, userPreferences, 0.15);
    }
    
    return saferPath;
  } catch (error) {
    console.error('Erreur lors de la génération de route sécurisée améliorée:', error);
    return originalPath;
  }
}

// NOUVELLE FONCTION: Générer une route maximisant la sécurité (détours plus importants)
async function generateMaxSafetyRoute(originalPath, reports, userPreferences) {
  try {
    // Identifier les sections dangereuses
    const dangerousSections = findDangerousSections(originalPath, reports);
    
    // Si pas de sections dangereuses, utiliser la route sécurisée standard
    if (dangerousSections.length === 0) {
      return await safetyCalculator.generateSaferRoute(originalPath, reports, userPreferences);
    }
    
    // Créer une route avec des détours plus prononcés
    let maxSafetyPath = [...originalPath];
    
    // Remplacer chaque section dangereuse par une alternative avec détour important
    for (const section of dangerousSections) {
      const alternativeSection = createAlternativeSection(
        maxSafetyPath, 
        section, 
        reports,
        40 // Déviation plus importante (40m au lieu de 15m par défaut)
      );
      
      maxSafetyPath = replacePathSection(
        maxSafetyPath, 
        section.startIndex, 
        section.endIndex, 
        alternativeSection
      );
    }
    
    // Lisser le chemin pour éviter les zigzags
    return smoothPath(maxSafetyPath);
  } catch (error) {
    console.error('Erreur lors de la génération de route de sécurité maximale:', error);
    // En cas d'erreur, retourner la route sécurisée standard
    return await safetyCalculator.generateSaferRoute(originalPath, reports, userPreferences);
  }
}

// NOUVELLE FONCTION: Vérifier si deux routes sont similaires
function isRouteSimilar(route1, route2, threshold = 0.05) {
  // Échantillonner les routes pour avoir le même nombre de points
  const samples = 10;
  const sampled1 = sampleRoute(route1, samples);
  const sampled2 = sampleRoute(route2, samples);
  
  // Calculer la somme des distances entre points correspondants
  let totalDifference = 0;
  for (let i = 0; i < samples; i++) {
    totalDifference += calculateDistance(
      sampled1[i].lat, sampled1[i].lng,
      sampled2[i].lat, sampled2[i].lng
    );
  }
  
  // Calculer la différence moyenne
  const avgDifference = totalDifference / samples;
  
  // Considérer comme similaire si moins de X km de différence en moyenne
  return avgDifference < threshold;
}

// Échantillonner une route pour avoir un nombre spécifique de points
function sampleRoute(route, numSamples) {
  const result = [];
  
  // Si la route a moins de points que demandé
  if (route.length <= numSamples) {
    return route;
  }
  
  // Calculer l'intervalle d'échantillonnage
  const step = (route.length - 1) / (numSamples - 1);
  
  for (let i = 0; i < numSamples; i++) {
    const index = Math.round(i * step);
    result.push(route[Math.min(index, route.length - 1)]);
  }
  
  return result;
}

// Calculer la longueur totale d'un chemin
function calculateTotalPathLength(path) {
  let totalLength = 0;
  for (let i = 1; i < path.length; i++) {
    totalLength += calculateDistance(
      path[i-1].lat, path[i-1].lng,
      path[i].lat, path[i].lng
    );
  }
  return totalLength;
}

// Calculer la distance entre deux points (formule de Haversine)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Rayon de la Terre en km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance en km
};

const deg2rad = (deg) => {
  return deg * (Math.PI/180);
};

// NOUVELLE FONCTION: Trouver les sections dangereuses d'un chemin
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
      
      const distance = calculateDistance(
        point.lat, point.lng,
        reportPoint.lat, reportPoint.lng
      ) * 1000; // convertir en mètres
      
      // Obtenir le rayon de danger pour cette catégorie
      const DANGER_RADIUS_BY_CATEGORY = {
        'poor_lighting': 5,
        'unsafe_area': 50,
        'construction': 5,
        'obstacle': 10,
        'bad_weather': 100
      };
      
      const dangerRadius = DANGER_RADIUS_BY_CATEGORY[report.category] || 30;
      
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

// NOUVELLE FONCTION: Trouver les segments dangereux et créer des alternatives
function findDangerousSegmentsAndCreateAlternatives(originalPath, reports, userPreferences, maxDeviationFactor = 0.1) {
  const dangerousSections = findDangerousSections(originalPath, reports);
  
  // Si pas de sections dangereuses, retourner la route originale
  if (dangerousSections.length === 0) {
    return originalPath;
  }
  
  let resultPath = [...originalPath];
  
  // Traiter chaque section dangereuse
  for (const section of dangerousSections) {
    const alternativeSection = createAlternativeSection(
      resultPath, section, reports, 20 * maxDeviationFactor
    );
    
    resultPath = replacePathSection(
      resultPath, section.startIndex, section.endIndex, alternativeSection
    );
  }
  
  return smoothPath(resultPath);
}

// NOUVELLE FONCTION: Créer une section alternative pour éviter une zone dangereuse
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
        
        const distance = calculateDistance(
          testPoint.lat, testPoint.lng,
          reportPoint.lat, reportPoint.lng
        ) * 1000; // convertir en mètres
        
        // Obtenir le rayon de danger pour cette catégorie
        const DANGER_RADIUS_BY_CATEGORY = {
          'poor_lighting': 5,
          'unsafe_area': 50,
          'construction': 5,
          'obstacle': 10,
          'bad_weather': 100
        };
        
        const dangerRadius = DANGER_RADIUS_BY_CATEGORY[report.category] || 30;
        
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

// NOUVELLE FONCTION: Remplacer une section de chemin
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

// NOUVELLE FONCTION: Lisser un chemin pour éviter les zigzags
function smoothPath(path) {
  if (path.length <= 2) return path;
  
  const result = [path[0]]; // Conserver le premier point
  
  // Utiliser une fenêtre glissante pour lisser les points
  const WINDOW_SIZE = 3;
  
  for (let i = 1; i < path.length - 1; i++) {
    // Calculer la position moyenne sur une fenêtre
    let sumLat = 0;
    let sumLng = 0;
    let count = 0;
    
    const start = Math.max(0, i - Math.floor(WINDOW_SIZE/2));
    const end = Math.min(path.length - 1, i + Math.floor(WINDOW_SIZE/2));
    
    for (let j = start; j <= end; j++) {
      sumLat += path[j].lat;
      sumLng += path[j].lng;
      count++;
    }
    
    // Ajouter le point lissé
    result.push({
      lat: sumLat / count,
      lng: sumLng / count
    });
  }
  
  result.push(path[path.length - 1]); // Conserver le dernier point
  return result;
}

// Le reste du contrôleur reste inchangé
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