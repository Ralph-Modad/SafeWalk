import React from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import '../../styles/Header.css';

const Header = () => {
  const { isAuthenticated, user, logout } = useUser();

  return (
    <header className="header">
      <div className="logo">
        <Link to="/">SafePath</Link>
      </div>
      <nav className="nav">
        <ul>
          <li><Link to="/">Home</Link></li>
          <li><Link to="/map">Map</Link></li>
          {isAuthenticated ? (
            <>
              <li><Link to="/profile">Profile</Link></li>
              <li><button onClick={logout} className="logout-button">Logout</button></li>
            </>
          ) : (
            <li><Link to="/login">Login</Link></li>
          )}
        </ul>
      </nav>
    </header>
  );
};

export default Header;