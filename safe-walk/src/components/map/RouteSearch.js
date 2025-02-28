import React, { useState } from 'react';
import { routeService } from '../../services/api';
import { useUser } from '../../context/UserContext';
import '../../styles/RouteSearch.css';

const RouteSearch = ({ onRoutesFound }) => {
  const { user } = useUser();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [useCurrentLocation, setUseCurrentLocation] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!destination) {
      setError('Please enter a destination');
      return;
    }

    try {
      setLoading(true);

      // In a real app, we would geocode the addresses to get coordinates
      // For now, we'll use dummy coordinates
      const originCoords = useCurrentLocation 
        ? await getCurrentLocation()
        : { lat: 48.8566, lng: 2.3522 }; // Paris coordinates as fallback
      
      const destinationCoords = { lat: 48.8606, lng: 2.3376 }; // Dummy destination near Paris

      // Get user preferences if available
      const preferences = user?.preferences || {
        prioritizeLight: true,
        avoidIsolatedAreas: true
      };

      // Get routes from API
      const { routes } = await routeService.getRoutes(
        originCoords,
        destinationCoords,
        preferences
      );

      // Pass routes to parent component
      onRoutesFound(routes, originCoords, destinationCoords);
    } catch (err) {
      console.error('Error searching for routes:', err);
      setError('Failed to find routes. Please try again.');
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
            console.error('Error getting current location:', error);
            reject(new Error('Unable to get your current location. Please enter an origin address.'));
          }
        );
      } else {
        reject(new Error('Geolocation is not supported by your browser. Please enter an origin address.'));
      }
    });
  };

  return (
    <div className="route-search-container">
      <h2>Find a Safe Route</h2>
      {error && <div className="error-message">{error}</div>}
      
      <form onSubmit={handleSubmit} className="route-search-form">
        <div className="form-group">
          <label htmlFor="origin">Starting Point</label>
          <div className="origin-input-group">
            <input
              type="text"
              id="origin"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="Enter starting address"
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
              <label htmlFor="useCurrentLocation">Use my current location</label>
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
            placeholder="Enter destination address"
            required
          />
        </div>
        
        <button 
          type="submit" 
          className="search-button"
          disabled={loading}
        >
          {loading ? 'Searching...' : 'Find Safe Routes'}
        </button>
      </form>
    </div>
  );
};

export default RouteSearch;