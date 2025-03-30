import React from 'react';
import { Navigate } from 'react-router-dom';
import LoginForm from '../components/common/LoginForm';
import { useUser } from '../context/UserContext';

const LoginPage = () => {
  const { isAuthenticated } = useUser();

  // Redirect if already logged in
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="login-page">
      <h1>Welcome to SafePath</h1>
      <p>Login to access safe navigation features</p>
      <LoginForm />
    </div>
  );
};

export default LoginPage;