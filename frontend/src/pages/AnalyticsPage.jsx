import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { useEffect, useState } from 'react';
import { API_BASE } from '../config';

const COLORS = ['#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <p className="chart-tooltip-label">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}{p.name?.includes('rate') || p.name?.includes('Rate') ? '%' : ''}</strong></p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [driftData, setDriftData] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/analytics`)
      .then(r => r.json())
      .then(data => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
    
    fetch(`${API_BASE}/monitoring/drift`)
      .then(r => r.json())
      .then(data => setDriftData(data))
      .catch(() => {});
  }, []);

  if (loading) return (
    <div className="analytics-loading">
      <div className="spinner"></div>
      <p>Loading analytics...</p>
    </div>
  );

  if (!stats) return <div className="analytics-loading"><p>Could not load analytics.</p></div>;

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <h1>📊 Analytics Dashboard</h1>
        <p>Real-time model performance & prediction insights</p>
        {stats.note && <div className="analytics-note">ℹ️ {stats.note}</div>}
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon">🔢</div>
          <div className="kpi-value">{stats.total_predictions.toLocaleString()}</div>
          <div className="kpi-label">Total Predictions</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">⚠️</div>
          <div className="kpi-value">{stats.overall_delay_rate}%</div>
          <div className="kpi-label">Overall Delay Rate</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">🧠</div>
          <div className="kpi-value">{(stats.avg_probability * 100).toFixed(1)}%</div>
          <div className="kpi-label">Avg Confidence</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">✅</div>
          <div className="kpi-value">{(100 - stats.overall_delay_rate).toFixed(1)}%</div>
          <div className="kpi-label">On-Time Rate</div>
        </div>
      </div>

      <div className="charts-grid">
        {/* Airline Delay Rate Bar Chart */}
        <div className="chart-card wide">
          <h3>✈ Delay Rate by Airline</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats.airline_delay_rates} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="airline" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} unit="%" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="delay_rate" name="Delay Rate" radius={[4, 4, 0, 0]}>
                {stats.airline_delay_rates.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Hourly Trend Line Chart */}
        <div className="chart-card">
          <h3>🕐 Delay Rate by Hour of Day</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={stats.hourly_trend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickFormatter={h => `${String(h).padStart(2,'0')}:00`} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} unit="%" />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="delay_rate" name="Delay Rate"
                stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 4 }}
                activeDot={{ r: 6, fill: '#a78bfa' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Model Health */}
        <div className="chart-card">
          <h3>🤖 Model Health</h3>
          <div className="model-health-grid">
            {[
              { label: 'Avg Confidence', value: `${(stats.avg_probability * 100).toFixed(1)}%`, color: '#6366f1' },
              { label: 'Delay Rate', value: `${stats.overall_delay_rate}%`, color: '#ef4444' },
              { label: 'On-Time Rate', value: `${(100 - stats.overall_delay_rate).toFixed(1)}%`, color: '#10b981' },
              { label: 'Predictions', value: stats.total_predictions, color: '#3b82f6' },
            ].map(item => (
              <div key={item.label} className="health-item">
                <div className="health-value" style={{ color: item.color }}>{item.value}</div>
                <div className="health-label">{item.label}</div>
              </div>
            ))}
          </div>
          <div className="drift-indicator">
            <span className="fids-dot live"></span>
            <span>Model drift monitoring active</span>
          </div>
        </div>
      </div>

      {/* Recent Predictions */}
      {stats.recent && stats.recent.length > 0 && (
        <div className="chart-card recent-table">
          <h3>🕓 Recent Predictions</h3>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Airline</th>
                <th>Route</th>
                <th>Prediction</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent.slice(0, 10).map((p, i) => (
                <tr key={i}>
                  <td>{p.ts?.substring(11, 19) || '--'}</td>
                  <td>{p.airline}</td>
                  <td>{p.from} → {p.to}</td>
                  <td>
                    <span className={`badge ${p.prediction === 1 ? 'badge-danger' : 'badge-success'}`}>
                      {p.prediction === 1 ? '⚠ Delayed' : '✓ On Time'}
                    </span>
                  </td>
                  <td>{((p.prediction === 1 ? p.probability : 1.0 - p.probability) * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* MLOps KS-Test Drift Dashboard */}
      {driftData && (
        <div className="chart-card" style={{ marginTop: '1.5rem' }}>
          <h3>
            📡 MLOps Feature Drift Monitor
            <span style={{
              marginLeft: '1rem', fontSize: '0.75rem', fontWeight: 600,
              padding: '0.2rem 0.7rem', borderRadius: '20px',
              background: driftData.drift_detected ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
              color: driftData.drift_detected ? '#ef4444' : '#10b981',
              border: `1px solid ${driftData.drift_detected ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`
            }}>
              {driftData.drift_detected ? '⚠ Drift Detected' : '✓ Stable'}
            </span>
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Kolmogorov-Smirnov two-sample test comparing last {driftData.window_size || 0} production requests vs training baseline.
            {' '}p &lt; 0.05 indicates statistically significant distribution shift.
          </p>
          {driftData.status === 'insufficient_data' ? (
            <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>
              ⏳ {driftData.message}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {Object.entries(driftData.features || {}).map(([feat, info]) => (
                <div key={feat} style={{
                  background: 'rgba(255,255,255,0.03)', borderRadius: '10px',
                  padding: '0.8rem 1rem',
                  border: `1px solid ${info.drift_detected ? 'rgba(239,68,68,0.25)' : 'rgba(99,102,241,0.15)'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '0.9rem' }}>{feat}</strong>
                    <span style={{
                      fontSize: '0.75rem', fontWeight: 700,
                      color: info.drift_detected ? '#ef4444' : '#10b981'
                    }}>
                      {info.drift_detected ? '⚠ DRIFT' : '✓ OK'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <div><div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{info.ks_statistic}</div>KS Stat</div>
                    <div><div style={{ color: info.p_value < 0.05 ? '#ef4444' : '#10b981', fontWeight: 600 }}>p={info.p_value}</div>p-value</div>
                    <div><div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{info.live_mean} ± {info.live_std}</div>Live</div>
                    <div><div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{info.baseline_mean} ± {info.baseline_std}</div>Baseline</div>
                  </div>
                  <div style={{ marginTop: '0.5rem', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}>
                    <div style={{
                      width: `${Math.min(info.ks_statistic * 100, 100)}%`,
                      height: '100%', borderRadius: '2px',
                      background: info.drift_detected
                        ? 'linear-gradient(to right, #ef4444, #f97316)'
                        : 'linear-gradient(to right, #6366f1, #10b981)'
                    }} />
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
