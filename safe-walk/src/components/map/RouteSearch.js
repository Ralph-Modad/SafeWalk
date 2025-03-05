// safe-walk/src/components/map/RouteSearch.js
import React, { useState, useEffect } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { routeService } from '../../services/api';
import { useUser } from '../../context/UserContext';
import '../../styles/RouteSearch.css';

// Définir les bibliothèques Google Maps à charger
const libraries = ['places'];

const RouteSearch = ({ onRoutesFound, onSearchStart, onSearchError, isLoaded, loadError, googleMapsApiKey }) => {
  const { user } = useUser();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [useCurrentLocation, setUseCurrentLocation] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Debug: Afficher dans la console si l'API est chargée et la clé utilisée
  useEffect(() => {
    console.log("RouteSearch - API chargée:", isLoaded);
    console.log("RouteSearch - Clé API reçue:", googleMapsApiKey ? "Oui" : "Non");
    
    if (loadError) {
      console.error("Erreur de chargement dans RouteSearch:", loadError);
    }
  }, [isLoaded, loadError, googleMapsApiKey]);

  // Fonction pour géocoder une adresse en utilisant l'API Geocoding de Google
  const geocodeAddress = (address) => {
    return new Promise((resolve, reject) => {
      if (!window.google || !window.google.maps) {
        reject(new Error("L'API Google Maps n'est pas chargée correctement"));
        return;
      }

      console.log("Geocoding address:", address);
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address }, (results, status) => {
        console.log("Geocoding result status:", status);
        
        if (status === "OK" && results && results[0]) {
          const location = results[0].geometry.location;
          const coords = {
            lat: location.lat(),
            lng: location.lng(),
            formattedAddress: results[0].formatted_address
          };
          
          console.log("Geocoded coordinates:", coords);
          resolve(coords);
        } else {
          console.error("Geocoding failed:", status);
          reject(new Error(`Impossible de trouver l'adresse (${status})`));
        }
      });
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Effacer les erreurs précédentes
    setError('');
    
    // Vérifier si une destination a été entrée
    if (!destination) {
      const errorMsg = 'Veuillez entrer une adresse de destination';
      setError(errorMsg);
      if (onSearchError) onSearchError(errorMsg);
      return;
    }

    // Vérifier si l'API Google Maps est chargée
    if (!isLoaded || !window.google) {
      const errorMsg = "L'API Google Maps n'est pas encore chargée. Veuillez patienter ou rafraîchir la page.";
      setError(errorMsg);
      if (onSearchError) onSearchError(errorMsg);
      return;
    }

    try {
      // Indiquer que la recherche a commencé
      setLoading(true);
      if (onSearchStart) onSearchStart();

      // Obtenir les coordonnées de départ
      let originCoords;
      if (useCurrentLocation) {
        try {
          originCoords = await getCurrentLocation();
          console.log("Position actuelle:", originCoords);
        } catch (locError) {
          const errorMsg = locError.message;
          setError(errorMsg);
          if (onSearchError) onSearchError(errorMsg);
          setLoading(false);
          return;
        }
      } else if (origin) {
        try {
          originCoords = await geocodeAddress(origin);
        } catch (geoError) {
          const errorMsg = `Impossible de trouver l'adresse de départ: ${geoError.message}`;
          setError(errorMsg);
          if (onSearchError) onSearchError(errorMsg);
          setLoading(false);
          return;
        }
      } else {
        const errorMsg = 'Veuillez entrer une adresse de départ ou utiliser votre position actuelle';
        setError(errorMsg);
        if (onSearchError) onSearchError(errorMsg);
        setLoading(false);
        return;
      }

      // Géocoder la destination
      let destinationCoords;
      try {
        destinationCoords = await geocodeAddress(destination);
      } catch (geoError) {
        const errorMsg = `Impossible de trouver l'adresse de destination: ${geoError.message}`;
        setError(errorMsg);
        if (onSearchError) onSearchError(errorMsg);
        setLoading(false);
        return;
      }

      console.log("Coordonnées d'origine:", originCoords);
      console.log("Coordonnées de destination:", destinationCoords);

      // Obtenir les préférences utilisateur
      const preferences = user?.preferences || {
        prioritizeLight: true,
        avoidIsolatedAreas: true
      };

      // Obtenir les itinéraires depuis l'API (en mode fallback pour le développement)
      try {
        // Utiliser une version locale du service getRoutes pour le développement
        // Cela simule des itinéraires sans faire d'appel au backend
        
        // Calculer la distance réelle entre l'origine et la destination (Haversine)
        const distance = calculateDistance(
          originCoords.lat, originCoords.lng,
          destinationCoords.lat, destinationCoords.lng
        );
        
        // Estimer le temps de marche (5 km/h en moyenne)
        const walkingSpeed = 5; // km/h
        const duration = Math.round((distance / walkingSpeed) * 60); // minutes
        
        console.log("Distance calculée:", distance, "km");
        console.log("Durée estimée:", duration, "minutes");
        
        // Générer 3 itinéraires différents
        const routes = [
          {
            id: 'route_1',
            name: 'Itinéraire le plus sûr',
            distance: parseFloat(distance.toFixed(1)),
            duration: duration,
            safetyScore: 8.7,
            path: generatePathWithCurve(originCoords, destinationCoords, 0.005),
            safetyFactors: {
              lighting: 9,
              crowdedness: 8,
              reportDensity: 9
            },
            summary: 'Via rues principales'
          },
          {
            id: 'route_2',
            name: 'Itinéraire le plus rapide',
            distance: parseFloat((distance * 0.9).toFixed(1)),
            duration: Math.round(duration * 0.9),
            safetyScore: 6.5,
            path: generatePathWithCurve(originCoords, destinationCoords, -0.005),
            safetyFactors: {
              lighting: 6,
              crowdedness: 7,
              reportDensity: 6
            },
            summary: 'Itinéraire direct'
          },
          {
            id: 'route_3',
            name: 'Itinéraire alternatif',
            distance: parseFloat((distance * 1.1).toFixed(1)),
            duration: Math.round(duration * 1.1),
            safetyScore: 7.2,
            path: generatePathWithCurve(originCoords, destinationCoords, 0.01),
            safetyFactors: {
              lighting: 7,
              crowdedness: 8,
              reportDensity: 7
            },
            summary: 'Via zones piétonnes'
          }
        ];
        
        onRoutesFound(routes, originCoords, destinationCoords);
      } catch (apiError) {
        console.error('Erreur API:', apiError);
        const errorMsg = `Impossible de trouver un itinéraire: ${apiError.message || 'Erreur inconnue'}`;
        setError(errorMsg);
        if (onSearchError) onSearchError(errorMsg);
      }
    } catch (err) {
      console.error('Erreur lors de la recherche d\'itinéraires:', err);
      const errorMsg = 'Impossible de trouver des itinéraires. Veuillez réessayer.';
      setError(errorMsg);
      if (onSearchError) onSearchError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
          },
          (error) => {
            console.error('Erreur de géolocalisation:', error);
            let errorMsg = 'Impossible d\'obtenir votre position actuelle.';
            
            // Messages d'erreur plus spécifiques
            switch(error.code) {
              case error.PERMISSION_DENIED:
                errorMsg = 'Vous avez refusé l\'accès à votre géolocalisation. Veuillez entrer manuellement une adresse de départ.';
                break;
              case error.POSITION_UNAVAILABLE:
                errorMsg = 'Information de localisation indisponible. Veuillez entrer manuellement une adresse de départ.';
                break;
              case error.TIMEOUT:
                errorMsg = 'Délai dépassé pour obtenir votre position. Veuillez entrer manuellement une adresse de départ.';
                break;
              default:
                break;
            }
            
            reject(new Error(errorMsg));
          },
          { timeout: 10000, enableHighAccuracy: true }
        );
      } else {
        reject(new Error('La géolocalisation n\'est pas supportée par votre navigateur. Veuillez entrer une adresse de départ.'));
      }
    });
  };

  // Fonction pour calculer la distance entre deux points (Haversine)
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

  // Fonction pour générer un chemin avec une courbe
  const generatePathWithCurve = (start, end, curveFactor) => {
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

  return (
    <div className="route-search-container">
      <h2>Trouver un itinéraire sécurisé</h2>
      {error && <div className="error-message">{error}</div>}
      {!isLoaded && <div className="info-message">Chargement de l'API Google Maps...</div>}
      
      <form onSubmit={handleSubmit} className="route-search-form">
        <div className="form-group">
          <label htmlFor="origin">Point de départ</label>
          <div className="origin-input-group">
            <input
              type="text"
              id="origin"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="Entrez l'adresse de départ"
              disabled={useCurrentLocation}
              className={useCurrentLocation ? 'disabled-input' : ''}
            />
            <div className="use-current-location">
              <input
                type="checkbox"
                id="useCurrentLocation"
                checked={useCurrentLocation}
                onChange={(e) => setUseCurrentLocation(e.target.checked)}
              />
              <label htmlFor="useCurrentLocation">Utiliser ma position actuelle</label>
            </div>
          </div>
        </div>
        
        <div className="form-group">
          <label htmlFor="destination">Destination</label>
          <input
            type="text"
            id="destination"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Entrez l'adresse de destination"
            required
          />
        </div>
        
        <button 
          type="submit" 
          className="search-button"
          disabled={loading || !isLoaded}
        >
          {loading ? 'Recherche en cours...' : 'Trouver des itinéraires sécurisés'}
        </button>
      </form>
    </div>
  );
};

export default RouteSearch;