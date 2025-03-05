// safe-walk/src/pages/MapPage.js
import React, { useState, useEffect } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import Map from '../components/map/Map';
import RouteSearch from '../components/map/RouteSearch';
import RouteList from '../components/map/RouteList';
import '../styles/MapPage.css';

// Définir les bibliothèques Google Maps à charger
const libraries = ['places'];

// ATTENTION: Ceci est temporaire pour tester - à remplacer par la clé API
// Et à déplacer dans le fichier .env dès que possible
const TEMP_API_KEY = ""; 

const MapPage = () => {
  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [showRoutePanel, setShowRoutePanel] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Charger l'API Google Maps avec la clé API directe
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: TEMP_API_KEY,
    libraries
  });

  // Debug des variables d'environnement
  useEffect(() => {
    console.log("Clé API via env:", process.env.REACT_APP_GOOGLE_MAPS_API_KEY);
    console.log("Clé API directe utilisée:", TEMP_API_KEY);
  }, []);

  // Afficher les erreurs de chargement de l'API
  useEffect(() => {
    if (loadError) {
      console.error("Erreur de chargement de l'API Google Maps:", loadError);
      setError("Impossible de charger l'API Google Maps. Vérifiez votre connexion et que la clé API est correctement configurée.");
    }
  }, [loadError]);

  // Quand des itinéraires sont trouvés
  useEffect(() => {
    if (routes.length > 0) {
      setShowRoutePanel(true);
      setSelectedRouteId(routes[0].id);
    } else {
      setShowRoutePanel(false);
      setSelectedRouteId(null);
    }
  }, [routes]);

  const handleRoutesFound = (foundRoutes, originCoords, destinationCoords) => {
    if (foundRoutes && foundRoutes.length > 0) {
      setRoutes(foundRoutes);
      setOrigin(originCoords);
      setDestination(destinationCoords);
      setError(null);
    } else {
      setError("Aucun itinéraire trouvé entre ces deux points. Veuillez essayer une autre destination.");
      setRoutes([]);
    }
    setIsLoading(false);
  };

  const handleSearchStart = () => {
    setIsLoading(true);
    setError(null);
  };

  const handleSearchError = (errorMessage) => {
    setError(errorMessage);
    setIsLoading(false);
    setRoutes([]);
  };

  const handleSelectRoute = (routeId) => {
    setSelectedRouteId(routeId);
  };

  // Trouver l'itinéraire sélectionné
  const selectedRoute = routes.find(route => route.id === selectedRouteId);

  return (
    <div className="map-page">
      <h1>Carte SafeWalk</h1>
      <p>Trouvez et naviguez sur des itinéraires sécurisés</p>

      {!isLoaded && (
        <div className="loading-message">
          <div className="spinner"></div>
          <p>Chargement de l'API Google Maps...</p>
        </div>
      )}
      
      {loadError && (
        <div className="error-message">
          <p>Erreur lors du chargement de l'API Google Maps: {loadError.message}</p>
          <p>Vérifiez votre connexion et votre clé API.</p>
        </div>
      )}
      
      <div className="map-container-wrapper">
        <div className={`map-sidebar ${showRoutePanel ? 'show-panel' : ''}`}>
          <RouteSearch 
            onRoutesFound={handleRoutesFound} 
            onSearchStart={handleSearchStart}
            onSearchError={handleSearchError}
            isLoaded={isLoaded}
            loadError={loadError}
            googleMapsApiKey={TEMP_API_KEY}
          />
          
          {isLoading && (
            <div className="route-loading">
              <div className="spinner"></div>
              <p>Recherche des meilleurs itinéraires...</p>
            </div>
          )}
          
          {error && (
            <div className="route-error">
              <p>{error}</p>
            </div>
          )}
          
          {showRoutePanel && (
            <RouteList 
              routes={routes} 
              onSelectRoute={handleSelectRoute}
              selectedRouteId={selectedRouteId}
            />
          )}
        </div>
        
        <Map 
          selectedRoute={selectedRoute}
          origin={origin}
          destination={destination}
          isLoaded={isLoaded}
          loadError={loadError}
          googleMapsApiKey={TEMP_API_KEY}
        />
      </div>
    </div>
  );
};

export default MapPage;