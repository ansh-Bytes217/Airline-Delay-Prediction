import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      <Link to={currentUser ? '/dashboard' : '/'} className="navbar-brand">
        <span className="brand-icon">✈</span>
        <span className="brand-text">Sky<span className="brand-accent">Predict</span></span>
      </Link>

      {currentUser && (
        <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
          <Link to="/dashboard" className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
            🎯 Dashboard
          </Link>
          <Link to="/analytics" className={`nav-link ${isActive('/analytics') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
            📊 Analytics
          </Link>
          <Link to="/radar" className={`nav-link ${isActive('/radar') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
            🛰️ Radar
          </Link>
        </div>
      )}

      <div className="navbar-actions">
        {currentUser ? (
          <div className="user-menu">
            <NotificationBell />
            <div className="user-avatar" title={currentUser.displayName || currentUser.email}>
              {(currentUser.displayName || currentUser.email || '?')[0].toUpperCase()}
            </div>
            <span className="user-name">{currentUser.displayName || currentUser.email?.split('@')[0]}</span>
            <button className="btn-logout" onClick={handleLogout}>Logout</button>
          </div>
        ) : (
          <Link to="/login" className="btn-primary-sm">Sign In</Link>
        )}
        <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
          <span></span><span></span><span></span>
        </button>
      </div>
    </nav>
  );
}
