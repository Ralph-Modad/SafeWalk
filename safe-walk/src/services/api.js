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
      throw new Error('Failed to fetch safety reports');
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

      return response;
    } catch (error) {
      console.error('Erreur lors de la récupération des itinéraires:', error);
      throw error;
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

export default api;