// backend/services/safetyCalculator.js
const Report = require('../models/Report');

// Calculer le score de sécurité d'un itinéraire et trouver des alternatives plus sûres
exports.calculateSafetyScore = async (path, userPreferences) => {
  try {
    // Paramètres par défaut si non spécifiés
    const preferences = {
      prioritizeLight: userPreferences?.prioritizeLight || true,
      avoidIsolatedAreas: userPreferences?.avoidIsolatedAreas || true
    };
    
    // Récupérer les signalements le long du chemin avec un rayon plus précis
    // Nous utilisons un rayon de 30 mètres autour de chaque point du chemin
    const reports = await getReportsAlongPath(path, 0.00025); // ~30 mètres en coordonnées
    
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
      // Pondérer les signalements par gravité et par proximité au chemin
      const weightedReports = reports.map(report => {
        // Calculer la distance minimale du rapport au chemin
        const minDistance = calculateMinDistanceToPath(report.location.coordinates, path);
        
        // Plus le rapport est proche, plus il a d'impact (impact inversement proportionnel à la distance)
        const proximityFactor = Math.min(1, 30 / (minDistance * 1000 + 1)); // 1 à distance 0, diminue avec la distance
        
        return {
          ...report.toObject(),
          weight: report.severity * proximityFactor
        };
      });
      
      // Impact global des rapports pondérés
      const totalWeight = weightedReports.reduce((sum, report) => sum + report.weight, 0);
      const averageWeight = totalWeight / weightedReports.length;
      
      // Réduire le score en fonction de la moyenne pondérée
      // Limiter la réduction à 6 points maximum pour garder une échelle cohérente
      const reportImpact = Math.min(averageWeight * 1.2, 6);
      baseScore -= reportImpact;
      
      // Réduire davantage le score si des signalements sont directement sur le chemin
      const directPathReports = weightedReports.filter(report => report.weight > 0.8);
      if (directPathReports.length > 0) {
        const directPathImpact = Math.min(directPathReports.length * 0.5, 2);
        baseScore -= directPathImpact;
      }
      
      // Ajuster les facteurs en fonction des signalements spécifiques
      // Impact de l'éclairage
      if (preferences.prioritizeLight) {
        const lightingIssues = weightedReports.filter(r => r.category === 'poor_lighting');
        if (lightingIssues.length > 0) {
          const lightingImpact = Math.min(
            lightingIssues.reduce((sum, r) => sum + r.weight, 0) / lightingIssues.length * 0.8,
            3
          );
          safetyFactors.lighting = Math.max(2, safetyFactors.lighting - lightingImpact);
        }
      }
      
      // Impact des zones isolées/dangereuses
      if (preferences.avoidIsolatedAreas) {
        const isolatedAreaIssues = weightedReports.filter(r => r.category === 'unsafe_area');
        if (isolatedAreaIssues.length > 0) {
          const isolationImpact = Math.min(
            isolatedAreaIssues.reduce((sum, r) => sum + r.weight, 0) / isolatedAreaIssues.length * 1.0, 
            3.5
          );
          safetyFactors.crowdedness = Math.max(2, safetyFactors.crowdedness - isolationImpact);
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
        totalSeverity: report.severity
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
      categories: [...new Set(cluster.points.map(p => p.category))]
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