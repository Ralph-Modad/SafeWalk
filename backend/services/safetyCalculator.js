// services/safetyCalculator.js
const axios = require('axios');
const Report = require('../models/Report');

// Calculer le score de sécurité d'un itinéraire
exports.calculateSafetyScore = async (path, userPreferences) => {
  try {
    // Paramètres par défaut si non spécifiés
    const preferences = {
      prioritizeLight: userPreferences?.prioritizeLight || true,
      avoidIsolatedAreas: userPreferences?.avoidIsolatedAreas || true
    };
    
    // Récupérer les signalements le long du chemin
    const reports = await getReportsAlongPath(path);
    
    // Calculer le score de base (10 = parfaitement sûr)
    let baseScore = 10;
    
    // Facteurs de sécurité
    const safetyFactors = {
      lighting: 8, // Valeur par défaut, à remplacer par des données réelles
      crowdedness: 7, // Valeur par défaut, à remplacer par des données réelles
      reportDensity: calculateReportDensity(reports, path)
    };
    
    // Ajuster le score en fonction des signalements
    if (reports.length > 0) {
      // Réduire le score en fonction de la gravité des signalements
      const severityImpact = reports.reduce((sum, report) => sum + report.severity, 0) / reports.length;
      baseScore -= severityImpact;
      
      // Ajuster en fonction des préférences utilisateur
      if (preferences.prioritizeLight) {
        const lightingIssues = reports.filter(r => r.category === 'poor_lighting');
        if (lightingIssues.length > 0) {
          baseScore -= 1.5;
          safetyFactors.lighting = Math.max(3, safetyFactors.lighting - 3);
        }
      }
      
      if (preferences.avoidIsolatedAreas) {
        const isolatedAreaIssues = reports.filter(r => r.category === 'unsafe_area');
        if (isolatedAreaIssues.length > 0) {
          baseScore -= 2;
          safetyFactors.crowdedness = Math.max(2, safetyFactors.crowdedness - 4);
        }
      }
    }
    
    // Assurer que le score est entre 0 et 10
    const finalScore = Math.max(0, Math.min(10, baseScore));
    
    return {
      safetyScore: finalScore,
      safetyFactors
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
      }
    };
  }
};

// Récupérer les signalements le long d'un chemin
const getReportsAlongPath = async (path) => {
  try {
    // Créer un buffer autour du chemin pour trouver les signalements à proximité
    const buffer = 0.001; // Environ 100m en degrés
    
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
  // Ajuster ces valeurs selon vos besoins
  if (density === 0) return 10;
  if (density < 1) return 8;
  if (density < 2) return 6;
  if (density < 5) return 4;
  if (density < 10) return 2;
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