import React, { useState, useEffect } from 'react';
import Map from '../components/map/Map';
import RouteSearch from '../components/map/RouteSearch';
import RouteList from '../components/map/RouteList';
import '../styles/MapPage.css';

const MapPage = () => {
  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [showRoutePanel, setShowRoutePanel] = useState(false);

  // When routes are found, show the route panel
  useEffect(() => {
    if (routes.length > 0) {
      setShowRoutePanel(true);
      // Select the safest route by default
      setSelectedRouteId(routes[0].id);
    } else {
      setShowRoutePanel(false);
      setSelectedRouteId(null);
    }
  }, [routes]);

  const handleRoutesFound = (foundRoutes, originCoords, destinationCoords) => {
    setRoutes(foundRoutes);
    setOrigin(originCoords);
    setDestination(destinationCoords);
  };

  const handleSelectRoute = (routeId) => {
    setSelectedRouteId(routeId);
  };

  // Find the selected route object
  const selectedRoute = routes.find(route => route.id === selectedRouteId);

  return (
    <div className="map-page">
      <h1>SafeWalk Map</h1>
      <p>Find and navigate safe routes in your area</p>
      
      <div className="map-container-wrapper">
        <div className={`map-sidebar ${showRoutePanel ? 'show-panel' : ''}`}>
          <RouteSearch onRoutesFound={handleRoutesFound} />
          
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
        />
      </div>
    </div>
  );
};

export default MapPage;