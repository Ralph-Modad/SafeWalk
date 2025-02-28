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

// User related API calls
export const userService = {
  login: async (credentials) => {
    try {
      // In a real app, this would call the actual API
      // For now, we'll simulate a successful response
      console.log('Login attempt with:', credentials);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mock successful response
      return {
        user: {
          id: '1',
          email: credentials.email,
          name: credentials.email.split('@')[0],
          preferences: {
            prioritizeLight: true,
            avoidIsolatedAreas: true
          }
        },
        token: 'mock-jwt-token'
      };
      
      // In a real app, we would do:
      // return await api.post('/auth/login', credentials);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },
  
  register: async (userData) => {
    try {
      // Simulate API call
      console.log('Register attempt with:', userData);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mock successful response
      return {
        user: {
          id: '1',
          email: userData.email,
          name: userData.name,
          preferences: {
            prioritizeLight: true,
            avoidIsolatedAreas: true
          }
        },
        token: 'mock-jwt-token'
      };
      
      // In a real app:
      // return await api.post('/auth/register', userData);
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  },
  
  getProfile: async () => {
    try {
      // In a real app:
      // return await api.get('/users/profile');
      
      // Mock response
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        return { user: JSON.parse(storedUser) };
      }
      throw new Error('User not found');
    } catch (error) {
      console.error('Get profile error:', error);
      throw error;
    }
  },
  
  updateProfile: async (profileData) => {
    try {
      // In a real app:
      // return await api.put('/users/profile', profileData);
      
      // Mock response
      console.log('Update profile with:', profileData);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        const updatedUser = { ...user, ...profileData };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        return { user: updatedUser };
      }
      throw new Error('User not found');
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  }
};

// Report related API calls
export const reportService = {
  getReports: async (bounds) => {
    try {
      // In a real app:
      // return await api.get('/reports', { params: bounds });
      
      // Mock response
      console.log('Fetching reports within bounds:', bounds);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Return some dummy data
      return {
        reports: [
          {
            id: '1',
            location: { lat: 48.8566, lng: 2.3522 },
            category: 'poor_lighting',
            description: 'Street lights not working in this area',
            severity: 4,
            createdAt: new Date().toISOString()
          },
          {
            id: '2',
            location: { lat: 48.8606, lng: 2.3376 },
            category: 'construction',
            description: 'Sidewalk closed due to construction',
            severity: 3,
            createdAt: new Date().toISOString()
          }
        ]
      };
    } catch (error) {
      console.error('Get reports error:', error);
      throw error;
    }
  },
  
  createReport: async (reportData) => {
    try {
      // In a real app:
      // return await api.post('/reports', reportData);
      
      // Mock response
      console.log('Creating report:', reportData);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return {
        report: {
          id: Date.now().toString(),
          ...reportData,
          createdAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Create report error:', error);
      throw error;
    }
  },
  
  updateReport: async (reportId, reportData) => {
    try {
      // In a real app:
      // return await api.put(`/reports/${reportId}`, reportData);
      
      // Mock response
      console.log(`Updating report ${reportId}:`, reportData);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return {
        report: {
          id: reportId,
          ...reportData,
          updatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Update report error:', error);
      throw error;
    }
  },
  
  deleteReport: async (reportId) => {
    try {
      // In a real app:
      // return await api.delete(`/reports/${reportId}`);
      
      // Mock response
      console.log(`Deleting report ${reportId}`);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return { success: true };
    } catch (error) {
      console.error('Delete report error:', error);
      throw error;
    }
  }
};

// Route related API calls
export const routeService = {
  getRoutes: async (origin, destination, preferences) => {
    try {
      // In a real app:
      // return await api.get('/routes', { params: { origin, destination, ...preferences } });
      
      // Mock response
      console.log('Getting routes from', origin, 'to', destination, 'with preferences:', preferences);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Return some dummy routes
      return {
        routes: [
          {
            id: '1',
            name: 'Safest Route',
            safetyScore: 9.2,
            duration: 15, // minutes
            distance: 1.2, // km
            path: [
              { lat: origin.lat, lng: origin.lng },
              { lat: origin.lat + 0.002, lng: origin.lng + 0.001 },
              { lat: origin.lat + 0.003, lng: origin.lng + 0.003 },
              { lat: destination.lat, lng: destination.lng }
            ]
          },
          {
            id: '2',
            name: 'Fastest Route',
            safetyScore: 7.5,
            duration: 12, // minutes
            distance: 1.0, // km
            path: [
              { lat: origin.lat, lng: origin.lng },
              { lat: origin.lat + 0.001, lng: origin.lng + 0.002 },
              { lat: destination.lat, lng: destination.lng }
            ]
          },
          {
            id: '3',
            name: 'Alternative Route',
            safetyScore: 8.3,
            duration: 14, // minutes
            distance: 1.1, // km
            path: [
              { lat: origin.lat, lng: origin.lng },
              { lat: origin.lat - 0.001, lng: origin.lng + 0.001 },
              { lat: origin.lat - 0.002, lng: origin.lng + 0.003 },
              { lat: destination.lat, lng: destination.lng }
            ]
          }
        ]
      };
    } catch (error) {
      console.error('Get routes error:', error);
      throw error;
    }
  }
};

export default api;