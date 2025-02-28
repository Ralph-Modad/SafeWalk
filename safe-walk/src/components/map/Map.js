import React, { useState, useEffect } from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import '../../styles/Map.css';

const containerStyle = {
  width: '100%',
  height: '500px'
};

const defaultCenter = {
  lat: 48.8566, // Paris coordinates as default
  lng: 2.3522
};

const Map = () => {
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setLoading(false);
        },
        (error) => {
          console.error('Error getting user location:', error);
          setError('Unable to retrieve your location. Using default location.');
          setLoading(false);
        }
      );
    } else {
      setError('Geolocation is not supported by your browser. Using default location.');
      setLoading(false);
    }
  }, []);

  if (loading) {
    return <div className="loading">Loading map...</div>;
  }

  return (
    <div className="map-container">
      {error && <div className="error-message">{error}</div>}
      <LoadScript googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={userLocation || defaultCenter}
          zoom={14}
        >
          {userLocation && (
            <Marker
              position={userLocation}
              title="Your location"
            />
          )}
        </GoogleMap>
      </LoadScript>
    </div>
  );
};

export default Map;