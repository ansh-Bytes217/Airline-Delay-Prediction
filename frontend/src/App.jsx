import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useEffect } from 'react';
import Navbar from './components/Navbar';
import FIDSTicker from './components/FIDSTicker';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import RadarPage from './pages/RadarPage';
import AnalyticsPage from './pages/AnalyticsPage';

function ProtectedRoute({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" replace />;
}

function AppLayout({ children, showFIDS = true }) {
  return (
    <>
      <Navbar />
      {showFIDS && <FIDSTicker />}
      <main>{children}</main>
    </>
  );
}

function App() {
  // Register PWA service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/dashboard" element={
        <ProtectedRoute><AppLayout><DashboardPage /></AppLayout></ProtectedRoute>
      } />
      <Route path="/analytics" element={
        <ProtectedRoute><AppLayout><AnalyticsPage /></AppLayout></ProtectedRoute>
      } />
      <Route path="/radar" element={
        <ProtectedRoute><AppLayout showFIDS={false}><RadarPage /></AppLayout></ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
