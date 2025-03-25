// safe-walk/src/components/map/Map.js
import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, Marker, InfoWindow, Polyline, Circle } from '@react-google-maps/api';
import { useUser } from '../../context/UserContext';
import { reportService } from '../../services/api';
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

const Map = ({ selectedRoute, origin, destination, isLoaded, loadError }) => {
  const { isAuthenticated } = useUser();
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reports, setReports] = useState([]);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedHotspot, setSelectedHotspot] = useState(null);
  const [map, setMap] = useState(null);

  // Afficher les erreurs de chargement
  useEffect(() => {
    if (loadError) {
      setError(`Erreur lors du chargement de Google Maps: ${loadError.message}`);
    }
  }, [loadError]);

  // Référence à la carte Google Maps
  const onMapLoad = useCallback((map) => {
    setMap(map);
  }, []);

  // Obtenir la position de l'utilisateur
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
  }, []);

  // Récupérer les reports dans la zone visible de la carte
  const fetchReports = useCallback(async () => {
    if (!map) return;

    try {
      const bounds = map.getBounds();
      if (!bounds) return;

      const boundsObj = {
        sw: { 
          lat: bounds.getSouthWest().lat(), 
          lng: bounds.getSouthWest().lng() 
        },
        ne: { 
          lat: bounds.getNorthEast().lat(), 
          lng: bounds.getNorthEast().lng() 
        }
      };

      const response = await reportService.getReports(JSON.stringify(boundsObj));
      if (response && response.reports) {
        setReports(response.reports);
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
      // En cas d'erreur, utilisez des données fictives pour la démo
      setReports([
        {
          id: '1',
          location: { lat: 43.6166, lng: 7.0666 },
          category: 'poor_lighting',
          description: 'Éclairage défectueux dans cette zone',
          severity: 4,
          createdAt: new Date()
        },
        {
          id: '2',
          location: { lat: 43.6186, lng: 7.0686 },
          category: 'construction',
          description: 'Trottoir fermé pour travaux',
          severity: 3,
          createdAt: new Date()
        }
      ]);
    }
  }, [map]);

  // Mettre à jour les reports quand la carte bouge
  useEffect(() => {
    if (!map || !isLoaded) return;

    const listener = map.addListener('idle', fetchReports);
    fetchReports(); // Charger les reports initiaux

    return () => {
      // On vérifie que window.google existe avant d'y accéder
      if (window && window.google && window.google.maps) {
        window.google.maps.event.removeListener(listener);
      }
    };
  }, [map, fetchReports, isLoaded]);

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

  const handleReportSubmit = async (reportData) => {
    try {
      // Envoyer le rapport au backend
      const response = await reportService.createReport(reportData);
      
      if (response && response.report) {
        // Ajouter le nouveau rapport à la liste
        setReports(prev => [...prev, response.report]);
      }
      
      setShowReportForm(false);
      setSelectedLocation(null);
    } catch (err) {
      console.error('Error submitting report:', err);
      alert('Failed to submit report. Please try again.');
    }
  };

  const handleReportCancel = () => {
    setShowReportForm(false);
    setSelectedLocation(null);
  };

  const getCategoryIcon = (category) => {
    // Utiliser des icônes différentes selon la catégorie
    switch (category) {
      case 'poor_lighting':
        return { url: 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png' };
      case 'unsafe_area':
        return { url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png' };
      case 'construction':
        return { url: 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png' };
      case 'obstacle':
        return { url: 'https://maps.google.com/mapfiles/ms/icons/purple-dot.png' };
      case 'bad_weather':
        return { url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png' };
      default:
        return { url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png' };
    }
  };

  // Helper function to get safety color
  const getSafetyColor = (score) => {
    if (score >= 8) return '#4caf50'; // Green for safe
    if (score >= 6) return '#ff9800'; // Orange for moderate
    return '#f44336'; // Red for unsafe
  };

  // Helper function to get hotspot color
  const getHotspotColor = (hotspot) => {
    // Déterminer la couleur en fonction de la catégorie du hotspot
    if (!hotspot.categories || hotspot.categories.length === 0) {
      return '#ff4444'; // Rouge par défaut
    }
    
    const category = hotspot.categories[0];
    switch (category) {
      case 'poor_lighting':
        return '#F9A825'; // Jaune foncé
      case 'unsafe_area':
        return '#D32F2F'; // Rouge foncé
      case 'construction':
        return '#F57C00'; // Orange foncé
      case 'obstacle':
        return '#7B1FA2'; // Violet
      case 'bad_weather':
        return '#1976D2'; // Bleu foncé
      default:
        return '#ff4444'; // Rouge par défaut
    }
  };

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

  if (loading || !isLoaded) {
    return <div className="loading">Chargement de la carte...</div>;
  }

  return (
    <div className="map-container">
      {error && <div className="error-message">{error}</div>}
      
      {!isAuthenticated && (
        <div className="map-overlay-message">
          <p>Connectez-vous pour signaler des problèmes de sécurité sur la carte</p>
        </div>
      )}
      
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={mapCenter}
        zoom={14}
        onClick={handleMapClick}
        onLoad={onMapLoad}
      >
        {/* User location marker */}
        {userLocation && (
          <Marker
            position={userLocation}
            icon={{
              url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
            }}
            title="Votre position"
          />
        )}
        
        {/* Origin marker */}
        {origin && (
          <Marker
            position={origin}
            icon={{
              url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
            }}
            title="Point de départ"
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
              strokeOpacity: 0.8,
              geodesic: false

            }}
          />
        )}

        {/* Visualisation des hotspots sur le trajet sélectionné */}
        {selectedRoute && selectedRoute.hotspots && selectedRoute.hotspots.map((hotspot, index) => (
          <Circle
            key={`hotspot-${index}`}
            center={hotspot.center}
            radius={hotspot.size * 50} // Taille du cercle basée sur la taille du hotspot (en mètres)
            options={{
              fillColor: getHotspotColor(hotspot),
              fillOpacity: 0.3,
              strokeColor: getHotspotColor(hotspot),
              strokeOpacity: 0.8,
              strokeWeight: 2,
              clickable: true
            }}
            onClick={() => setSelectedHotspot(hotspot)}
          />
        ))}

        {/* InfoWindow pour le hotspot sélectionné */}
        {selectedHotspot && (
          <InfoWindow
            position={selectedHotspot.center}
            onCloseClick={() => setSelectedHotspot(null)}
          >
            <div className="hotspot-info-window">
              <h3>Zone à risque</h3>
              <p>
                <strong>Catégories:</strong> {selectedHotspot.categories.map(getCategoryLabel).join(', ')}
              </p>
              {selectedHotspot.onPath && (
                <p className="on-path-warning">
                  Cette zone est directement sur votre chemin
                </p>
              )}
            </div>
          </InfoWindow>
        )}
        
        {/* Report markers */}
        {reports.map(report => (
          <Marker
            key={report.id}
            position={report.location}
            icon={getCategoryIcon(report.category)}
            onClick={() => setSelectedReport(report)}
          />
        ))}
        
        {/* Selected report info window */}
        {selectedReport && (
          <InfoWindow
            position={selectedReport.location}
            onCloseClick={() => setSelectedReport(null)}
          >
            <div className="report-info-window">
              <h3>{getCategoryLabel(selectedReport.category)}</h3>
              <p><strong>Sévérité:</strong> {selectedReport.severity}/5</p>
              <p><strong>Description:</strong> {selectedReport.description || 'Aucune description'}</p>
              <p><strong>Date:</strong> {new Date(selectedReport.createdAt).toLocaleDateString()}</p>
            </div>
          </InfoWindow>
        )}
        
        {/* Selected location for new report */}
        {selectedLocation && !showReportForm && (
          <InfoWindow
            position={selectedLocation}
            onCloseClick={() => setSelectedLocation(null)}
          >
            <div>
              <h3>Créer un signalement</h3>
              <p>Cliquez ici pour signaler un problème de sécurité à cet endroit.</p>
              <button 
                onClick={() => setShowReportForm(true)}
                className="info-window-button"
              >
                Créer un signalement
              </button>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
      
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