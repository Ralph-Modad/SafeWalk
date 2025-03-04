// backend/services/googleMaps.js
const axios = require('axios');
const config = require('../config/config');

const googleMapsClient = axios.create({
  baseURL: 'https://maps.googleapis.com/maps/api',
  params: {
    key: config.GOOGLE_MAPS_API_KEY
  }
});

// Geocoder - convertir adresse en coordonnées
exports.geocode = async (address) => {
  try {
    const response = await googleMapsClient.get('/geocode/json', {
      params: { address }
    });

    if (response.data.status !== 'OK') {
      throw new Error(`Geocoding error: ${response.data.status}`);
    }

    const location = response.data.results[0].geometry.location;
    return {
      lat: location.lat,
      lng: location.lng
    };
  } catch (error) {
    console.error('Geocoding error:', error.message);
    throw error;
  }
};

// Itinéraire entre deux points
exports.getDirections = async (origin, destination, waypoints = []) => {
  try {
    const originStr = typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`;
    const destinationStr = typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`;
    
    // Format waypoints
    const waypointsParam = waypoints.length > 0 
      ? waypoints.map(wp => `${wp.lat},${wp.lng}`).join('|')
      : null;
    
    const response = await googleMapsClient.get('/directions/json', {
      params: {
        origin: originStr,
        destination: destinationStr,
        waypoints: waypointsParam,
        mode: 'walking',
        alternatives: true
      }
    });

    if (response.data.status !== 'OK') {
      throw new Error(`Directions error: ${response.data.status}`);
    }

    return response.data.routes.map(route => ({
      distance: route.legs[0].distance.value / 1000, // convertir en km
      duration: Math.ceil(route.legs[0].duration.value / 60), // convertir en minutes
      polyline: route.overview_polyline.points,
      steps: route.legs[0].steps.map(step => ({
        instruction: step.html_instructions,
        distance: step.distance.value,
        duration: step.duration.value,
        startLocation: step.start_location,
        endLocation: step.end_location
      })),
      path: this.decodePath(route.overview_polyline.points)
    }));
  } catch (error) {
    console.error('Directions error:', error.message);
    throw error;
  }
};

// Décodage du polyline en coordonnées
exports.decodePath = (encodedPath) => {
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