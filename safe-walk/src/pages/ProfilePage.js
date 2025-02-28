import React from 'react';
import { Navigate } from 'react-router-dom';
import ProfileForm from '../components/common/ProfileForm';
import { useUser } from '../context/UserContext';

const ProfilePage = () => {
  const { isAuthenticated, loading } = useUser();

  // Show loading state
  if (loading) {
    return <div className="loading-container">Loading profile...</div>;
  }

  // Redirect if not logged in
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="profile-page">
      <h1>Your Profile</h1>
      <p>Manage your account information and preferences</p>
      <ProfileForm />
    </div>
  );
};

export default ProfilePage;