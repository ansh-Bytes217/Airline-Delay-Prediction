import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AuthPage() {
  const [tab, setTab] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, signup, loginWithGoogle, loginAsGuest } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'login') {
        await login(email, password);
      } else {
        if (!displayName.trim()) {
          setError('Please enter your name.');
          setLoading(false);
          return;
        }
        await signup(email, password, displayName);
      }
      navigate('/dashboard');
    } catch (err) {
      const msg = err.code?.replace('auth/', '').replace(/-/g, ' ') || 'Authentication failed.';
      setError(msg.charAt(0).toUpperCase() + msg.slice(1) + '.');
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
      navigate('/dashboard');
    } catch (err) {
      setError('Google sign-in failed. Please try again.');
    }
    setLoading(false);
  };

  const handleGuest = async () => {
    setError('');
    setLoading(true);
    try {
      await loginAsGuest();
      navigate('/dashboard');
    } catch (err) {
      setError('Guest login failed.');
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="hero-orb orb-1"></div>
        <div className="hero-orb orb-2"></div>
      </div>

      <div className="auth-card">
        {/* Brand */}
        <Link to="/" className="auth-brand">
          <span className="brand-icon">✈</span>
          <span className="brand-text">Sky<span className="brand-accent">Predict</span></span>
        </Link>
        <p className="auth-tagline">Flight intelligence powered by AI</p>

        {/* Tabs */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => { setTab('login'); setError(''); }}
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${tab === 'signup' ? 'active' : ''}`}
            onClick={() => { setTab('signup'); setError(''); }}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          {tab === 'signup' && (
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                placeholder="Ansh Kumar"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
          )}
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <div className="auth-error">⚠️ {error}</div>}

          <button type="submit" className="btn-auth-submit" disabled={loading}>
            {loading ? 'Please wait...' : tab === 'login' ? 'Sign In →' : 'Create Account →'}
          </button>
        </form>

        <div className="auth-divider"><span>or continue with</span></div>

        <button className="btn-google" onClick={handleGoogle} disabled={loading}>
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.1 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.3 1 7.2 2.7l5.7-5.7C33.7 7.5 29.1 5.5 24 5.5 13.2 5.5 4.5 14.2 4.5 25S13.2 44.5 24 44.5 43.5 35.8 43.5 25c0-1.6-.2-3.2-.5-4.7l.6-.2z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.8 18.9 13 24 13c2.8 0 5.3 1 7.2 2.7l5.7-5.7C33.7 7.5 29.1 5.5 24 5.5c-7.5 0-14 4.3-17.7 9.2z"/>
            <path fill="#4CAF50" d="M24 44.5c5 0 9.5-1.9 13-5l-6-5.1c-1.9 1.4-4.3 2.2-7 2.2-5.2 0-9.6-2.9-11.3-7.1l-6.6 5.1C7 40 15 44.5 24 44.5z"/>
            <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.4 4.3-4.3 5.8l6 5.1c-.4.4 6.5-4.7 6.5-13.9 0-1.6-.2-3.2-.5-4.7l.6-.2z"/>
          </svg>
          Continue with Google
        </button>

        <button className="btn-guest-login" onClick={handleGuest} disabled={loading} style={{
          width: '100%',
          marginTop: '0.8rem',
          padding: '0.8rem',
          background: 'rgba(99, 102, 241, 0.1)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: '12px',
          color: '#a78bfa',
          fontWeight: '500',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          transition: 'all 0.2s',
        }}>
          ✈ Enter as Guest / Demo Mode
        </button>
      </div>
    </div>
  );
}

// Refactor hooks and states
