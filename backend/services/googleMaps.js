// backend/services/googleMaps.js
const axios = require('axios');
const config = require('../config/config');

// Créer une instance axios pour l'API Routes de Google
const googleMapsClient = axios.create({
  baseURL: 'https://routes.googleapis.com',
  headers: {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': ""
  }
});

// Geocoder - convertir adresse en coordonnées
exports.geocode = async (address) => {
  try {
    // Nous utilisons toujours l'API Geocoding pour cette fonctionnalité
    const geocodeClient = axios.create({
      baseURL: 'https://maps.googleapis.com/maps/api',
      params: {
        key: ""
      }
    });

    const response = await geocodeClient.get('/geocode/json', {
      params: { address }
    });

    if (response.data.status !== 'OK') {
      throw new Error(`Erreur de géocodage: ${response.data.status}`);
    }

    const location = response.data.results[0].geometry.location;
    return {
      lat: location.lat,
      lng: location.lng,
      formattedAddress: response.data.results[0].formatted_address
    };
  } catch (error) {
    console.error('Erreur de géocodage:', error.message);
    throw error;
  }
};

// Itinéraire entre deux points pour les piétons avec la nouvelle API Routes
exports.getDirections = async (origin, destination, waypoints = []) => {
  try {
    // Construire l'objet de requête pour l'API Routes - version simplifiée
    const requestBody = {
      origin: {
        location: {
          latLng: {
            latitude: origin.lat,
            longitude: origin.lng
          }
        }
      },
      destination: {
        location: {
          latLng: {
            latitude: destination.lat,
            longitude: destination.lng
          }
        }
      },
      travelMode: "WALK", // Mode piéton
      languageCode: "fr-FR",
      units: "METRIC"
    };

    console.log(`Demande d'itinéraire piéton de ${origin.lat},${origin.lng} à ${destination.lat},${destination.lng}`);
    console.log("Contenu de la requête:", JSON.stringify(requestBody, null, 2));
    
    try {
      // Appel à l'API Routes
      const response = await googleMapsClient.post('/directions/v2:computeRoutes', requestBody, {
        headers: {
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline'
        }
      });

      console.log("Réponse API reçue:", JSON.stringify(response.data, null, 2));

      if (!response.data.routes || response.data.routes.length === 0) {
        // Si pas de résultats de l'API, générer un itinéraire fictif basé sur la distance
        console.log("Aucun itinéraire trouvé, génération d'un itinéraire fictif");
        
        // Calculer la distance directe en mètres
        const distanceMeters = calculateHaversineDistance(
          origin.lat, origin.lng, 
          destination.lat, destination.lng
        ) * 1000; // convertir km en mètres
        
        // Estimer la durée de marche (à 5 km/h en moyenne)
        const walkingDurationMinutes = Math.round((distanceMeters / 1000) / 5 * 60);
        
        // Générer un tracé simple entre les deux points
        const path = [
          { lat: origin.lat, lng: origin.lng },
          { lat: destination.lat, lng: destination.lng }
        ];
        
        // Retourner un itinéraire fictif
        return [{
          distance: distanceMeters / 1000, // en km
          duration: walkingDurationMinutes, // en minutes
          polyline: {
            encodedPolyline: "" // Pas de polyline encodée pour l'itinéraire fictif
          },
          steps: [],
          path: path,
          summary: 'Itinéraire piéton'
        }];
      }

      // Formater la réponse pour notre application
      return response.data.routes.map(route => {
        // Décoder le polyline pour obtenir le chemin complet
        const path = this.decodePath(route.polyline.encodedPolyline);
        
        // CORRECTION: Extraire la durée en secondes et convertir en minutes
        let durationMinutes = 0;
        
        if (route.duration) {
          // Format attendu: "3723s" ou similaire
          const durationMatch = route.duration.match(/(\d+)s/);
          if (durationMatch && durationMatch[1]) {
            const durationSeconds = parseInt(durationMatch[1]);
            durationMinutes = Math.round(durationSeconds / 60);
          }
        }
        
        // Si la durée est toujours 0 ou absurde, calculer une estimation basée sur la distance
        if (durationMinutes === 0 || durationMinutes > 1000) {
          // Vitesse moyenne de marche: 5 km/h
          durationMinutes = Math.round((route.distanceMeters / 1000) / 5 * 60);
        }
        
        return {
          distance: route.distanceMeters / 1000, // km
          duration: durationMinutes, // en minutes
          polyline: route.polyline.encodedPolyline,
          steps: [], // Simplifié pour cette version
          path: path, // Tous les points du chemin décodés
          summary: 'Itinéraire piéton'
        };
      });
    } catch (error) {
      // Afficher plus de détails sur l'erreur
      console.error('Erreur complète lors de l\'appel API:', error);
      if (error.response) {
        console.error('Réponse d\'erreur:', JSON.stringify(error.response.data, null, 2));
      }
      
      // Générer un itinéraire fictif en cas d'erreur
      console.log("Erreur d'API, génération d'un itinéraire fictif");
      
      // Calculer la distance directe
      const distanceMeters = calculateHaversineDistance(
        origin.lat, origin.lng, 
        destination.lat, destination.lng
      ) * 1000; // convertir km en mètres
      
      // Estimer la durée de marche (à 5 km/h en moyenne)
      const walkingDurationMinutes = Math.round((distanceMeters / 1000) / 5 * 60);
      
      // Générer un tracé simple entre les deux points
      const path = [
        { lat: origin.lat, lng: origin.lng },
        { lat: destination.lat, lng: destination.lng }
      ];
      
      // Retourner un itinéraire fictif
      return [{
        distance: distanceMeters / 1000, // en km
        duration: walkingDurationMinutes, // en minutes
        polyline: {
          encodedPolyline: "" // Pas de polyline encodée pour l'itinéraire fictif
        },
        steps: [],
        path: path,
        summary: 'Itinéraire piéton'
      }];
    }
  } catch (error) {
    console.error('Erreur lors de la recherche d\'itinéraire:', error);
    throw error;
  }
};

// Calcul de distance Haversine (distance à vol d'oiseau)
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
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

// Décodage des polylines de Google Maps
// Cette fonction convertit le format encodé en points géographiques
exports.decodePath = (encodedPath) => {
  if (!encodedPath) return [];
  
  let points = [];
  let index = 0, lat = 0, lng = 0;

  while (index < encodedPath.length) {
    let b, shift = 0, result = 0;
    
    do {
      b = encodedPath.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;
    
    shift = 0;
    result = 0;
    
    do {
      b = encodedPath.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;
    
    points.push({
      lat: lat * 1e-5,
      lng: lng * 1e-5
    });
  }
  
  return points;
};