import React, { useState } from 'react';
import { useUser } from '../../context/UserContext';
import '../../styles/LoginForm.css';

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useUser();

const handleSubmit = async (e) => {
  e.preventDefault();
  setError('');

  // Basic validation
  if (!email || !password) {
    setError('Please enter both email and password');
    return;
  }

  try {
    // Appel à l'API d'authentification
    await login({ email, password });
  } catch (err) {
    // Vérifier que err.message existe, sinon utiliser JSON.stringify ou une valeur par défaut
    const errorMessage = err.message 
      ? err.message 
      : (typeof err === 'object' ? JSON.stringify(err) : 'Invalid email or password');
    
    setError(errorMessage);
    console.error('Login error:', err);
  }
};

  return (
    <div className="login-form-container">
      <h2>Login to SafeWalk</h2>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit} className="login-form">
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />
        </div>
        <button type="submit" className="login-button">Login</button>
      </form>
      <div className="login-footer">
        <p>Don't have an account? <a href="/register">Register</a></p>
        <p><a href="/forgot-password">Forgot password?</a></p>
      </div>
    </div>
  );
};

export default LoginForm;