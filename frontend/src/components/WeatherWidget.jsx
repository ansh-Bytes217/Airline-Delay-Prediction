import { useState, useEffect } from 'react';
import { API_BASE } from '../config';

// Maps weather descriptors to emoji icons
function getWeatherIcon(desc) {
  const d = desc.toLowerCase();
  if (d.includes('clear')) return '☀️';
  if (d.includes('cloud') || d.includes('overcast')) return '☁️';
  if (d.includes('fog')) return '🌫️';
  if (d.includes('drizzle') || d.includes('light rain')) return '🌦️';
  if (d.includes('heavy rain') || d.includes('rain showers')) return '🌧️';
  if (d.includes('snow') || d.includes('freezing')) return '❄️';
  if (d.includes('thunderstorm')) return '⛈️';
  return '🌡️';
}

export default function WeatherWidget({ airportCode, onWeatherLoaded }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!airportCode) return;
    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/weather/${airportCode}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch weather');
        return res.json();
      })
      .then((data) => {
        setWeather(data.weather);
        if (onWeatherLoaded) {
          onWeatherLoaded(data.weather);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [airportCode]);

  if (!airportCode) return null;

  return (
    <div className="weather-widget glass-panel">
      <div className="weather-header">
        <div>
          <h3>Live Airport Weather</h3>
          <span className="airport-badge">{airportCode} Airport</span>
        </div>
        {weather && (
          <div className={`weather-risk-badge risk-${weather.impact.toLowerCase()}`}>
            ⚠️ {weather.impact} Delay Risk
          </div>
        )}
      </div>

      {loading && (
        <div className="weather-loading">
          <div className="spinner" style={{ width: 24, height: 24 }}></div>
          <span>Fetching meteorological data...</span>
        </div>
      )}

      {error && (
        <div className="weather-error">
          <span>⚠️ Weather offline (Using historical default)</span>
        </div>
      )}

      {!loading && !error && weather && (
        <div className="weather-body animate-fade-in">
          <div className="weather-main-row">
            <span className="weather-big-icon">{getWeatherIcon(weather.description)}</span>
            <div>
              <span className="weather-temp">{weather.temp.toFixed(1)}°C</span>
              <span className="weather-desc">{weather.description}</span>
            </div>
          </div>

          <div className="weather-stats-grid">
            <div className="weather-stat-item">
              <span className="stat-label">Apparent Temp</span>
              <span className="stat-val">{weather.temp_apparent.toFixed(1)}°C</span>
            </div>
            <div className="weather-stat-item">
              <span className="stat-label">Wind Speed</span>
              <span className="stat-val">{weather.wind_speed.toFixed(1)} km/h</span>
            </div>
            <div className="weather-stat-item">
              <span className="stat-label">Precipitation</span>
              <span className="stat-val">{weather.precipitation.toFixed(1)} mm</span>
            </div>
            <div className="weather-stat-item">
              <span className="stat-label">Humidity</span>
              <span className="stat-val">{weather.humidity}%</span>
            </div>
          </div>

          {weather.multiplier > 1.0 && (
            <div className="weather-impact-notice">
              <strong>💡 Impact:</strong> {weather.reason}. ML prediction model adjusted by +
              {Math.round((weather.multiplier - 1.0) * 100)}%.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
