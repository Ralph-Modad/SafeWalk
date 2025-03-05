// safe-walk/src/utils/routeUtils.js
// Utilitaires pour simuler des itinéraires sécurisés côté client
// Utilisé lorsque l'API backend n'est pas disponible ou pour le développement

/**
 * Génère des itinéraires simulés entre un point d'origine et une destination
 * Prend également en compte les signalements simulés pour éviter les zones dangereuses
 */
export const generateSimulatedRoutes = (origin, destination, mockReports = []) => {
  console.log("Génération d'itinéraires simulés");
  
  // Calculer la distance réelle entre l'origine et la destination
  const distance = calculateDistance(
    origin.lat, origin.lng,
    destination.lat, destination.lng
  );
  
  // Estimer le temps de marche (5 km/h en moyenne)
  const walkingSpeed = 5; // km/h
  const duration = Math.round((distance / walkingSpeed) * 60); // minutes
  
  console.log("Distance calculée:", distance, "km");
  console.log("Durée estimée:", duration, "minutes");
  
  // Générer des points chauds fictifs si aucun rapport n'est fourni
  const simulatedHotspots = mockReports.length > 0 
    ? generateHotspotsFromReports(mockReports)
    : generateRandomHotspots(origin, destination);
  
  // Générer les chemins en évitant les points chauds
  const directPath = generatePathWithCurve(origin, destination, 0);
  const safePath = generateSafePath(origin, destination, simulatedHotspots, 0.012);
  const alternatePath = generatePathWithCurve(origin, destination, 0.01);
  
  // Calculer les scores de sécurité simulés
  const directPathSafety = calculateSimulatedSafetyScore(directPath, simulatedHotspots);
  const safePathSafety = calculateSimulatedSafetyScore(safePath, simulatedHotspots);
  const alternatePathSafety = calculateSimulatedSafetyScore(alternatePath, simulatedHotspots);
  
  // Modifier les temps de trajet en fonction des chemins générés
  const directDistance = calculatePathLength(directPath);
  const safeDistance = calculatePathLength(safePath);
  const alternateDistance = calculatePathLength(alternatePath);
  
  const routes = [
    {
      id: 'route_1',
      name: 'Itinéraire le plus sûr',
      distance: parseFloat(safeDistance.toFixed(1)),
      duration: Math.round(duration * (safeDistance / distance)),
      safetyScore: safePathSafety,
      path: safePath,
      safetyFactors: {
        lighting: 9,
        crowdedness: 8,
        reportDensity: 9
      },
      hotspots: simulatedHotspots.slice(0, 3),
      summary: 'Via rues principales'
    },
    {
      id: 'route_2',
      name: 'Itinéraire le plus rapide',
      distance: parseFloat(directDistance.toFixed(1)),
      duration: Math.round(duration * (directDistance / distance)),
      safetyScore: directPathSafety,
      path: directPath,
      safetyFactors: {
        lighting: 6,
        crowdedness: 7,
        reportDensity: 6
      },
      hotspots: simulatedHotspots.slice(0, 3).filter(h => isHotspotNearPath(h, directPath)),
      summary: 'Itinéraire direct'
    },
    {
      id: 'route_3',
      name: 'Itinéraire alternatif',
      distance: parseFloat(alternateDistance.toFixed(1)),
      duration: Math.round(duration * (alternateDistance / distance)),
      safetyScore: alternatePathSafety,
      path: alternatePath,
      safetyFactors: {
        lighting: 7,
        crowdedness: 8,
        reportDensity: 7
      },
      hotspots: simulatedHotspots.slice(0, 3).filter(h => isHotspotNearPath(h, alternatePath)),
      summary: 'Via zones piétonnes'
    }
  ];
  
  // Trier les itinéraires par sécurité
  routes.sort((a, b) => b.safetyScore - a.safetyScore);
  
  // Le premier itinéraire est toujours l'itinéraire recommandé
  if (routes.length > 0) {
    routes[0].name = 'Itinéraire recommandé';
  }
  
  return routes;
};

// Vérifier si un point chaud est à proximité d'un chemin
const isHotspotNearPath = (hotspot, path, tolerance = 0.0005) => {
  for (let i = 0; i < path.length - 1; i++) {
    const distance = pointToLineDistance(
      hotspot.center,
      path[i],
      path[i+1]
    );
    
    if (distance < tolerance) return true;
  }
  return false;
};

// Calculer un score de sécurité simulé basé sur la proximité des points chauds
const calculateSimulatedSafetyScore = (path, hotspots) => {
  // Score de base élevé
  let score = 8.5;
  
  // Réduire le score pour chaque point chaud à proximité du chemin
  for (const hotspot of hotspots) {
    const isNear = isHotspotNearPath(hotspot, path);
    const distance = getMinDistanceToHotspot(path, hotspot);
    
    // Plus la distance est petite, plus l'impact est grand
    if (distance < 0.0001) { // Très proche (~10m)
      score -= hotspot.severity * 0.8;
    } else if (distance < 0.0003) { // Proche (~30m)
      score -= hotspot.severity * 0.5;
    } else if (distance < 0.0008) { // Assez proche (~80m)
      score -= hotspot.severity * 0.2;
    }
  }
  
  // S'assurer que le score est entre 0 et 10
  return Math.max(3, Math.min(10, score));
};

// Obtenir la distance minimale d'un chemin à un point chaud
const getMinDistanceToHotspot = (path, hotspot) => {
  let minDistance = Infinity;
  
  for (let i = 0; i < path.length - 1; i++) {
    const distance = pointToLineDistance(
      hotspot.center,
      path[i],
      path[i+1]
    );
    
    if (distance < minDistance) {
      minDistance = distance;
    }
  }
  
  return minDistance;
};

// Générer un chemin sécurisé qui évite les points chauds
const generateSafePath = (start, end, hotspots, deviation = 0.008) => {
  // Si pas de points chauds, générer un chemin simple
  if (hotspots.length === 0) {
    return generatePathWithCurve(start, end, 0.005);
  }
  
  // Trouver les points chauds près de la ligne directe entre le début et la fin
  const directPath = [start, end];
  const nearHotspots = hotspots.filter(h => isHotspotNearPath(h, directPath, 0.002));
  
  if (nearHotspots.length === 0) {
    // Aucun point chaud à proximité, léger détour pour simulation
    return generatePathWithCurve(start, end, 0.003);
  }
  
  // Calculer un point d'inflexion pour éviter les points chauds
  const dx = end.lng - start.lng;
  const dy = end.lat - start.lat;
  
  // Déterminer la direction du détour en fonction de la position des points chauds
  // Nous voulons dévier dans la direction opposée aux points chauds
  let deviationDirection = 1;
  
  if (nearHotspots.length > 0) {
    // Calculer le centre de tous les points chauds
    const avgLat = nearHotspots.reduce((sum, h) => sum + h.center.lat, 0) / nearHotspots.length;
    const avgLng = nearHotspots.reduce((sum, h) => sum + h.center.lng, 0) / nearHotspots.length;
    
    // Calculer le produit vectoriel pour déterminer de quel côté sont les points chauds
    const v1x = dx;
    const v1y = dy;
    const v2x = avgLng - start.lng;
    const v2y = avgLat - start.lat;
    
    const crossProduct = v1x * v2y - v1y * v2x;
    deviationDirection = crossProduct < 0 ? 1 : -1; // Dévier dans la direction opposée
  }
  
  // Créer des points intermédiaires qui évitent les zones à risque
  const midPoint = {
    lat: (start.lat + end.lat) / 2 + deviationDirection * deviation * dx,
    lng: (start.lng + end.lng) / 2 - deviationDirection * deviation * dy
  };
  
  // Générer le chemin en utilisant le point intermédiaire
  const numPoints = 20;
  const path = [];
  
  // Premier segment - du départ au point intermédiaire
  for (let i = 0; i <= numPoints/2; i++) {
    const t = i / (numPoints/2);
    path.push({
      lat: (1-t) * start.lat + t * midPoint.lat,
      lng: (1-t) * start.lng + t * midPoint.lng
    });
  }
  
  // Deuxième segment - du point intermédiaire à l'arrivée
  for (let i = 1; i <= numPoints/2; i++) {
    const t = i / (numPoints/2);
    path.push({
      lat: (1-t) * midPoint.lat + t * end.lat,
      lng: (1-t) * midPoint.lng + t * end.lng
    });
  }
  
  return path;
};

// Générer des points chauds simulés à partir de reports existants
const generateHotspotsFromReports = (reports) => {
  const hotspots = [];
  const processed = new Set();
  
  for (const report of reports) {
    // Éviter de traiter deux fois le même report
    const reportId = report.id || Math.random().toString(36).substring(2, 9);
    if (processed.has(reportId)) continue;
    processed.add(reportId);
    
    hotspots.push({
      center: {
        lat: report.location.lat,
        lng: report.location.lng
      },
      size: 1,
      severity: report.severity / 5 * 2, // Normaliser entre 0 et 2
      categories: [report.category]
    });
  }
  
  return hotspots;
};

// Générer des points chauds aléatoires entre deux points
const generateRandomHotspots = (start, end, count = 3) => {
  const hotspots = [];
  
  // Déterminer la zone où les points chauds peuvent apparaître
  const minLat = Math.min(start.lat, end.lat);
  const maxLat = Math.max(start.lat, end.lat);
  const minLng = Math.min(start.lng, end.lng);
  const maxLng = Math.max(start.lng, end.lng);
  
  // Ajouter une marge autour de cette zone
  const latMargin = (maxLat - minLat) * 0.2;
  const lngMargin = (maxLng - minLng) * 0.2;
  
  const areaMinLat = minLat - latMargin;
  const areaMaxLat = maxLat + latMargin;
  const areaMinLng = minLng - lngMargin;
  const areaMaxLng = maxLng + lngMargin;
  
  // Générer des points chauds aléatoires
  for (let i = 0; i < count; i++) {
    const lat = areaMinLat + Math.random() * (areaMaxLat - areaMinLat);
    const lng = areaMinLng + Math.random() * (areaMaxLng - areaMinLng);
    
    // Types de points chauds possibles
    const categories = ['poor_lighting', 'unsafe_area', 'construction', 'obstacle', 'bad_weather'];
    const category = categories[Math.floor(Math.random() * categories.length)];
    
    hotspots.push({
      center: { lat, lng },
      size: 1 + Math.floor(Math.random() * 3),
      severity: 0.5 + Math.random() * 1.5,
      categories: [category]
    });
  }
  
  return hotspots;
};

// Calculer la longueur totale d'un chemin
export const calculatePathLength = (path) => {
  let length = 0;
  for (let i = 1; i < path.length; i++) {
    length += calculateDistance(
      path[i-1].lat, path[i-1].lng,
      path[i].lat, path[i].lng
    );
  }
  return length;
};

// Fonction pour générer un chemin avec une courbe
export const generatePathWithCurve = (start, end, curveFactor) => {
  const path = [];
  const steps = 20;
  
  // Calculer un point intermédiaire pour créer une courbe
  // Nous prenons un point perpendiculaire à la ligne directe
  const dx = end.lng - start.lng;
  const dy = end.lat - start.lat;
  
  // Point médian direct
  const midLat = (start.lat + end.lat) / 2;
  const midLng = (start.lng + end.lng) / 2;
  
  // Déplacer le point médian perpendiculairement à la ligne directe
  const perpLat = midLat + curveFactor * dx;
  const perpLng = midLng - curveFactor * dy;
  
  // Générer les points intermédiaires en utilisant une courbe de Bézier quadratique
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    
    // Formule pour une courbe de Bézier quadratique
    const lat = (1-t)*(1-t)*start.lat + 2*(1-t)*t*perpLat + t*t*end.lat;
    const lng = (1-t)*(1-t)*start.lng + 2*(1-t)*t*perpLng + t*t*end.lng;
    
    path.push({ lat, lng });
  }
  
  return path;
};

// Calcul de la distance d'un point à une ligne
export const pointToLineDistance = (point, lineStart, lineEnd) => {
  // Convertir en coordonnées cartésiennes pour simplifier
  // Nous utilisons la latitude comme y et la longitude comme x
  const x = point.lng;
  const y = point.lat;
  const x1 = lineStart.lng;
  const y1 = lineStart.lat;
  const x2 = lineEnd.lng;
  const y2 = lineEnd.lat;
  
  // Cas où le segment est un point
  if (x1 === x2 && y1 === y2) {
    return calculateDistance(y, x, y1, x1);
  }
  
  // Calculer la projection du point sur la ligne
  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  
  const dot = A * C + B * D;
  const len_sq = C * C + D * D;
  const param = dot / len_sq;
  
  let xx, yy;
  
  // Trouver le point le plus proche sur la ligne (segment)
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }
  
  // Calculer la distance entre le point et le point le plus proche sur la ligne
  return calculateDistance(y, x, yy, xx);
};

// Calculer la distance entre deux points (Haversine)
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
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