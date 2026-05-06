import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useRef } from 'react';
import ThreeGlobe from '../components/ThreeGlobe';


const FEATURES = [
  {
    icon: '🧠',
    title: 'Ensemble ML Prediction',
    desc: 'XGBoost + CatBoost ensemble trained on 500K+ real flights. State-of-the-art accuracy with SMOTE for class balance.',
  },
  {
    icon: '🔍',
    title: 'Explainable AI (SHAP)',
    desc: 'Every prediction comes with a visual breakdown showing exactly which factors drove the model\'s decision.',
  },
  {
    icon: '🛰️',
    title: 'Live Flight Radar',
    desc: 'Real-time aircraft positions from OpenSky Network. Click any plane to see live altitude, speed, and heading.',
  },
  {
    icon: '🤖',
    title: 'RAG AI Chatbot',
    desc: 'Ask questions about airline policies & FAA regulations. Powered by LangChain + FAISS vector search + local LLM.',
  },
  {
    icon: '📡',
    title: 'Live FIDS Ticker',
    desc: 'Live Flight Information Display showing real-time flights across the US, just like an airport departures board.',
  },
  {
    icon: '🔐',
    title: 'Secure Auth',
    desc: 'Firebase Authentication with Email/Password and Google Sign-In. Your data, your account, always private.',
  },
];

const STATS = [
  { value: '500K+', label: 'Flights Analyzed' },
  { value: '94%', label: 'Model Accuracy' },
  { value: '15+', label: 'Airlines Covered' },
  { value: '6', label: 'AI Features' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const featuresRef = useRef(null);

  useEffect(() => {
    if (currentUser) navigate('/dashboard');
  }, [currentUser, navigate]);

  const scrollToFeatures = () => {
    featuresRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="landing">
      {/* Hero */}
      <section className="hero">
        <div className="hero-bg">
          <div className="hero-orb orb-1"></div>
          <div className="hero-orb orb-2"></div>
          <div className="hero-orb orb-3"></div>
        </div>
        <div className="hero-content">
          <div className="hero-badge">✈ Powered by Ensemble ML + Generative AI</div>
          <h1 className="hero-title">
            Predict Flight Delays<br />
            <span className="gradient-text">Before They Happen</span>
          </h1>
          <p className="hero-subtitle">
            SkyPredict combines advanced ensemble machine learning, SHAP explainability,
            live flight radar, and a RAG-powered AI chatbot into one seamless platform.
          </p>
          <div className="hero-cta">
            <button className="btn-hero-primary" onClick={() => navigate('/login')}>
              Get Started Free →
            </button>
            <button className="btn-hero-secondary" onClick={scrollToFeatures}>
              See Features ↓
            </button>
          </div>
          <div className="hero-tech-stack">
            {['XGBoost', 'CatBoost', 'SHAP', 'LangChain', 'FAISS', 'Firebase', 'React', 'FastAPI'].map(tech => (
              <span key={tech} className="tech-badge">{tech}</span>
            ))}
          </div>
        </div>
        <div className="hero-visual">
          <ThreeGlobe />
        </div>
      </section>

      {/* Stats */}
      <section className="stats-bar">
        {STATS.map((stat) => (
          <div key={stat.label} className="stat-item">
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </section>

      {/* Features */}
      <section className="features-section" ref={featuresRef}>
        <div className="section-header">
          <h2>Everything You Need to<br /><span className="gradient-text">Master Flight Intelligence</span></h2>
          <p>A production-grade ML platform showcasing the full spectrum of modern AI engineering.</p>
        </div>
        <div className="features-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Footer */}
      <section className="landing-cta">
        <div className="cta-glow"></div>
        <h2>Ready to see it in action?</h2>
        <p>Create a free account and start predicting delays in under a minute.</p>
        <button className="btn-hero-primary" onClick={() => navigate('/login')}>
          Launch SkyPredict →
        </button>
      </section>

      <footer className="landing-footer">
        <p>Built with passion by Ansh Malhotra</p>
      </footer>
    </div>
  );
}
