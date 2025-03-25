// backend/services/routeGenerator.js
const safetyCalculator = require('./safetyCalculator');
const Report = require('../models/Report');

/**
 * Génère plusieurs itinéraires alternatifs sûrs entre deux points
 * @param {Object} originalPath - Le chemin original fourni par Google Maps
 * @param {Object} userPreferences - Les préférences de sécurité de l'utilisateur
 * @param {Object} originCoords - Coordonnées du point de départ
 * @param {Object} destinationCoords - Coordonnées du point d'arrivée
 * @returns {Array} Un tableau d'itinéraires alternatifs
 */
exports.generateMultipleRoutes = async (originalPath, userPreferences, originCoords, destinationCoords) => {
  try {
    // Récupérer tous les signalements pertinents dans la zone
    const reports = await getReportsInArea(originCoords, destinationCoords);
    console.log(`Récupéré ${reports.length} signalements dans la zone`);
    
    // 1. Route originale (optimisée pour la sécurité)
    const safeOptimizedRoute = await safetyCalculator.generateSaferRoute(originalPath, reports, userPreferences);
    const safetyScore = await safetyCalculator.calculateSafetyScore(safeOptimizedRoute, userPreferences);
    
    // Préparer le tableau de routes alternatives
    const alternativeRoutes = [
      {
        id: 'route_1',
        name: 'Itinéraire recommandé',
        path: safeOptimizedRoute,
        safetyScore: safetyScore.safetyScore,
        safetyFactors: safetyScore.safetyFactors,
        hotspots: safetyScore.hotspots,
        routeType: 'optimal'
      }
    ];
    
    // 2. Route priorité vitesse
    // Pour cette route, on accepte plus de risques pour aller plus vite
    const speedPreferences = { ...userPreferences, prioritizeLight: false, avoidIsolatedAreas: false };
    const speedRoute = originalPath; // On garde l'itinéraire direct pour la vitesse
    const speedRouteScore = await safetyCalculator.calculateSafetyScore(speedRoute, speedPreferences);
    
    alternativeRoutes.push({
      id: 'route_2',
      name: 'Itinéraire le plus rapide',
      path: speedRoute,
      safetyScore: speedRouteScore.safetyScore,
      safetyFactors: speedRouteScore.safetyFactors,
      hotspots: speedRouteScore.hotspots,
      routeType: 'speed'
    });
    
    // 3. Route alternative avec déviation maximale (priorité sécurité absolue)
    const safetyMaxPreferences = { 
      prioritizeLight: true, 
      avoidIsolatedAreas: true,
      maxDeviation: 50 // Augmenter la déviation maximale à 50m (au lieu de 30m par défaut)
    };
    
    // Générer un itinéraire plus détourné en utilisant les sections dangereuses
    const dangerousSections = findDangerousSections(originalPath, reports);
    
    if (dangerousSections.length > 0) {
      let maxSafetyRoute = [...originalPath];
      
      // Remplacer chaque section dangereuse par une alternative plus détournée
      for (const section of dangerousSections) {
        const alternativeSection = createAlternativeSection(
          maxSafetyRoute, 
          section, 
          reports,
          50 // Déviation plus importante (50m)
        );
        
        maxSafetyRoute = replacePathSection(
          maxSafetyRoute, 
          section.startIndex, 
          section.endIndex, 
          alternativeSection
        );
      }
      
      // Calculer le score de sécurité pour cette route
      const maxSafetyScore = await safetyCalculator.calculateSafetyScore(maxSafetyRoute, safetyMaxPreferences);
      
      // Vérifier que cette route est différente des autres (pour éviter les doublons)
      if (isRouteDifferent(maxSafetyRoute, alternativeRoutes)) {
        alternativeRoutes.push({
          id: 'route_3',
          name: 'Itinéraire le plus sûr',
          path: maxSafetyRoute,
          safetyScore: maxSafetyScore.safetyScore,
          safetyFactors: maxSafetyScore.safetyFactors,
          hotspots: maxSafetyScore.hotspots,
          routeType: 'max_safety'
        });
      }
    }
    
    // 4. Itinéraire alternatif utilisant une projection locale (UTM)
    // Utiliser une projection UTM pour des calculs de distance plus précis
    const utmRoute = await generateUtmOptimizedRoute(originalPath, reports, userPreferences);
    
    // Si l'itinéraire UTM est différent des autres
    if (utmRoute && isRouteDifferent(utmRoute, alternativeRoutes)) {
      const utmRouteScore = await safetyCalculator.calculateSafetyScore(utmRoute, userPreferences);
      
      alternativeRoutes.push({
        id: 'route_4',
        name: 'Itinéraire alternatif',
        path: utmRoute,
        safetyScore: utmRouteScore.safetyScore,
        safetyFactors: utmRouteScore.safetyFactors,
        hotspots: utmRouteScore.hotspots,
        routeType: 'utm_optimized'
      });
    }
    
    // Calculer la distance et la durée pour chaque itinéraire
    const enhancedRoutes = alternativeRoutes.map(route => {
      const distance = calculateTotalPathLength(route.path);
      const duration = Math.round((distance / 5) * 60); // 5 km/h de vitesse moyenne
      
      return {
        ...route,
        distance,
        duration
      };
    });
    
    // Trier les itinéraires: d'abord par score de sécurité, puis par durée
    enhancedRoutes.sort((a, b) => {
      // Si les scores sont proches (moins de 1.0 point), privilégier le plus rapide
      if (Math.abs(a.safetyScore - b.safetyScore) < 1.0) {
        return a.duration - b.duration;
      }
      return b.safetyScore - a.safetyScore;
    });
    
    // S'assurer que le premier itinéraire est toujours "recommandé"
    if (enhancedRoutes.length > 0) {
      enhancedRoutes[0].name = 'Itinéraire recommandé';
    }
    
    return enhancedRoutes;
  } catch (error) {
    console.error('Erreur lors de la génération des itinéraires alternatifs:', error);
    
    // Retourner au moins l'itinéraire original en cas d'erreur
    const fallbackScore = await safetyCalculator.calculateSafetyScore(originalPath, userPreferences);
    return [{
      id: 'route_fallback',
      name: 'Itinéraire disponible',
      path: originalPath,
      safetyScore: fallbackScore.safetyScore,
      safetyFactors: fallbackScore.safetyFactors,
      hotspots: fallbackScore.hotspots,
      distance: calculateTotalPathLength(originalPath),
      duration: Math.round((calculateTotalPathLength(originalPath) / 5) * 60), // 5 km/h
      routeType: 'original'
    }];
  }
};

/**
 * Vérifier si une route est significativement différente des routes existantes
 * @param {Array} newRoute - La nouvelle route à comparer
 * @param {Array} existingRoutes - Les routes existantes
 * @returns {Boolean} True si la route est différente
 */
function isRouteDifferent(newRoute, existingRoutes) {
  // Seuil de différence minimale (en km) pour considérer un itinéraire comme différent
  const DIFFERENCE_THRESHOLD = 0.05; // 50 mètres
  
  for (const route of existingRoutes) {
    // Calculer la différence moyenne entre les points
    const avgDifference = calculateRoutesDifference(newRoute, route.path);
    
    // Si la différence est inférieure au seuil, considérer comme similaire
    if (avgDifference < DIFFERENCE_THRESHOLD) {
      return false;
    }
  }
  
  return true;
}

/**
 * Calculer la différence moyenne entre deux routes
 */
function calculateRoutesDifference(route1, route2) {
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
  
  // Retourner la différence moyenne
  return totalDifference / samples;
}

/**
 * Échantillonner une route pour avoir un nombre spécifique de points
 */
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

/**
 * Récupérer tous les signalements dans la zone entre le départ et l'arrivée
 * Utilise des index spatiaux pour une performance optimale
 */
async function getReportsInArea(origin, destination, buffer = 0.005) {
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

/**
 * Optimisation de route utilisant une projection UTM pour des calculs plus précis
 * Cette fonction convertit les coordonnées en UTM, optimise la route, puis reconvertit en WGS84
 */
async function generateUtmOptimizedRoute(originalPath, reports, userPreferences) {
  try {
    // NOTE: Dans une implémentation réelle, il faudrait:
    // 1. Déterminer la zone UTM appropriée
    // 2. Convertir les coordonnées en UTM
    // 3. Effectuer les calculs de distance et d'angles en UTM
    // 4. Reconvertir en WGS84 (lat/lng)
    
    // Pour cette démonstration, nous simulons une optimisation légèrement différente
    // en utilisant une approche différente pour les déviations
    
    // Identifier les points chauds principaux
    const hotspots = reports
      .filter(report => report.severity >= 4)
      .map(report => ({
        lat: report.location.coordinates[1],
        lng: report.location.coordinates[0],
        severity: report.severity,
        radius: 30 + (report.severity * 10) // Rayon proportionnel à la sévérité
      }));
    
    if (hotspots.length === 0) {
      return null; // Pas de différence significative possible
    }
    
    // Créer une route modifiée qui s'éloigne des points chauds
    let modifiedPath = [...originalPath];
    
    // Pour chaque point du chemin, calculer une force de répulsion des points chauds
    for (let i = 1; i < modifiedPath.length - 1; i++) {
      const point = modifiedPath[i];
      let repulsionVector = { lat: 0, lng: 0 };
      
      for (const hotspot of hotspots) {
        // Distance au point chaud
        const distance = calculateDistance(
          point.lat, point.lng,
          hotspot.lat, hotspot.lng
        ) * 1000; // Convertir en mètres
        
        // Si on est dans la zone d'influence
        if (distance < hotspot.radius * 2) {
          // Force inversement proportionnelle au carré de la distance
          const force = (hotspot.severity / 5) * Math.pow(1 - distance / (hotspot.radius * 2), 2);
          
          // Direction opposée au point chaud
          const direction = {
            lat: point.lat - hotspot.lat,
            lng: point.lng - hotspot.lng
          };
          
          // Normaliser le vecteur de direction
          const magnitude = Math.sqrt(direction.lat * direction.lat + direction.lng * direction.lng);
          if (magnitude > 0) {
            direction.lat /= magnitude;
            direction.lng /= magnitude;
          }
          
          // Ajouter à la force de répulsion
          repulsionVector.lat += direction.lat * force * 0.0001; // Facteur d'échelle
          repulsionVector.lng += direction.lng * force * 0.0001;
        }
      }
      
      // Appliquer la répulsion
      modifiedPath[i] = {
        lat: point.lat + repulsionVector.lat,
        lng: point.lng + repulsionVector.lng
      };
    }
    
    // Lisser le chemin
    return smoothPath(modifiedPath);
  } catch (error) {
    console.error('Erreur lors de la génération de la route UTM:', error);
    return null;
  }
}

// Reprendre ici les fonctions utilitaires du fichier safetyCalculator.js
// findDangerousSections, createAlternativeSection, replacePathSection, smoothPath, etc.

// Fonction de lissage du chemin (éviter les zigzags)
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

// Trouver les sections dangereuses d'un chemin
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
      
      // Obtenir le rayon de danger pour cette catégorie (utiliser les constantes définies)
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

// Créer une section alternative pour éviter une zone dangereuse
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

// Remplacer une section de chemin par une alternative
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
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Rayon de la Terre en km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance en km
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}