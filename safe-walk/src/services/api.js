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
    console.error('API Error:', error.response?.data || error.message);
    
    // Si erreur 401 (non autorisé), effacer le token
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Rediriger vers la page de login si nécessaire
      window.location.href = '/login';
    }
    
    return Promise.reject(error.response?.data || error);
  }
);

// User related API calls
export const userService = {
  login: async (credentials) => {
    return await api.post('/auth/login', credentials);
  },
  
  register: async (userData) => {
    return await api.post('/auth/register', userData);
  },
  
  getProfile: async () => {
    return await api.get('/auth/me');
  },
  
  updateProfile: async (profileData) => {
    return await api.put('/users/profile', profileData);
  },
  
  updatePassword: async (passwordData) => {
    return await api.put('/users/password', passwordData);
  }
};

// Report related API calls
export const reportService = {
  getReports: async (bounds) => {
    return await api.get('/reports', { params: { bounds } });
  },
  
  createReport: async (reportData) => {
    return await api.post('/reports', reportData);
  },
  
  updateReport: async (reportId, reportData) => {
    return await api.put(`/reports/${reportId}`, reportData);
  },
  
  deleteReport: async (reportId) => {
    return await api.delete(`/reports/${reportId}`);
  }
};

// Route related API calls
export const routeService = {
  getRoutes: async (origin, destination, preferences) => {
    return await api.get('/routes', { 
      params: { 
        origin: JSON.stringify(origin), 
        destination: JSON.stringify(destination),
        ...preferences
      } 
    });
  },
  
  getRoute: async (routeId) => {
    return await api.get(`/routes/${routeId}`);
  },
  
  saveFavorite: async (routeId) => {
    return await api.post('/routes/favorites', { routeId });
  },
  
  getFavorites: async () => {
    return await api.get('/routes/favorites');
  },
  
  removeFavorite: async (favoriteId) => {
    return await api.delete(`/routes/favorites/${favoriteId}`);
  }
};

export default api;