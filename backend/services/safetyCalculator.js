// backend/services/safetyCalculator.js
const Report = require('../models/Report');

// Configuration des rayons de danger par type de signalement (en mètres)
const DANGER_RADIUS_BY_CATEGORY = {
  'poor_lighting': 5,         // Éclairage insuffisant: impact très localisé
  'unsafe_area': 50,           // Zone dangereuse: impact plus large
  'construction': 5,          // Construction: obstacle localisé
  'obstacle': 10,              // Obstacle: très localisé
  'bad_weather': 100           // Mauvaises conditions météo: large zone
};

// Facteur de pénalité par catégorie (plus le nombre est élevé, plus l'algo essaiera d'éviter)
const AVOIDANCE_FACTOR_BY_CATEGORY = {
  'poor_lighting': 1.2,         // Éclairage: moins important d'éviter (réduit pour éviter les détours excessifs)
  'unsafe_area': 2.0,           // Zone dangereuse: important d'éviter (réduit également)
  'construction': 1.8,          // Construction: important d'éviter
  'obstacle': 2.0,              // Obstacle: important d'éviter
  'bad_weather': 1.0            // Mauvaises conditions météo: moins critique
};

// Calculer le score de sécurité d'un itinéraire
exports.calculateSafetyScore = async (path, userPreferences) => {
  try {
    // Paramètres par défaut si non spécifiés
    const preferences = {
      prioritizeLight: userPreferences?.prioritizeLight || true,
      avoidIsolatedAreas: userPreferences?.avoidIsolatedAreas || true
    };
    
    // Récupérer les signalements dans un large rayon autour du chemin
    const reports = await getReportsAlongPath(path, 0.001); // ~100 mètres
    
    // Identifier les points chauds (zones à forte concentration de signalements)
    const hotspots = identifyHotspots(path, reports);
    
    // Calculer le score de base (10 = parfaitement sûr)
    let baseScore = 10;
    
    // Calculer les facteurs de sécurité initiaux
    const safetyFactors = {
      lighting: calculateLightingScore(path, reports, preferences),
      crowdedness: calculateCrowdednessScore(path, reports, preferences),
      reportDensity: calculateReportDensity(reports, path)
    };
    
    // Réduire le score en fonction de la gravité et de la densité des signalements
    if (reports.length > 0) {
      // Pondérer les signalements par gravité, proximité au chemin, et type de danger
      const weightedReports = reports.map(report => {
        // Obtenir le rayon de danger pour cette catégorie
        const dangerRadius = DANGER_RADIUS_BY_CATEGORY[report.category] || 5; // valeur par défaut: 30m
        
        // Calculer la distance minimale du rapport au chemin (en km)
        const minDistance = calculateMinDistanceToPath(
          [report.location.coordinates[0], report.location.coordinates[1]], 
          path
        );
        
        // Convertir la distance en mètres pour la comparaison avec le rayon
        const distanceMeters = minDistance * 1000;
        
        // Si la distance est supérieure au rayon de danger, impact très réduit
        let proximityFactor = 0;
        if (distanceMeters <= dangerRadius) {
          // Impact inversement proportionnel à la distance
          proximityFactor = 1 - (distanceMeters / dangerRadius);
        }
        
        // Obtenir le facteur d'évitement pour cette catégorie
        const avoidanceFactor = AVOIDANCE_FACTOR_BY_CATEGORY[report.category] || 1.0;
        
        return {
          ...report.toObject(),
          weight: report.severity * proximityFactor * avoidanceFactor,
          dangerRadius,
          distanceMeters,
          onPath: distanceMeters <= dangerRadius * 0.5 // Considéré comme sur le chemin si très proche
        };
      });
      
      // Filtrer les rapports qui ont un impact significatif (poids > 0)
      const significantReports = weightedReports.filter(r => r.weight > 0);
      
      if (significantReports.length > 0) {
        // Impact global des rapports pondérés
        const totalWeight = significantReports.reduce((sum, report) => sum + report.weight, 0);
        const averageWeight = totalWeight / significantReports.length;
        
        // Réduire le score en fonction de la moyenne pondérée
        // Limiter la réduction à 6 points maximum pour garder une échelle cohérente
        const reportImpact = Math.min(averageWeight * 1.2, 6);
        baseScore -= reportImpact;
        
        // Réduire davantage le score si des signalements sont directement sur le chemin
        const directPathReports = significantReports.filter(report => report.onPath);
        if (directPathReports.length > 0) {
          const directPathImpact = Math.min(directPathReports.length * 0.8, 3);
          baseScore -= directPathImpact;
        }
        
        // Ajuster les facteurs en fonction des signalements spécifiques
        if (preferences.prioritizeLight) {
          const lightingIssues = significantReports.filter(r => r.category === 'poor_lighting');
          if (lightingIssues.length > 0) {
            const lightingImpact = Math.min(
              lightingIssues.reduce((sum, r) => sum + r.weight, 0) / lightingIssues.length * 0.8,
              3
            );
            safetyFactors.lighting = Math.max(2, safetyFactors.lighting - lightingImpact);
          }
        }
        
        if (preferences.avoidIsolatedAreas) {
          const isolatedAreaIssues = significantReports.filter(r => r.category === 'unsafe_area');
          if (isolatedAreaIssues.length > 0) {
            const isolationImpact = Math.min(
              isolatedAreaIssues.reduce((sum, r) => sum + r.weight, 0) / isolatedAreaIssues.length * 1.0, 
              3.5
            );
            safetyFactors.crowdedness = Math.max(2, safetyFactors.crowdedness - isolationImpact);
          }
        }
      }
    }
    
    // Assurer que le score est entre 0 et 10
    const finalScore = Math.max(0, Math.min(10, baseScore));
    
    return {
      safetyScore: finalScore,
      safetyFactors: {
        lighting: Math.min(10, Math.round(safetyFactors.lighting * 10) / 10),
        crowdedness: Math.min(10, Math.round(safetyFactors.crowdedness * 10) / 10),
        reportDensity: Math.min(10, Math.round(safetyFactors.reportDensity * 10) / 10)
      },
      hotspots: hotspots,
      reportCount: reports.length
    };
  } catch (error) {
    console.error('Erreur lors du calcul du score de sécurité:', error);
    // Retourner un score par défaut en cas d'erreur
    return {
      safetyScore: 5,
      safetyFactors: {
        lighting: 5,
        crowdedness: 5,
        reportDensity: 5
      },
      hotspots: [],
      reportCount: 0
    };
  }
};

// Générer un itinéraire alternatif qui évite les zones dangereuses
exports.generateSaferRoute = async (originalPath, reports, userPreferences) => {
  // Si pas de rapports de sécurité, retourner le chemin original
  if (!reports || reports.length === 0) {
    return originalPath;
  }
  
  try {
    // Filtrer les reports pour ne garder que ceux qui sont vraiment pertinents
    const relevantReports = reports.filter(report => {
      // Obtenir le rayon de danger pour cette catégorie
      const dangerRadius = DANGER_RADIUS_BY_CATEGORY[report.category] || 30;
      
      // Pour les problèmes d'éclairage, on ne les évite que s'ils sont sévères (>= 4)
      if (report.category === 'poor_lighting' && report.severity < 4) {
        return false;
      }
      
      // Vérifier si ce rapport est proche du chemin
      const minDistance = calculateMinDistanceToPath(
        [report.location.coordinates[0], report.location.coordinates[1]], 
        originalPath
      );
      
      // Convertir en mètres
      const distanceMeters = minDistance * 1000;
      
      // On ne considère que les reports qui sont à l'intérieur du rayon de danger
      return distanceMeters <= dangerRadius;
    });
    
    // Si aucun report pertinent, retourner le chemin original
    if (relevantReports.length === 0) {
      return originalPath;
    }
    
    // Analyser le chemin pour trouver où des déviations seraient utiles
    const pathPoints = [...originalPath]; // Copie du chemin original
    const pathLength = pathPoints.length;
    
    // La déviation maximale autorisée en mètres (pour éviter les grands détours)
    const MAX_DEVIATION = 30; // 30 mètres max (réduit pour éviter les triangles)
    
    // Pour chaque point du chemin, vérifier s'il est dans une zone dangereuse
    for (let i = 1; i < pathLength - 1; i++) {
      const point = pathPoints[i];
      let maxSeverity = 0;
      let closestDangerRadius = 0;
      
      // Vérifier tous les reports pertinents
      for (const report of relevantReports) {
        const reportPoint = { 
          lat: report.location.coordinates[1], 
          lng: report.location.coordinates[0] 
        };
        
        const distance = calculateDistance(
          point.lat, point.lng,
          reportPoint.lat, reportPoint.lng
        ) * 1000; // convertir en mètres
        
        const dangerRadius = DANGER_RADIUS_BY_CATEGORY[report.category] || 30;
        
        // Si le point est dans la zone de danger
        if (distance <= dangerRadius) {
          if (report.severity > maxSeverity) {
            maxSeverity = report.severity;
            closestDangerRadius = dangerRadius;
          }
        }
      }
      
      // Si le point est dans une zone dangereuse, créer une déviation
      if (maxSeverity > 0) {
        // Calculer le vecteur de direction du chemin à ce point
        const prevPoint = pathPoints[i-1];
        const nextPoint = pathPoints[i+1];
        
        const dirVector = {
          lat: nextPoint.lat - prevPoint.lat,
          lng: nextPoint.lng - prevPoint.lng
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
        
        // Déterminer de quel côté faire la déviation (s'éloigner des dangers)
        let bestSide = 1; // par défaut, vers la droite
        let minDangerDistance = Infinity;
        
        // Essayer les deux côtés et choisir le plus sûr
        for (const side of [-1, 1]) {
          // Calculer un point potentiel de déviation
          const deviationPoint = {
            lat: point.lat + side * perpVector.lat * (MAX_DEVIATION / 111000), // conversion approx de mètres en degrés
            lng: point.lng + side * perpVector.lng * (MAX_DEVIATION / 111000) * Math.cos(point.lat * Math.PI / 180)
          };
          
          // Calculer la distance minimale aux zones dangereuses
          let minDistance = Infinity;
          for (const report of relevantReports) {
            const reportPoint = { 
              lat: report.location.coordinates[1], 
              lng: report.location.coordinates[0] 
            };
            
            const distance = calculateDistance(
              deviationPoint.lat, deviationPoint.lng,
              reportPoint.lat, reportPoint.lng
            ) * 1000; // convertir en mètres
            
            minDistance = Math.min(minDistance, distance);
          }
          
          // Si ce côté est plus éloigné des dangers, le choisir
          if (minDistance < minDangerDistance) {
            minDangerDistance = minDistance;
            bestSide = side;
          }
        }
        
        // Calculer la déviation en fonction de la sévérité (plus sévère = plus de déviation)
        // Mais limiter pour éviter les détours excessifs
        const deviationFactor = Math.min(maxSeverity * 5, MAX_DEVIATION) / 111000; // conversion approx de mètres en degrés
        
        // Appliquer la déviation
        pathPoints[i] = {
          lat: point.lat + bestSide * perpVector.lat * deviationFactor,
          lng: point.lng + bestSide * perpVector.lng * deviationFactor * Math.cos(point.lat * Math.PI / 180)
        };
      }
    }
    
    // Lisser le chemin pour éviter les zigzags
    const smoothedPath = smoothPath(pathPoints);
    
    // Vérifier que le chemin n'est pas devenu trop long
    const originalLength = calculateTotalPathLength(originalPath);
    const newLength = calculateTotalPathLength(smoothedPath);
    
    // Si le nouveau chemin est plus de 20% plus long, revenir à l'original
    if (newLength > originalLength * 1.2) {
      console.log("Le chemin généré est trop long, on revient à l'original");
      return originalPath;
    }
    
    return smoothedPath;
  } catch (error) {
    console.error('Erreur lors de la génération d\'itinéraire alternatif:', error);
    return originalPath;
  }
};

// Lisser un chemin pour éliminer les zigzags
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

// Calculer la longueur d'une section de chemin
function calculateSectionLength(path, startIndex, endIndex) {
  let length = 0;
  for (let i = startIndex + 1; i <= endIndex; i++) {
    length += calculateDistance(
      path[i-1].lat, path[i-1].lng,
      path[i].lat, path[i].lng
    );
  }
  return length;
}

// Créer une section alternative pour éviter une zone dangereuse
function createAlternativeSection(originalPath, section, reports) {
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
  
  // Créer un détour modéré (15 mètres, beaucoup moins qu'avant)
  const deviationFactor = 15 / 111000; // conversion approx de mètres en degrés
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

// Calculer la distance perpendiculaire d'un point à une ligne
function calculatePerpendicularDistance(point, lineStart, lineEnd) {
  // Vecteur de la ligne
  const lineVector = {
    lat: lineEnd.lat - lineStart.lat,
    lng: lineEnd.lng - lineStart.lng
  };
  
  // Vecteur du point de départ au point
  const pointVector = {
    lat: point.lat - lineStart.lat,
    lng: point.lng - lineStart.lng
  };
  
  // Calculer la projection sur la ligne
  const lineLength = Math.sqrt(lineVector.lat * lineVector.lat + lineVector.lng * lineVector.lng);
  
  if (lineLength === 0) return 0;
  
  // Normaliser le vecteur de la ligne
  const unitLineVector = {
    lat: lineVector.lat / lineLength,
    lng: lineVector.lng / lineLength
  };
  
  // Produit scalaire
  const dotProduct = pointVector.lat * unitLineVector.lat + pointVector.lng * unitLineVector.lng;
  
  // Projection du point sur la ligne
  const projection = {
    lat: lineStart.lat + dotProduct * unitLineVector.lat,
    lng: lineStart.lng + dotProduct * unitLineVector.lng
  };
  
  // Distance du point à sa projection
  return calculateDistance(point.lat, point.lng, projection.lat, projection.lng);
}

// Récupérer les signalements le long d'un chemin
const getReportsAlongPath = async (path, buffer = 0.001) => {
  try {
    // Créer un buffer autour du chemin pour trouver les signalements à proximité
    // Par défaut ~100m en degrés, mais peut être spécifié pour une recherche plus précise
    
    // Trouver les limites du chemin
    const lats = path.map(point => point.lat);
    const lngs = path.map(point => point.lng);
    
    const minLat = Math.min(...lats) - buffer;
    const maxLat = Math.max(...lats) + buffer;
    const minLng = Math.min(...lngs) - buffer;
    const maxLng = Math.max(...lngs) + buffer;
    
    // Requête pour trouver les signalements dans cette zone
    const reports = await Report.find({
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
      ]
    });
    
    return reports;
  } catch (error) {
    console.error('Erreur lors de la récupération des signalements:', error);
    return [];
  }
};

// Identifier les points chauds (zones à forte concentration de signalements) le long du chemin
const identifyHotspots = (path, reports) => {
  if (reports.length === 0) return [];
  
  // Convertir les coordonnées des rapports pour faciliter le traitement
  const reportCoords = reports.map(report => ({
    lat: report.location.coordinates[1],
    lng: report.location.coordinates[0],
    severity: report.severity,
    category: report.category
  }));
  
  // Trouver les clusters de rapports (groupes proches)
  const clusters = [];
  const clusterRadius = 0.0004; // ~50m en degrés
  
  // Pour chaque rapport, vérifier s'il peut rejoindre un cluster existant ou créer un nouveau
  reportCoords.forEach(report => {
    let addedToCluster = false;
    
    for (const cluster of clusters) {
      // Vérifier si le rapport est à proximité de n'importe quel point du cluster
      for (const point of cluster.points) {
        const distance = calculateDistance(report.lat, report.lng, point.lat, point.lng);
        if (distance < clusterRadius) {
          cluster.points.push(report);
          cluster.totalSeverity += report.severity;
          
          // Mettre à jour le centre du cluster (moyenne des points)
          cluster.center.lat = cluster.points.reduce((sum, p) => sum + p.lat, 0) / cluster.points.length;
          cluster.center.lng = cluster.points.reduce((sum, p) => sum + p.lng, 0) / cluster.points.length;
          
          // Ajouter la catégorie à ce cluster
          cluster.categories.add(report.category);
          
          addedToCluster = true;
          break;
        }
      }
      
      if (addedToCluster) break;
    }
    
    // Si le rapport ne rejoint aucun cluster existant, créer un nouveau
    if (!addedToCluster) {
      clusters.push({
        center: { lat: report.lat, lng: report.lng },
        points: [report],
        totalSeverity: report.severity,
        categories: new Set([report.category])
      });
    }
  });
  
  // Filtrer pour ne garder que les clusters significatifs (au moins 2 points ou sévérité élevée)
  return clusters
    .filter(cluster => cluster.points.length >= 2 || cluster.totalSeverity >= 4)
    .map(cluster => ({
      center: cluster.center,
      size: cluster.points.length,
      severity: cluster.totalSeverity / cluster.points.length,
      onPath: isClusterOnPath(cluster.center, path, 0.0002), // ~25m de tolérance
      categories: Array.from(cluster.categories)
    }))
    .sort((a, b) => b.severity - a.severity);
};

// Vérifier si un cluster est directement sur le chemin
const isClusterOnPath = (point, path, tolerance = 0.0002) => {
  for (let i = 0; i < path.length - 1; i++) {
    const distance = pointToLineDistance(
      point,
      { lat: path[i].lat, lng: path[i].lng },
      { lat: path[i+1].lat, lng: path[i+1].lng }
    );
    
    if (distance < tolerance) return true;
  }
  return false;
};

// Calculer la distance minimale d'un point à un chemin
const calculateMinDistanceToPath = (point, path) => {
  // Convertir le point de [lng, lat] à {lat, lng}
  const pointObj = { lat: point[1], lng: point[0] };
  
  let minDistance = Infinity;
  
  // Calculer la distance minimale à chaque segment du chemin
  for (let i = 0; i < path.length - 1; i++) {
    const segmentStart = path[i];
    const segmentEnd = path[i+1];
    
    const distance = pointToLineDistance(pointObj, segmentStart, segmentEnd);
    if (distance < minDistance) {
      minDistance = distance;
    }
  }
  
  return minDistance;
};

// Calculer la distance d'un point à une ligne (segment)
const pointToLineDistance = (point, lineStart, lineEnd) => {
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

// Calculer un score d'éclairage en fonction de l'heure et des signalements
const calculateLightingScore = (path, reports, preferences) => {
  // Par défaut, l'éclairage est bon
  let score = 8;
  
  // Obtenir l'heure actuelle
  const currentHour = new Date().getHours();
  
  // La nuit, réduire le score d'éclairage par défaut
  if (currentHour >= 20 || currentHour <= 6) {
    score = 6; // Base plus faible pour la nuit
    
    // Si l'utilisateur préfère éviter les zones mal éclairées, réduire davantage la nuit
    if (preferences.prioritizeLight) {
      score = 5;
    }
  }
  
  // Réduire le score en fonction des signalements d'éclairage
  const lightingIssues = reports.filter(r => r.category === 'poor_lighting');
  
  // Impact plus important la nuit
  const timeMultiplier = (currentHour >= 19 || currentHour <= 7) ? 1.5 : 1.0;
  
  if (lightingIssues.length > 0) {
    // Calculer l'impact pondéré par la sévérité et l'heure
    const totalSeverity = lightingIssues.reduce((sum, report) => sum + report.severity, 0);
    const avgSeverity = totalSeverity / lightingIssues.length;
    
    // Impact plus important si plusieurs signalements et/ou sévérité élevée
    const lightingImpact = Math.min(avgSeverity * 0.6 * timeMultiplier, 4);
    score -= lightingImpact;
    
    // Impact additionnel si les préférences de l'utilisateur mettent l'accent sur l'éclairage
    if (preferences.prioritizeLight) {
      score -= Math.min(lightingIssues.length * 0.3, 1.5);
    }
  }
  
  return Math.max(2, score);
};

// Calculer un score de fréquentation en fonction de l'heure et des signalements
const calculateCrowdednessScore = (path, reports, preferences) => {
  // Par défaut, considérons une fréquentation moyenne
  let score = 6;
  
  // Obtenir l'heure actuelle
  const currentHour = new Date().getHours();
  
  // Heures de pointe - plus de monde
  if ((currentHour >= 8 && currentHour <= 9) || (currentHour >= 17 && currentHour <= 19)) {
    score = 8;
  }
  // Tard le soir ou tôt le matin - moins de monde
  else if (currentHour >= 22 || currentHour <= 5) {
    score = 4;
    
    // Réduire davantage si l'utilisateur préfère éviter les zones isolées
    if (preferences.avoidIsolatedAreas) {
      score = 3;
    }
  }
  
  // Réduire le score en fonction des signalements de zones dangereuses
  const dangerousAreaIssues = reports.filter(r => r.category === 'unsafe_area');
  
  if (dangerousAreaIssues.length > 0) {
    // Impact plus important la nuit
    const timeMultiplier = (currentHour >= 20 || currentHour <= 6) ? 1.5 : 1.0;
    
    // Calculer l'impact pondéré par la sévérité et l'heure
    const totalSeverity = dangerousAreaIssues.reduce((sum, report) => sum + report.severity, 0);
    const avgSeverity = totalSeverity / dangerousAreaIssues.length;
    
    // Impact plus important si plusieurs signalements et/ou sévérité élevée
    const dangerImpact = Math.min(avgSeverity * 0.7 * timeMultiplier, 4);
    score -= dangerImpact;
    
    // Impact additionnel si les préférences de l'utilisateur mettent l'accent sur les zones isolées
    if (preferences.avoidIsolatedAreas) {
      score -= Math.min(dangerousAreaIssues.length * 0.4, 2);
    }
  }
  
  return Math.max(1, score);
};

// Calculer la densité des signalements le long d'un chemin
const calculateReportDensity = (reports, path) => {
  if (reports.length === 0) return 10; // Pas de signalements = score parfait
  
  // Calculer la longueur approximative du chemin
  let pathLength = 0;
  for (let i = 1; i < path.length; i++) {
    pathLength += calculateDistance(
      path[i-1].lat, path[i-1].lng,
      path[i].lat, path[i].lng
    );
  }
  
  // Calculer la densité (signalements par km)
  const density = reports.length / (pathLength || 1);
  
  // Convertir en score (10 = pas de signalements, 0 = beaucoup de signalements)
  if (density === 0) return 10;
  if (density < 0.5) return 9;
  if (density < 1) return 8;
  if (density < 1.5) return 7;
  if (density < 2) return 6;
  if (density < 2.5) return 5;
  if (density < 3) return 4;
  if (density < 5) return 3;
  if (density < 7) return 2;
  if (density < 10) return 1;
  return 0;
};

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