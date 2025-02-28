import React from 'react';
import { Navigate } from 'react-router-dom';
import RegisterForm from '../components/common/RegisterForm';
import { useUser } from '../context/UserContext';

const RegisterPage = () => {
  const { isAuthenticated } = useUser();

  // Redirect if already logged in
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="register-page">
      <h1>Join SafeWalk</h1>
      <p>Create an account to access all features</p>
      <RegisterForm />
    </div>
  );
};

export default RegisterPage;