// safe-walk/src/components/map/RouteSearch.js
import React, { useState, useEffect } from 'react';
import { routeService } from '../../services/api';
import { useUser } from '../../context/UserContext';
import '../../styles/RouteSearch.css';

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

      // Appel à l'API pour obtenir les itinéraires
      try {
        const response = await routeService.getRoutes(originCoords, destinationCoords, preferences);
        
        if (response && response.routes && response.routes.length > 0) {
          onRoutesFound(response.routes, originCoords, destinationCoords);
        } else {
          const errorMsg = 'Aucun itinéraire trouvé entre ces points.';
          setError(errorMsg);
          if (onSearchError) onSearchError(errorMsg);
        }
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