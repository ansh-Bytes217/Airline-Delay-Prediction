import { useEffect, useState } from 'react';
import { fetchUserPredictions } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';

const DAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatTime(minutes) {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export default function PredictionHistory({ refreshTrigger }) {
  const { currentUser } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!currentUser || !open) return;
    setLoading(true);
    fetchUserPredictions(currentUser.uid, 15)
      .then(data => { setHistory(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [currentUser, open, refreshTrigger]);

  return (
    <div className="pred-history-wrapper">
      <button className="pred-history-toggle" onClick={() => setOpen(!open)}>
        🕓 My Predictions {open ? '▲' : '▼'}
      </button>

      {open && (
        <div className="pred-history-panel glass-panel">
          <h3>Recent Predictions</h3>
          {loading ? (
            <div className="pred-history-loading"><div className="spinner" style={{ width: 28, height: 28 }}></div></div>
          ) : history.length === 0 ? (
            <p className="pred-history-empty">No predictions yet. Make your first prediction above!</p>
          ) : (
            <div className="pred-history-list">
              {history.map(p => (
                <div key={p.id} className={`pred-history-item ${p.prediction === 1 ? 'item-delayed' : 'item-ontime'}`}>
                  <div className="pred-history-route">
                    <strong>{p.airline}</strong>
                    <span>{p.from} → {p.to}</span>
                  </div>
                  <div className="pred-history-meta">
                    <span>{DAY_NAMES[p.dayOfWeek]}</span>
                    <span>{formatTime(p.time)}</span>
                    <span className={`badge ${p.prediction === 1 ? 'badge-danger' : 'badge-success'}`}>
                      {p.prediction === 1 ? '⚠ Delayed' : '✓ On Time'}
                    </span>
                    <span className="pred-prob">{(p.probability * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
