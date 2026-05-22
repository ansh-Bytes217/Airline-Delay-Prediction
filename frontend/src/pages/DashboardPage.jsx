import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../contexts/AuthContext';
import { savePrediction } from '../services/firestoreService';
import { showLocalNotification } from '../services/notificationService';
import PredictionHistory from '../components/PredictionHistory';
import WeatherWidget from '../components/WeatherWidget';
import { API_BASE } from '../config';


export default function DashboardPage() {
  // Existing state
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState({ Airline:'WN', AirportFrom:'ATL', AirportTo:'DFW', DayOfWeek:1, Time:360, Length:120 });
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedModel, setSelectedModel] = useState('ensemble');
  const [abMode, setAbMode] = useState(false);
  const [abResults, setAbResults] = useState(null);
  const [historyTrigger, setHistoryTrigger] = useState(0);
  const [weatherData, setWeatherData] = useState(null);
  const [flightNotes, setFlightNotes] = useState('');


  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { sender: 'bot', text: "Hi! I'm your AI policy assistant. Ask me anything about airline compensation or FAA regulations!" }
  ]);
  const [chatLoading, setChatLoading] = useState(false);

  // PDF upload state
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  const airlines = ['WN','AA','DL','OO','EV','YV','UA','MQ','B6','AS','NK','F9','HA','VX'];
  const airports = ['ATL','ORD','DFW','DEN','LAX','SFO','LAS','PHX','MCO','IAH','JFK','SEA','MIA','EWR','BOS'];

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: ['Airline','AirportFrom','AirportTo'].includes(name) ? value : Number(value) }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true); setError(null); setPrediction(null); setAbResults(null);
    try {
      if (abMode) {
        const r = await fetch(`${API_BASE}/predict/ab`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, model: 'ensemble', weather: weatherData, flight_notes: flightNotes }),
        });
        if (!r.ok) throw new Error('AB request failed');
        setAbResults(await r.json());
      } else {
        const r = await fetch(`${API_BASE}/predict`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, model: selectedModel, weather: weatherData, flight_notes: flightNotes }),
        });
        if (!r.ok) throw new Error('Prediction failed');
        const data = await r.json();

        setPrediction(data);
        // Save to Firestore
        if (currentUser) {
          await savePrediction(currentUser.uid, formData, data);
          setHistoryTrigger(t => t + 1);
        }
        // Trigger notification if high delay risk
        if (data.prediction === 1 && data.probability >= 0.7) {
          showLocalNotification(
            '⚠️ High Delay Risk Detected!',
            `${formData.Airline} ${formData.AirportFrom}→${formData.AirportTo}: ${(data.probability*100).toFixed(0)}% delay probability`
          );
        }
      }
    } catch (err) {
      setError('Failed to get prediction: ' + err.message);
    } finally { setLoading(false); }
  };

  const handleChatSubmit = async e => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    const userMsg = chatMessage;
    setChatHistory(prev => [...prev, { sender:'user', text:userMsg }]);
    setChatMessage(''); setChatLoading(true);
    try {
      const r = await fetch(`${API_BASE}/chat`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await r.json();
      setChatHistory(prev => [...prev, { sender:'bot', text: data.answer, sources: data.sources }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { sender:'bot', text:'Error: ' + err.message }]);
    } finally { setChatLoading(false); }
  };

  // PDF dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'], 'text/markdown': ['.md'] },
    maxFiles: 1,
    onDrop: async acceptedFiles => {
      if (!acceptedFiles.length) return;
      setUploading(true); setUploadMsg('');
      const fd = new FormData();
      fd.append('file', acceptedFiles[0]);
      try {
        const r = await fetch(`${API_BASE}/upload-doc`, { method:'POST', body: fd });
        const data = await r.json();
        setUploadMsg(r.ok ? `✅ ${data.message}` : `❌ ${data.detail}`);
      } catch {
        setUploadMsg('❌ Upload failed. Is the backend running?');
      } finally { setUploading(false); }
    }
  });

  const formatTime = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;

  const ResultCard = ({ data, label }) => {
    const confidence = data.prediction === 1 ? data.probability * 100 : (1.0 - data.probability) * 100;
    return (
      <div className={`result-card ${data.prediction===1?'delayed':'on-time'}`}>
        {label && <div className="ab-label">{label}</div>}
        <div className="result-icon">{data.prediction===1?'✈️':'✅'}</div>
        <h2 className="result-title">{data.prediction===1?'Likely Delayed':'On Time'}</h2>
        <div className="prob-container">
          <span className="prob-label">Confidence</span>
          <div className="prob-bar-bg">
            <div className="prob-bar-fill" style={{ width:`${confidence.toFixed(0)}%` }}></div>
          </div>
          <span className="prob-value">{confidence.toFixed(1)}%</span>
        </div>
        {data.shap_values?.length > 0 && (
          <div className="shap-container">
            <h3 className="shap-title">AI Decision Breakdown</h3>
            <div className="shap-list">
              {data.shap_values.map((item,idx) => (
                <div key={idx} className="shap-item">
                  <span className="shap-feature">{item.feature}</span>
                  <div className="shap-bar-container">
                    <div className={`shap-bar ${item.value>0?'shap-positive':'shap-negative'}`}
                      style={{ width:`${Math.min(Math.abs(item.value)*100,100)}%`,
                        marginLeft: item.value<0?'auto':'0', marginRight: item.value>0?'auto':'0' }}>
                    </div>
                  </div>
                  <span className={`shap-value ${item.value>0?'text-danger':'text-success'}`}>
                    {item.value>0?'+':''}{item.value.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app-container">
      <div className="header">
        <h1>SkyPredict Dashboard</h1>
        <p>AI-Powered Flight Delay Prediction</p>
      </div>

      {/* Model selector */}
      <div className="model-selector-bar">
        <div className="model-tabs">
          {['ensemble','xgboost','catboost','nn'].map(m => (
            <button key={m} className={`model-tab ${selectedModel===m&&!abMode?'active':''}`}
              onClick={() => { setSelectedModel(m); setAbMode(false); }}>
              {m === 'nn' ? 'Neural Network' : m.charAt(0).toUpperCase()+m.slice(1)}
            </button>
          ))}
          <button className={`model-tab ab-tab ${abMode?'active':''}`}
            onClick={() => setAbMode(!abMode)}>
            ⚖️ A/B Compare
          </button>
        </div>
        {abMode && <span className="ab-hint">Side-by-side comparison of all 3 models</span>}
      </div>

      <div className="main-content">
        <div className="left-column" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: '1 1 400px', width: '100%', maxWidth: '450px' }}>
          {/* Form */}
          <div className="glass-panel prediction-form">
            <form onSubmit={handleSubmit}>
              {[['Airline','Airline Carrier',airlines],['AirportFrom','Departure Airport',airports],['AirportTo','Destination Airport',airports]].map(([name,label,opts]) => (
                <div className="form-group" key={name}>
                  <label>{label}</label>
                  <select className="form-control" name={name} value={formData[name]} onChange={handleChange}>
                    {opts.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              ))}
              <div className="form-group">
                <label>Day of Week</label>
                <select className="form-control" name="DayOfWeek" value={formData.DayOfWeek} onChange={handleChange}>
                  {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((d,i) => (
                    <option key={d} value={i+1}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Departure Time: {formatTime(formData.Time)}</label>
                <input type="range" className="form-control" name="Time" min="0" max="1439" step="15" value={formData.Time} onChange={handleChange}/>
              </div>
              <div className="form-group">
                <label>Flight Duration: {formData.Length} min</label>
                <input type="range" className="form-control" name="Length" min="30" max="720" step="10" value={formData.Length} onChange={handleChange}/>
              </div>
              <div className="form-group">
                <label>🧬 Flight Notes / Disruption Alerts</label>
                <textarea
                  className="form-control"
                  placeholder="Optional: Describe any alerts, delays, or weather events (e.g. 'Aircraft maintenance delay, storm warning at ATL'). Analyzed by DistilBERT transformer."
                  value={flightNotes}
                  onChange={e => setFlightNotes(e.target.value)}
                  rows={3}
                  style={{ resize: 'vertical', fontSize: '0.85rem', lineHeight: '1.5' }}
                />
                {flightNotes && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', marginTop: '0.3rem' }}>
                    🤖 DistilBERT transformer will analyze this text for disruption risk
                  </div>
                )}
              </div>
              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Analyzing...' : abMode ? '⚖️ Compare All Models' : `Predict with ${selectedModel}`}
              </button>
            </form>
          </div>

          {/* Weather Widget */}
          <WeatherWidget airportCode={formData.AirportFrom} onWeatherLoaded={setWeatherData} />
        </div>


        {/* Results */}
        <div className={`result-panel ${abMode&&abResults?'ab-panel':''}`}>
          {loading && <div className="spinner"></div>}
          {!loading && !prediction && !error && !abResults && (
            <div className="result-placeholder">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
              </svg>
              <p>Enter flight details to see AI prediction</p>
            </div>
          )}
          {!loading && error && (
            <div className="result-card delayed">
              <div className="result-icon">!</div>
              <h2 className="result-title">Error</h2>
              <p style={{color:'var(--text-secondary)'}}>{error}</p>
            </div>
          )}
          {!loading && prediction && !abMode && <ResultCard data={prediction} />}
          {!loading && abResults && abMode && (
            <div className="ab-results">
              {Object.entries(abResults).filter(([,v])=>v).map(([name,data]) => (
                <ResultCard key={name} data={data} label={name.charAt(0).toUpperCase()+name.slice(1)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Prediction History */}
      <PredictionHistory refreshTrigger={historyTrigger} />

      {/* Floating Chatbot with PDF upload */}
      <div className={`chat-widget ${chatOpen?'open':''}`}>
        <button className="chat-toggle" onClick={() => setChatOpen(!chatOpen)}>
          {chatOpen ? 'Close AI Assistant ✕' : '💬 Ask AI Assistant'}
        </button>
        {chatOpen && (
          <div className="chat-window">
            {/* PDF Upload zone */}
            <div {...getRootProps()} className={`pdf-dropzone ${isDragActive?'drag-active':''}`}>
              <input {...getInputProps()} />
              {uploading ? <span>⏳ Ingesting document...</span>
                : uploadMsg ? <span>{uploadMsg}</span>
                : <span>📂 Drop a PDF/TXT to add to knowledge base</span>}
            </div>
            <div className="chat-messages">
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`chat-message ${msg.sender}`}>
                  <p>{msg.text}</p>
                  {msg.sources?.length > 0 && (
                    <div className="chat-sources">
                      <small><strong>Sources:</strong></small>
                      <ul>{msg.sources.map((s,i) => <li key={i}><small>{s}</small></li>)}</ul>
                    </div>
                  )}
                </div>
              ))}
              {chatLoading && <div className="chat-message bot loading"><span>...</span></div>}
            </div>
            <form onSubmit={handleChatSubmit} className="chat-input-area">
              <input type="text" value={chatMessage} onChange={e => setChatMessage(e.target.value)}
                placeholder="Ask about airline policies..." disabled={chatLoading}/>
              <button type="submit" disabled={chatLoading}>Send</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
