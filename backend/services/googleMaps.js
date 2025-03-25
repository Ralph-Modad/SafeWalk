// backend/services/googleMaps.js
const axios = require('axios');
const config = require('../config/config');
const helpers = require('../utils/helpers');

// Créer une instance axios pour l'API Routes de Google
const googleMapsClient = axios.create({
  baseURL: 'https://routes.googleapis.com',
  headers: {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': config.GOOGLE_MAPS_API_KEY
  }
});

/**
 * Convertit une adresse en coordonnées géographiques
 * @param {String} address - Adresse à convertir
 * @returns {Object} Coordonnées {lat, lng, formattedAddress}
 */
exports.geocode = async (address) => {
  try {
    // Utiliser l'API Geocoding de Google Maps
    const geocodeClient = axios.create({
      baseURL: 'https://maps.googleapis.com/maps/api',
      params: {
        key: config.GOOGLE_MAPS_API_KEY
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
    throw new Error('Impossible de convertir l\'adresse en coordonnées. Vérifiez votre clé API Google Maps.');
  }
};

/**
 * Obtient un itinéraire piéton entre deux points
 * @param {Object} origin - Point de départ {lat, lng}
 * @param {Object} destination - Point d'arrivée {lat, lng}
 * @param {Array} waypoints - Points intermédiaires (optionnel)
 * @returns {Array} Itinéraires disponibles
 */
exports.getDirections = async (origin, destination, waypoints = []) => {
  try {
    // Construire l'objet de requête pour l'API Routes
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
      travelMode: "WALK",
      languageCode: "fr-FR",
      units: "METRIC"
    };
    
    // Appel à l'API Routes
    const response = await googleMapsClient.post('/directions/v2:computeRoutes', requestBody, {
      headers: {
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline'
      }
    });

    if (!response.data.routes || response.data.routes.length === 0) {
      throw new Error('Aucun itinéraire trouvé pour ces coordonnées');
    }

    // Formater la réponse pour notre application
    return response.data.routes.map(route => {
      // Décoder le polyline pour obtenir le chemin complet
      const path = this.decodePath(route.polyline.encodedPolyline);
      
      // Extraire la durée en secondes et convertir en minutes
      let durationMinutes = 0;
      
      if (route.duration) {
        const durationMatch = route.duration.match(/(\d+)s/);
        if (durationMatch && durationMatch[1]) {
          const durationSeconds = parseInt(durationMatch[1]);
          durationMinutes = Math.round(durationSeconds / 60);
        }
      }
      
      // Si la durée n'est pas valide, calculer une estimation
      if (durationMinutes === 0 || durationMinutes > 1000) {
        durationMinutes = Math.round((route.distanceMeters / 1000) / 5 * 60);
      }
      
      return {
        distance: route.distanceMeters / 1000, // km
        duration: durationMinutes, // en minutes
        polyline: route.polyline.encodedPolyline,
        steps: [], // Simplifié
        path: path,
        summary: 'Itinéraire piéton'
      };
    });
  } catch (error) {
    console.error('Erreur lors de la recherche d\'itinéraire:', error.message);
    throw new Error('Impossible de calculer un itinéraire. Vérifiez votre clé API Google Maps et les coordonnées.');
  }
};

/**
 * Décode un polyline encodé en une série de points
 * @param {String} encodedPath - Polyline encodé
 * @returns {Array} Tableau de points {lat, lng}
 */
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