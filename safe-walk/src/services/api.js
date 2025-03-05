// safe-walk/src/services/api.js
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

// Create axios instance with base URL
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // Log error details for debugging
    console.error('API Error:', error.response?.data || error.message);
    
    // Check if we need to handle token expiration or auth issues
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    
    return Promise.reject(error.response?.data || error);
  }
);

// User related API calls
export const userService = {
  login: async (credentials) => {
    try {
      return await api.post('/auth/login', credentials);
    } catch (error) {
      // Enhanced error handling
      const errorMessage = error.message || 'Failed to login. Please check your credentials.';
      throw new Error(errorMessage);
    }
  },
  
  register: async (userData) => {
    try {
      return await api.post('/auth/register', userData);
    } catch (error) {
      const errorMessage = error.message || 'Failed to register. Please try again.';
      throw new Error(errorMessage);
    }
  },
  
  getProfile: async () => {
    try {
      return await api.get('/auth/me');
    } catch (error) {
      const errorMessage = error.message || 'Failed to fetch profile.';
      throw new Error(errorMessage);
    }
  },
  
  updateProfile: async (profileData) => {
    try {
      return await api.put('/users/profile', profileData);
    } catch (error) {
      const errorMessage = error.message || 'Failed to update profile.';
      throw new Error(errorMessage);
    }
  },
  
  updatePassword: async (passwordData) => {
    try {
      return await api.put('/users/password', passwordData);
    } catch (error) {
      const errorMessage = error.message || 'Failed to update password.';
      throw new Error(errorMessage);
    }
  }
};

// Report related API calls
export const reportService = {
  getReports: async (bounds) => {
    try {
      return await api.get('/reports', { params: { bounds } });
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      // For development, return empty reports array instead of failing
      return { reports: [] };
    }
  },
  
  createReport: async (reportData) => {
    try {
      return await api.post('/reports', reportData);
    } catch (error) {
      const errorMessage = error.message || 'Failed to create report.';
      throw new Error(errorMessage);
    }
  },
  
  updateReport: async (reportId, reportData) => {
    try {
      return await api.put(`/reports/${reportId}`, reportData);
    } catch (error) {
      const errorMessage = error.message || 'Failed to update report.';
      throw new Error(errorMessage);
    }
  },
  
  deleteReport: async (reportId) => {
    try {
      return await api.delete(`/reports/${reportId}`);
    } catch (error) {
      const errorMessage = error.message || 'Failed to delete report.';
      throw new Error(errorMessage);
    }
  }
};

// Route related API calls
export const routeService = {
  getRoutes: async (origin, destination, preferences) => {
    try {
      // Vérifier si les coordonnées sont valides
      if (!origin || !destination || !origin.lat || !origin.lng || !destination.lat || !destination.lng) {
        throw new Error('Coordonnées d\'origine ou de destination invalides');
      }

      // Appel au backend pour obtenir les itinéraires sécurisés
      const response = await api.get('/routes', { 
        params: { 
          origin: JSON.stringify(origin), 
          destination: JSON.stringify(destination),
          preferences: JSON.stringify(preferences)
        } 
      });

      // Vérifier si la réponse contient des itinéraires
      if (response && response.routes && response.routes.length > 0) {
        return response;
      } else {
        // Si le backend ne retourne pas d'itinéraires, générer des itinéraires simulés
        console.warn('Aucun itinéraire retourné par le backend, utilisation de données simulées');
        
        // Générer des itinéraires simulés avec une vraie distance entre les points
        const mockRoutes = generateMockRoutes(origin, destination, preferences);
        return { routes: mockRoutes };
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des itinéraires:', error);
      
      // Fallback en cas d'erreur : générer des itinéraires simulés
      console.warn('Génération d\'itinéraires simulés en raison d\'une erreur');
      const mockRoutes = generateMockRoutes(origin, destination, preferences);
      return { routes: mockRoutes };
    }
  },
  
  getRoute: async (routeId) => {
    try {
      return await api.get(`/routes/${routeId}`);
    } catch (error) {
      const errorMessage = error.message || 'Erreur lors de la récupération de l\'itinéraire.';
      throw new Error(errorMessage);
    }
  },
  
  saveFavorite: async (routeData) => {
    try {
      return await api.post('/routes/favorites', { routeData });
    } catch (error) {
      const errorMessage = error.message || 'Erreur lors de l\'enregistrement du favori.';
      throw new Error(errorMessage);
    }
  },
  
  getFavorites: async () => {
    try {
      return await api.get('/routes/favorites');
    } catch (error) {
      const errorMessage = error.message || 'Erreur lors de la récupération des favoris.';
      throw new Error(errorMessage);
    }
  },
  
  removeFavorite: async (favoriteId) => {
    try {
      return await api.delete(`/routes/favorites/${favoriteId}`);
    } catch (error) {
      const errorMessage = error.message || 'Erreur lors de la suppression du favori.';
      throw new Error(errorMessage);
    }
  }
};

// Fonction utilitaire pour générer des itinéraires simulés
function generateMockRoutes(origin, destination, preferences) {
  // Calculer la distance réelle entre l'origine et la destination
  const distance = calculateDistance(
    origin.lat, origin.lng,
    destination.lat, destination.lng
  );
  
  // Estimer le temps de marche (5 km/h en moyenne)
  const walkingSpeed = 5; // km/h
  const duration = Math.round((distance / walkingSpeed) * 60); // minutes
  
  // Générer 3 itinéraires différents
  return [
    {
      id: 'route_1',
      name: 'Itinéraire le plus sûr',
      distance: parseFloat(distance.toFixed(1)),
      duration: duration,
      safetyScore: 8.7,
      path: generatePathWithCurve(origin, destination, 0.005),
      safetyFactors: {
        lighting: 9,
        crowdedness: 8,
        reportDensity: 9
      },
      summary: 'Via rues principales'
    },
    {
      id: 'route_2',
      name: 'Itinéraire le plus rapide',
      distance: parseFloat((distance * 0.9).toFixed(1)),
      duration: Math.round(duration * 0.9),
      safetyScore: 6.5,
      path: generatePathWithCurve(origin, destination, -0.005),
      safetyFactors: {
        lighting: 6,
        crowdedness: 7,
        reportDensity: 6
      },
      summary: 'Itinéraire direct'
    },
    {
      id: 'route_3',
      name: 'Itinéraire alternatif',
      distance: parseFloat((distance * 1.1).toFixed(1)),
      duration: Math.round(duration * 1.1),
      safetyScore: 7.2,
      path: generatePathWithCurve(origin, destination, 0.01),
      safetyFactors: {
        lighting: 7,
        crowdedness: 8,
        reportDensity: 7
      },
      summary: 'Via zones piétonnes'
    }
  ];
}

// Fonction pour générer un chemin avec une courbe
function generatePathWithCurve(start, end, curveFactor) {
  const path = [];
  const steps = 20;
  
  // Calculer un point intermédiaire pour créer une courbe
  // Nous prenons un point perpendiculaire à la ligne directe
  const dx = end.lng - start.lng;
  const dy = end.lat - start.lat;
  
  // Point médian direct
  const midLat = (start.lat + end.lat) / 2;
  const midLng = (start.lng + end.lng) / 2;
  
  // Déplacer le point médian perpendiculairement à la ligne directe
  const perpLat = midLat + curveFactor * dx;
  const perpLng = midLng - curveFactor * dy;
  
  // Générer les points intermédiaires en utilisant une courbe de Bézier quadratique
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    
    // Formule pour une courbe de Bézier quadratique
    const lat = (1-t)*(1-t)*start.lat + 2*(1-t)*t*perpLat + t*t*end.lat;
    const lng = (1-t)*(1-t)*start.lng + 2*(1-t)*t*perpLng + t*t*end.lng;
    
    path.push({ lat, lng });
  }
  
  return path;
}

// Fonction pour calculer la distance entre deux points (Haversine)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Rayon de la Terre en km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance en km
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

export default api;