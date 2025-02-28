import React, { useState, useEffect } from 'react';
import { useUser } from '../../context/UserContext';
import '../../styles/ProfileForm.css';

const ProfileForm = () => {
  const { user, updateProfile, error: userError } = useUser();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [preferences, setPreferences] = useState({
    prioritizeLight: false,
    avoidIsolatedAreas: false,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load user data when component mounts
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setPreferences({
        prioritizeLight: user.preferences?.prioritizeLight || false,
        avoidIsolatedAreas: user.preferences?.avoidIsolatedAreas || false,
      });
    }
  }, [user]);

  const handlePreferenceChange = (e) => {
    const { name, checked } = e.target;
    setPreferences(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Basic validation
    if (!name) {
      setError('Name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      await updateProfile({
        name,
        preferences
      });
      setSuccess('Profile updated successfully');
    } catch (err) {
      setError(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return <div className="profile-form-container">Loading profile...</div>;
  }

  return (
    <div className="profile-form-container">
      <h2>Your Profile</h2>
      {error && <div className="error-message">{error}</div>}
      {userError && <div className="error-message">{userError}</div>}
      {success && <div className="success-message">{success}</div>}
      
      <form onSubmit={handleSubmit} className="profile-form">
        <div className="form-group">
          <label htmlFor="name">Full Name</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            disabled
            className="disabled-input"
          />
          <small>Email cannot be changed</small>
        </div>
        
        <div className="form-section">
          <h3>Safety Preferences</h3>
          <p>These preferences will be used to customize your route suggestions.</p>
          
          <div className="form-group checkbox-group">
            <input
              type="checkbox"
              id="prioritizeLight"
              name="prioritizeLight"
              checked={preferences.prioritizeLight}
              onChange={handlePreferenceChange}
            />
            <label htmlFor="prioritizeLight">
              Prioritize well-lit areas
            </label>
          </div>
          
          <div className="form-group checkbox-group">
            <input
              type="checkbox"
              id="avoidIsolatedAreas"
              name="avoidIsolatedAreas"
              checked={preferences.avoidIsolatedAreas}
              onChange={handlePreferenceChange}
            />
            <label htmlFor="avoidIsolatedAreas">
              Avoid isolated areas
            </label>
          </div>
        </div>
        
        <button 
          type="submit" 
          className="update-button"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Updating...' : 'Update Profile'}
        </button>
      </form>
    </div>
  );
};

export default ProfileForm;