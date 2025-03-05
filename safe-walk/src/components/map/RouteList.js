// safe-walk/src/components/map/RouteList.js
import React from 'react';
import '../../styles/RouteList.css';

const RouteList = ({ routes, onSelectRoute, selectedRouteId }) => {
  if (!routes || routes.length === 0) {
    return null;
  }

  // Helper function to get safety color
  const getSafetyColor = (score) => {
    if (score >= 8) return '#4caf50'; // Green for safe
    if (score >= 6) return '#ff9800'; // Orange for moderate
    return '#f44336'; // Red for unsafe
  };

  // Helper function to get safety label
  const getSafetyLabel = (score) => {
    if (score >= 8) return 'Très sûr';
    if (score >= 6) return 'Modérément sûr';
    return 'Peu sûr';
  };
  
  // Helper function to get hotspot category label
  const getCategoryLabel = (category) => {
    switch (category) {
      case 'poor_lighting': return 'Éclairage insuffisant';
      case 'unsafe_area': return 'Zone dangereuse';
      case 'construction': return 'Travaux';
      case 'obstacle': return 'Obstacle';
      case 'bad_weather': return 'Intempéries';
      default: return category;
    }
  };

  return (
    <div className="route-list-container">
      <h2>Itinéraires disponibles</h2>
      <div className="routes-count">{routes.length} itinéraires trouvés</div>
      <div className="route-list">
        {routes.map(route => (
          <div 
            key={route.id}
            className={`route-card ${selectedRouteId === route.id ? 'selected' : ''}`}
            onClick={() => onSelectRoute(route.id)}
          >
            <div className="route-header">
              <h3>{route.name}</h3>
              <div 
                className="safety-score" 
                style={{ backgroundColor: getSafetyColor(route.safetyScore) }}
                title={`Score de sécurité: ${route.safetyScore.toFixed(1)}/10`}
              >
                {route.safetyScore.toFixed(1)}
              </div>
            </div>
            
            <div className="route-details">
              <div className="detail-item">
                <span className="detail-label">Distance</span>
                <span className="detail-value">{route.distance.toFixed(1)} km</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Durée</span>
                <span className="detail-value">{route.duration} min</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Sécurité</span>
                <span className="detail-value">{getSafetyLabel(route.safetyScore)}</span>
              </div>
            </div>
            
            {/* Afficher les points chauds si présents */}
            {route.hotspots && route.hotspots.length > 0 && (
              <div className="route-hotspots">
                <div className="hotspots-header">Zones à risque:</div>
                <ul className="hotspots-list">
                  {route.hotspots.map((hotspot, index) => (
                    <li key={index} className="hotspot-item">
                      {hotspot.categories && hotspot.categories.map(category => (
                        <span key={category} className="hotspot-category">
                          {getCategoryLabel(category)}
                        </span>
                      ))}
                      {hotspot.onPath ? 
                        <span className="hotspot-on-path">Sur le chemin</span> : 
                        <span className="hotspot-near-path">À proximité</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {route.safetyFactors && (
              <div className="safety-factors">
                <div className="safety-factors-header">Facteurs de sécurité:</div>
                <div className="safety-factor">
                  <span className="factor-label">Éclairage</span>
                  <div className="factor-bar-container">
                    <div 
                      className="factor-bar" 
                      style={{ 
                        width: `${route.safetyFactors.lighting * 10}%`,
                        backgroundColor: getSafetyColor(route.safetyFactors.lighting)
                      }}
                    ></div>
                  </div>
                </div>
                <div className="safety-factor">
                  <span className="factor-label">Fréquentation</span>
                  <div className="factor-bar-container">
                    <div 
                      className="factor-bar" 
                      style={{ 
                        width: `${route.safetyFactors.crowdedness * 10}%`,
                        backgroundColor: getSafetyColor(route.safetyFactors.crowdedness)
                      }}
                    ></div>
                  </div>
                </div>
                <div className="safety-factor">
                  <span className="factor-label">Signalements</span>
                  <div className="factor-bar-container">
                    <div 
                      className="factor-bar" 
                      style={{ 
                        width: `${route.safetyFactors.reportDensity * 10}%`,
                        backgroundColor: getSafetyColor(route.safetyFactors.reportDensity)
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
            
            <button className="select-route-button">
              {selectedRouteId === route.id ? 'Sélectionné' : 'Sélectionner cet itinéraire'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RouteList;