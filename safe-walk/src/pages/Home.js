import React from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import '../styles/Home.css';

const Home = () => {
  const { isAuthenticated, user } = useUser();

  return (
    <div className="home-container">
      <section className="hero">
        <h1>SafePath</h1>
        <p className="tagline">Navigate your city with confidence and safety</p>
        
        {isAuthenticated ? (
          <div className="welcome-user">
            <p>Welcome back, {user.name}!</p>
            <div className="action-buttons">
              <Link to="/map" className="btn btn-primary">Explore Map</Link>
              <Link to="/profile" className="btn btn-secondary">View Profile</Link>
            </div>
          </div>
        ) : (
          <div className="action-buttons">
            <Link to="/login" className="btn btn-primary">Login</Link>
            <Link to="/register" className="btn btn-secondary">Sign Up</Link>
          </div>
        )}
      </section>

      <section className="features">
        <h2>Why Choose SafePath?</h2>
        
        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon">🔍</div>
            <h3>Community-Powered Safety</h3>
            <p>Real-time safety information shared by our community of users.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🛣️</div>
            <h3>Smart Route Planning</h3>
            <p>Get route suggestions that prioritize safety over just speed.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🔔</div>
            <h3>Safety Alerts</h3>
            <p>Receive notifications about safety concerns along your route.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">👥</div>
            <h3>Trusted Community</h3>
            <p>Join thousands of users helping each other navigate safely.</p>
          </div>
        </div>
      </section>

      <section className="how-it-works">
        <h2>How SafePath Works</h2>
        
        <div className="steps">
          <div className="step">
            <div className="step-number">1</div>
            <h3>Create an Account</h3>
            <p>Sign up to access all SafePath features and join our community.</p>
          </div>
          
          <div className="step">
            <div className="step-number">2</div>
            <h3>Set Your Preferences</h3>
            <p>Tell us what matters most to you when navigating the city.</p>
          </div>
          
          <div className="step">
            <div className="step-number">3</div>
            <h3>Explore Safe Routes</h3>
            <p>Get personalized route suggestions based on community safety data.</p>
          </div>
          
          <div className="step">
            <div className="step-number">4</div>
            <h3>Contribute</h3>
            <p>Report safety concerns to help others in the community.</p>
          </div>
        </div>
      </section>

      <section className="cta">
        <h2>Ready to Walk Safer?</h2>
        <p>Join SafePath today and experience a new way to navigate your city.</p>
        <Link to="/register" className="btn btn-large">Get Started</Link>
      </section>
    </div>
  );
};

export default Home;