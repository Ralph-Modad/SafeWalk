import React from 'react';
import Map from '../components/map/Map';

const MapPage = () => {
  return (
    <div className="map-page">
      <h1>SafeWalk Map</h1>
      <p>Explore safe routes in your area</p>
      <Map />
    </div>
  );
};

export default MapPage;