import React, { createContext, useState, useContext, useEffect } from 'react';
import { userService } from '../services/api';

// Create context
const UserContext = createContext();

// Provider component
export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check for stored token and user data on initial load
  useEffect(() => {
    const checkLoggedInUser = async () => {
      try {
        const storedToken = localStorage.getItem('token');
        
        if (storedToken) {
          setToken(storedToken);
          
          // Try to get user profile with the stored token
          try {
            const { user } = await userService.getProfile();
            setUser(user);
          } catch (profileError) {
            // If getting profile fails, clear the token
            console.error('Error fetching user profile:', profileError);
            localStorage.removeItem('token');
            setToken(null);
          }
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
        setError('Authentication check failed');
      } finally {
        setLoading(false);
      }
    };

    checkLoggedInUser();
  }, []);

// Login function
const login = async (credentials) => {
  try {
    setLoading(true);
    setError(null);
    
    const response = await userService.login(credentials);
    const { user, token } = response;
    
    // Store token and user data
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    
    setUser(user);
    setToken(token);
    
    return user;
  } catch (error) {
    console.error('Login error:', error);
    
    // Améliorer le message d'erreur
    const errorMessage = error.message || 
                         (error.response?.data?.message) || 
                         'Failed to login. Please check your credentials.';
    
    setError(errorMessage);
    throw new Error(errorMessage); // Lancer une vraie Error avec un message
  } finally {
    setLoading(false);
  }
};
  // Register function
  const register = async (userData) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await userService.register(userData);
      const { user, token } = response;
      
      // Store token and user data
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      setUser(user);
      setToken(token);
      
      return user;
    } catch (error) {
      console.error('Registration error:', error);
      setError(error.message || 'Failed to register. Please try again.');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  // Update user profile
  const updateProfile = async (profileData) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await userService.updateProfile(profileData);
      const { user: updatedUser } = response;
      
      // Update stored user data
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      return updatedUser;
    } catch (error) {
      console.error('Update profile error:', error);
      setError(error.message || 'Failed to update profile. Please try again.');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Context value
  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    updateProfile,
    isAuthenticated: !!user
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

// Custom hook to use the user context
export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};