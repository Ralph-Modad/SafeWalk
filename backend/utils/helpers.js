// backend/utils/helpers.js
/**
 * Fonctions utilitaires partagées pour le backend SafeWalk
 * Ce module centralise les fonctions communes utilisées dans différents services
 */

/**
 * Calcule la distance entre deux points géographiques (formule de Haversine)
 * @param {Number} lat1 - Latitude du point 1
 * @param {Number} lon1 - Longitude du point 1
 * @param {Number} lat2 - Latitude du point 2
 * @param {Number} lon2 - Longitude du point 2
 * @returns {Number} Distance en kilomètres
 */
exports.calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Rayon de la Terre en km
  const dLat = exports.deg2rad(lat2 - lat1);
  const dLon = exports.deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(exports.deg2rad(lat1)) * Math.cos(exports.deg2rad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance en km
};

/**
 * Convertit les degrés en radians
 * @param {Number} deg - Angle en degrés
 * @returns {Number} Angle en radians
 */
exports.deg2rad = (deg) => {
  return deg * (Math.PI/180);
};

/**
 * Calcule la longueur totale d'un chemin (somme des distances entre points consécutifs)
 * @param {Array} path - Tableau de points {lat, lng}
 * @returns {Number} Longueur totale en kilomètres
 */
exports.calculateTotalPathLength = (path) => {
  let totalLength = 0;
  for (let i = 1; i < path.length; i++) {
    totalLength += exports.calculateDistance(
      path[i-1].lat, path[i-1].lng,
      path[i].lat, path[i].lng
    );
  }
  return totalLength;
};

/**
 * Lisse un chemin pour éliminer les zigzags
 * @param {Array} path - Tableau de points {lat, lng}
 * @returns {Array} Chemin lissé
 */
exports.smoothPath = (path) => {
  if (path.length <= 2) return path;
  
  const result = [path[0]]; // Conserver le premier point
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
};

/**
 * Vérifie si deux routes sont similaires
 * @param {Array} route1 - Première route
 * @param {Array} route2 - Deuxième route
 * @param {Number} threshold - Seuil de différence (en km)
 * @returns {Boolean} True si les routes sont similaires
 */
exports.isRouteSimilar = (route1, route2, threshold = 0.05) => {
  // Échantillonner les routes pour avoir le même nombre de points
  const samples = 10;
  const sampled1 = exports.sampleRoute(route1, samples);
  const sampled2 = exports.sampleRoute(route2, samples);
  
  // Calculer la somme des distances entre points correspondants
  let totalDifference = 0;
  for (let i = 0; i < samples; i++) {
    totalDifference += exports.calculateDistance(
      sampled1[i].lat, sampled1[i].lng,
      sampled2[i].lat, sampled2[i].lng
    );
  }
  
  // Calculer la différence moyenne
  const avgDifference = totalDifference / samples;
  
  // Considérer comme similaire si moins de threshold km de différence en moyenne
  return avgDifference < threshold;
};

/**
 * Échantillonne une route pour avoir un nombre spécifique de points
 * @param {Array} route - Tableau de points {lat, lng}
 * @param {Number} numSamples - Nombre d'échantillons souhaités
 * @returns {Array} Route échantillonnée
 */
exports.sampleRoute = (route, numSamples) => {
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
};