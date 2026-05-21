import { useState, useEffect } from 'react';
import { requestNotificationPermission, onForegroundMessage } from '../services/notificationService';

export default function NotificationBell({ delayThreshold = 70 }) {
  const [status, setStatus] = useState('idle'); // idle | requesting | granted | denied
  const [alertThreshold, setAlertThreshold] = useState(delayThreshold);
  const [showPanel, setShowPanel] = useState(false);
  const [lastAlert, setLastAlert] = useState(null);

  useEffect(() => {
    // Check existing permission
    if (Notification.permission === 'granted') setStatus('granted');
    else if (Notification.permission === 'denied') setStatus('denied');

    // Listen for foreground FCM messages
    let unsub;
    onForegroundMessage((payload) => {
      setLastAlert(payload.notification?.body || 'New flight alert received!');
      setTimeout(() => setLastAlert(null), 6000);
    }).then(fn => { unsub = fn; });

    return () => { if (typeof unsub === 'function') unsub(); };
  }, []);

  const handleEnable = async () => {
    setStatus('requesting');
    const token = await requestNotificationPermission();
    if (token) {
      setStatus('granted');
      console.log('FCM Token:', token);
    } else {
      setStatus(Notification.permission === 'denied' ? 'denied' : 'idle');
    }
  };

  return (
    <div className="notif-bell-wrapper">
      <button
        className={`notif-bell ${status}`}
        onClick={() => status === 'granted' ? setShowPanel(!showPanel) : handleEnable()}
        title={status === 'granted' ? 'Notification settings' : 'Enable delay alerts'}
      >
        {status === 'granted' ? '🔔' : status === 'denied' ? '🔕' : '🔔'}
        {status === 'granted' && <span className="notif-dot"></span>}
      </button>

      {showPanel && status === 'granted' && (
        <div className="notif-panel">
          <div className="notif-panel-header">
            <h4>🔔 Delay Alerts</h4>
            <button onClick={() => setShowPanel(false)}>✕</button>
          </div>
          <p className="notif-panel-desc">
            Get notified when a prediction exceeds your delay threshold.
          </p>
          <div className="notif-threshold">
            <label>Alert when delay probability &gt;</label>
            <div className="notif-threshold-row">
              <input
                type="range" min="50" max="95" step="5"
                value={alertThreshold}
                onChange={e => setAlertThreshold(Number(e.target.value))}
              />
              <span className="notif-threshold-value">{alertThreshold}%</span>
            </div>
          </div>
          <div className="notif-status-row">
            <span className="fids-dot live"></span>
            <span>Notifications active</span>
          </div>
        </div>
      )}

      {status === 'requesting' && (
        <div className="notif-panel">
          <p style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            ⏳ Requesting permission...
          </p>
        </div>
      )}

      {/* Foreground alert toast */}
      {lastAlert && (
        <div className="notif-toast">
          🔔 {lastAlert}
        </div>
      )}
    </div>
  );
}
