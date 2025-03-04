import React, { useState, useEffect } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow, Polyline } from '@react-google-maps/api';
import { useUser } from '../../context/UserContext';
import ReportForm from './ReportForm';
import '../../styles/Map.css';

const containerStyle = {
  width: '100%',
  height: '500px'
};

const defaultCenter = {
  lat: 43.6166, // Coordonnées de Sophia Antipolis
  lng: 7.0666
};

const Map = ({ selectedRoute, origin, destination }) => {
  const { isAuthenticated } = useUser();
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reports, setReports] = useState([]);
  const [mapCenter, setMapCenter] = useState(defaultCenter);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(userPos);
          setMapCenter(userPos);
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

    // In a real app, we would fetch reports from an API
    // For now, let's use some dummy data
    setReports([
      {
        id: '1',
        location: { lat: 48.8566, lng: 2.3522 },
        category: 'poor_lighting',
        description: 'Street lights not working in this area',
        severity: 4,
        createdAt: new Date()
      },
      {
        id: '2',
        location: { lat: 48.8606, lng: 2.3376 },
        category: 'construction',
        description: 'Sidewalk closed due to construction',
        severity: 3,
        createdAt: new Date()
      }
    ]);
  }, []);

  // Update map center when origin or destination changes
  useEffect(() => {
    if (origin && destination) {
      // Center the map to show both origin and destination
      const centerLat = (origin.lat + destination.lat) / 2;
      const centerLng = (origin.lng + destination.lng) / 2;
      setMapCenter({ lat: centerLat, lng: centerLng });
    } else if (origin) {
      setMapCenter(origin);
    }
  }, [origin, destination]);

  const handleMapClick = (event) => {
    if (isAuthenticated) {
      const clickedLocation = {
        lat: event.latLng.lat(),
        lng: event.latLng.lng()
      };
      setSelectedLocation(clickedLocation);
      setShowReportForm(true);
    }
  };

  const handleReportSubmit = (reportData) => {
    // In a real app, we would send this to an API
    console.log('Report submitted:', reportData);
    
    // Add the new report to our local state
    const newReport = {
      id: Date.now().toString(),
      ...reportData
    };
    
    setReports([...reports, newReport]);
    setShowReportForm(false);
    setSelectedLocation(null);
  };

  const handleReportCancel = () => {
    setShowReportForm(false);
    setSelectedLocation(null);
  };

  const getCategoryIcon = (category) => {
    // In a real app, we would use different icons for different categories
    // For now, let's return a simple object
    return {
      url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
    };
  };

  // Helper function to get safety color
  const getSafetyColor = (score) => {
    if (score >= 8) return '#4caf50'; // Green for safe
    if (score >= 6) return '#ff9800'; // Orange for moderate
    return '#f44336'; // Red for unsafe
  };

  if (loading) {
    return <div className="loading">Loading map...</div>;
  }

  return (
    <div className="map-container">
      {error && <div className="error-message">{error}</div>}
      
      {!isAuthenticated && (
        <div className="map-overlay-message">
          <p>Sign in to report safety issues on the map</p>
        </div>
      )}
      
      <LoadScript googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={mapCenter}
          zoom={14}
          onClick={handleMapClick}
        >
          {/* User location marker */}
          {userLocation && (
            <Marker
              position={userLocation}
              icon={{
                url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
              }}
              title="Your location"
            />
          )}
          
          {/* Origin marker */}
          {origin && (
            <Marker
              position={origin}
              icon={{
                url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
              }}
              title="Starting point"
            />
          )}
          
          {/* Destination marker */}
          {destination && (
            <Marker
              position={destination}
              icon={{
                url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
              }}
              title="Destination"
            />
          )}
          
          {/* Selected route polyline */}
          {selectedRoute && (
            <Polyline
              path={selectedRoute.path}
              options={{
                strokeColor: getSafetyColor(selectedRoute.safetyScore),
                strokeWeight: 5,
                strokeOpacity: 0.8
              }}
            />
          )}
          
          {/* Report markers */}
          {reports.map(report => (
            <Marker
              key={report.id}
              position={report.location}
              icon={getCategoryIcon(report.category)}
              onClick={() => setSelectedLocation(report.location)}
            />
          ))}
          
          {/* Selected location for new report */}
          {selectedLocation && !showReportForm && (
            <InfoWindow
              position={selectedLocation}
              onCloseClick={() => setSelectedLocation(null)}
            >
              <div>
                <h3>Create a Report</h3>
                <p>Click here to report a safety issue at this location.</p>
                <button 
                  onClick={() => setShowReportForm(true)}
                  className="info-window-button"
                >
                  Create Report
                </button>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </LoadScript>
      
      {showReportForm && (
        <div className="report-form-overlay">
          <ReportForm
            location={selectedLocation}
            onSubmit={handleReportSubmit}
            onCancel={handleReportCancel}
          />
        </div>
      )}
    </div>
  );
};

export default Map;