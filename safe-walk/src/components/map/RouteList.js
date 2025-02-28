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

  return (
    <div className="route-list-container">
      <h2>Available Routes</h2>
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
              >
                {route.safetyScore.toFixed(1)}
              </div>
            </div>
            
            <div className="route-details">
              <div className="detail-item">
                <span className="detail-label">Distance:</span>
                <span className="detail-value">{route.distance} km</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Duration:</span>
                <span className="detail-value">{route.duration} min</span>
              </div>
            </div>
            
            <div className="safety-bar-container">
              <div className="safety-bar-label">Safety</div>
              <div className="safety-bar">
              <div 
                  className="safety-bar-fill"
                  style={{ 
                    width: `${route.safetyScore * 10}%`,
                    backgroundColor: getSafetyColor(route.safetyScore)
                  }}
                ></div>
              </div>
            </div>
            
            <button className="select-route-button">
              {selectedRouteId === route.id ? 'Selected' : 'Select Route'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RouteList;
                    