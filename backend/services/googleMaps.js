// backend/services/googleMaps.js
const axios = require('axios');
const config = require('../config/config');

const googleMapsClient = axios.create({
  baseURL: 'https://maps.googleapis.com/maps/api',
  params: {
    key: ""
  }
});

// Geocoder - convertir adresse en coordonnées
exports.geocode = async (address) => {
  try {
    const response = await googleMapsClient.get('/geocode/json', {
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

// Itinéraire entre deux points pour les piétons
exports.getDirections = async (origin, destination, waypoints = []) => {
  try {
    const originStr = typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`;
    const destinationStr = typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`;
    
    // Format waypoints pour l'API
    let waypointsParam = null;
    if (waypoints && waypoints.length > 0) {
      waypointsParam = waypoints.map(wp => {
        return typeof wp === 'string' ? wp : `${wp.lat},${wp.lng}`;
      }).join('|');
    }
    
    console.log(`Demande d'itinéraire piéton de ${originStr} à ${destinationStr}`);
    
    const response = await googleMapsClient.get('/directions/json', {
      params: {
        origin: originStr,
        destination: destinationStr,
        waypoints: waypointsParam,
        mode: 'walking', // Important: mode piéton
        alternatives: true, // Obtenir plusieurs itinéraires alternatifs
        units: 'metric',
        language: 'fr' // Pour les instructions en français
      }
    });

    if (response.data.status !== 'OK') {
      console.error(`Erreur API Directions: ${response.data.status}`, response.data);
      throw new Error(`Erreur d'itinéraire: ${response.data.status}`);
    }

    if (!response.data.routes || response.data.routes.length === 0) {
      throw new Error('Aucun itinéraire trouvé');
    }

    return response.data.routes.map(route => {
      // Extraire tous les points du chemin avec le décodage de polyline
      const path = this.decodePath(route.overview_polyline.points);
      
      return {
        distance: route.legs[0].distance.value / 1000, // km
        duration: Math.ceil(route.legs[0].duration.value / 60), // minutes
        polyline: route.overview_polyline.points,
        steps: route.legs[0].steps.map(step => ({
          instruction: step.html_instructions,
          distance: step.distance.value,
          duration: step.duration.value,
          startLocation: step.start_location,
          endLocation: step.end_location,
          maneuver: step.maneuver || null,
          // Ajouter les points détaillés pour chaque étape de l'itinéraire
          path: step.polyline ? this.decodePath(step.polyline.points) : []
        })),
        path: path, // Tous les points du chemin décodés
        summary: route.summary || 'Itinéraire piéton'
      };
    });
  } catch (error) {
    console.error('Erreur lors de la recherche d\'itinéraire:', error);
    throw error;
  }
};

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