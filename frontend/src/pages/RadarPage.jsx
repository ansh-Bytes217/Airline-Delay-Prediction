import { useEffect, useRef, useState, useCallback } from 'react';

let L;

// Global simulated fallback flights spread across the world
const SIMULATED_FLIGHTS = Array.from({ length: 200 }, (_, i) => ({
  icao24: `sim${i}`,
  callsign: ['AAL','DAL','UAL','BAW','AFR','DLH','UAE','SIA','QFA','CCA','JAL','KLM','THY','QTR','ANA'][i % 15] + (100 + i * 7),
  lat: parseFloat((-60 + (i * 2.47) % 140).toFixed(4)),
  lon: parseFloat((-180 + (i * 3.71) % 360).toFixed(4)),
  altitude: Math.round(15000 + (i * 1234) % 25000),
  speed: Math.round(350 + (i * 17) % 200),
  heading: Math.round((i * 53) % 360),
  country: ['United States','United Kingdom','Germany','France','UAE','Australia','Japan','China','India','Brazil','Canada','Singapore','Turkey','Qatar'][i % 14],
  on_ground: false,
}));

const REGION_BOUNDS = {
  world:    null,
  northAm:  [[15, -170], [72, -50]],
  europe:   [[35, -15],  [72, 45]],
  asia:     [[5, 50],    [70, 150]],
  mideast:  [[12, 30],   [45, 70]],
  oceania:  [[-50, 100], [5, 180]],
  southAm:  [[-60, -85], [15, -30]],
  africa:   [[-40, -20], [38, 55]],
};

const COUNTRY_FLAGS = {
  'United States': '🇺🇸', 'United Kingdom': '🇬🇧', 'Germany': '🇩🇪',
  'France': '🇫🇷', 'UAE': '🇦🇪', 'Australia': '🇦🇺', 'Japan': '🇯🇵',
  'China': '🇨🇳', 'India': '🇮🇳', 'Brazil': '🇧🇷', 'Canada': '🇨🇦',
  'Singapore': '🇸🇬', 'Turkey': '🇹🇷', 'Qatar': '🇶🇦', 'Netherlands': '🇳🇱',
  'Spain': '🇪🇸', 'Italy': '🇮🇹', 'South Korea': '🇰🇷', 'Russia': '🇷🇺',
};

// Major global airports for route drawing
const AIRPORT_COORDS = {
  // North America
  ATL:[33.6407,-84.4277], ORD:[41.9742,-87.9073], DFW:[32.8998,-97.0403],
  LAX:[33.9416,-118.4085], JFK:[40.6413,-73.7781], MIA:[25.7959,-80.287],
  YYZ:[43.6777,-79.6248], MEX:[19.4363,-99.0721],
  // Europe
  LHR:[51.4775,-0.4614], CDG:[49.0097,2.5479], FRA:[50.0379,8.5622],
  AMS:[52.3086,4.7639], MAD:[40.4936,-3.5668], FCO:[41.8003,12.2389],
  IST:[41.2608,28.7418], ZRH:[47.4647,8.5492],
  // Middle East & Africa
  DXB:[25.2532,55.3657], DOH:[25.2731,51.6082], JNB:[-26.1367,28.246],
  CAI:[30.1219,31.4056],
  // Asia Pacific
  SIN:[1.3644,103.9915], HKG:[22.308,113.9185], NRT:[35.7647,140.3864],
  PEK:[40.0799,116.6031], SYD:[-33.9461,151.177], BOM:[19.0896,72.8656],
  DEL:[28.5562,77.1],   BKK:[13.6811,100.7475],
  // South America
  GRU:[-23.4356,-46.4731], GIG:[-22.8099,-43.2505], EZE:[-34.8222,-58.5358],
};

export default function RadarPage() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const routeLayerRef = useRef(null);

  const [flights, setFlights] = useState([]);
  const [selected, setSelected] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [flightCount, setFlightCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingRoute, setPendingRoute] = useState(null);
  const [region, setRegion] = useState('world');
  const [countryFilter, setCountryFilter] = useState('');

  useEffect(() => {
    const handler = e => setPendingRoute(e.detail);
    window.addEventListener('skypredict:route', handler);
    return () => window.removeEventListener('skypredict:route', handler);
  }, []);

  const getPlaneIcon = (heading, isSelected) => {
    const color = isSelected ? '#f59e0b' : '#6366f1';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
      style="transform:rotate(${heading}deg);filter:drop-shadow(0 0 3px ${color})">
      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="${color}"/>
    </svg>`;
    return L.divIcon({ html: svg, className: '', iconSize: [22, 22], iconAnchor: [11, 11] });
  };

  const drawRoute = useCallback((fromCode, toCode) => {
    if (!mapInstanceRef.current || !L) return;
    const map = mapInstanceRef.current;
    if (routeLayerRef.current) { map.removeLayer(routeLayerRef.current); routeLayerRef.current = null; }
    const fromCoord = AIRPORT_COORDS[fromCode];
    const toCoord = AIRPORT_COORDS[toCode];
    if (!fromCoord || !toCoord) return;

    const points = [];
    for (let t = 0; t <= 1; t += 0.03) {
      const lat = fromCoord[0] + (toCoord[0] - fromCoord[0]) * t;
      const lon = fromCoord[1] + (toCoord[1] - fromCoord[1]) * t;
      const arc = Math.sin(Math.PI * t) * 5;
      points.push([lat + arc, lon]);
    }

    routeLayerRef.current = L.layerGroup().addTo(map);
    L.polyline(points, { color: '#f59e0b', weight: 2, opacity: 0.9, dashArray: '8,5' })
      .addTo(routeLayerRef.current);
    [fromCoord, toCoord].forEach((coord, i) => {
      L.circleMarker(coord, { radius: 8, color: i === 0 ? '#10b981' : '#ef4444', fillColor: i === 0 ? '#10b981' : '#ef4444', fillOpacity: 0.85 })
        .bindTooltip(i === 0 ? fromCode : toCode, { permanent: true, direction: 'top', className: 'airport-label' })
        .addTo(routeLayerRef.current);
    });
    map.fitBounds(L.latLngBounds([fromCoord, toCoord]).pad(0.4));
  }, []);

  useEffect(() => {
    if (pendingRoute && mapInstanceRef.current) {
      drawRoute(pendingRoute.from, pendingRoute.to);
      setPendingRoute(null);
    }
  }, [pendingRoute, drawRoute]);

  // Apply region filter on the map
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const bounds = REGION_BOUNDS[region];
    if (bounds) {
      mapInstanceRef.current.fitBounds(bounds, { animate: true, duration: 1.2 });
    } else {
      mapInstanceRef.current.setView([20, 10], 2, { animate: true });
    }
  }, [region]);

  const fetchFlights = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/flights', { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const data = await res.json();
        if (data.flights?.length) {
          setFlights(data.flights);
          setFlightCount(data.flights.length);
          setTotalCount(data.count);
          setIsLive(data.source === 'opensky');
          return data.flights;
        }
      }
    } catch (e) { console.warn('Backend /flights error:', e.message); }
    setFlights(SIMULATED_FLIGHTS);
    setFlightCount(SIMULATED_FLIGHTS.length);
    setTotalCount(SIMULATED_FLIGHTS.length);
    setIsLive(false);
    return SIMULATED_FLIGHTS;
  };

  const updateMarkers = useCallback((flightList, selectedIcao) => {
    if (!mapInstanceRef.current || !L) return;
    const map = mapInstanceRef.current;
    const set = new Set(flightList.map(f => f.icao24));
    Object.keys(markersRef.current).forEach(id => {
      if (!set.has(id)) { map.removeLayer(markersRef.current[id]); delete markersRef.current[id]; }
    });
    flightList.forEach(f => {
      const icon = getPlaneIcon(f.heading, f.icao24 === selectedIcao);
      if (markersRef.current[f.icao24]) {
        markersRef.current[f.icao24].setLatLng([f.lat, f.lon]).setIcon(icon);
      } else {
        markersRef.current[f.icao24] = L.marker([f.lat, f.lon], { icon })
          .addTo(map)
          .on('click', () => handleSelectFlight(f));
      }
    });
  }, []);

  useEffect(() => {
    let isMounted = true;
    const initMap = async () => {
      L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (!isMounted || !mapRef.current || mapInstanceRef.current) return;

      // World-view centered on Europe/Africa prime meridian for a clean global perspective
      const map = L.map(mapRef.current, {
        center: [20, 10],
        zoom: 2,
        zoomControl: false,
        minZoom: 2,
        maxBounds: [[-90, -220], [90, 220]],
        maxBoundsViscosity: 0.8,
      });

      // Dark global tile with satellite-quality detail
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '©OpenStreetMap ©CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);
      mapInstanceRef.current = map;

      const data = await fetchFlights();
      if (isMounted) updateMarkers(data, null);

      const interval = setInterval(async () => {
        if (!isMounted) return;
        const updated = await fetchFlights();
        if (isMounted) updateMarkers(updated, selected?.icao24 || null);
      }, 20000);
      return () => clearInterval(interval);
    };
    initMap();
    return () => { isMounted = false; };
  }, []);

  const handleSelectFlight = f => {
    setSelected(f);
    mapInstanceRef.current?.flyTo([f.lat, f.lon], 7, { duration: 1.5 });
    updateMarkers(flights, f.icao24);
  };

  const handleSearch = e => {
    const q = e.target.value.toUpperCase();
    setSearchQuery(q);
    if (!q) return;
    const match = flights.find(f => f.callsign?.toUpperCase().includes(q) || f.country?.toUpperCase().includes(q));
    if (match) handleSelectFlight(match);
  };

  const countries = [...new Set(flights.map(f => f.country).filter(Boolean))].sort();

  const filtered = flights.filter(f => {
    const matchSearch = !searchQuery || f.callsign?.toUpperCase().includes(searchQuery);
    const matchCountry = !countryFilter || f.country === countryFilter;
    return matchSearch && matchCountry;
  });

  const regions = [
    { key: 'world', label: '🌍 World' },
    { key: 'northAm', label: '🇺🇸 N. America' },
    { key: 'europe', label: '🇪🇺 Europe' },
    { key: 'asia', label: '🌏 Asia' },
    { key: 'mideast', label: '🇦🇪 Mid East' },
    { key: 'oceania', label: '🇦🇺 Oceania' },
    { key: 'southAm', label: '🇧🇷 S. America' },
    { key: 'africa', label: '🌍 Africa' },
  ];

  return (
    <div className="radar-page">
      <aside className="radar-sidebar">
        <div className="radar-sidebar-header">
          <h2>🛰️ Global Radar</h2>
          <div className="radar-status">
            <span className={`fids-dot ${isLive ? 'live' : 'sim'}`}></span>
            <span>{isLive ? 'LIVE' : 'SIM'} — {flightCount.toLocaleString()} shown {totalCount > flightCount ? `of ${totalCount.toLocaleString()}` : ''}</span>
          </div>

          {/* Region Filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', margin: '0.6rem 0' }}>
            {regions.map(r => (
              <button
                key={r.key}
                onClick={() => setRegion(r.key)}
                style={{
                  padding: '0.25rem 0.55rem', fontSize: '0.7rem', borderRadius: '20px', cursor: 'pointer',
                  border: region === r.key ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                  background: region === r.key ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
                  color: region === r.key ? '#a78bfa' : 'var(--text-secondary)',
                  transition: 'all 0.2s',
                }}
              >{r.label}</button>
            ))}
          </div>

          {/* Search */}
          <input className="radar-search" type="text" placeholder="🔍 Search callsign..."
            value={searchQuery} onChange={handleSearch} />

          {/* Country Filter */}
          <select
            value={countryFilter}
            onChange={e => setCountryFilter(e.target.value)}
            style={{
              width: '100%', marginTop: '0.5rem', padding: '0.4rem 0.6rem',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.8rem',
            }}
          >
            <option value="">🌐 All Countries</option>
            {countries.map(c => (
              <option key={c} value={c}>{COUNTRY_FLAGS[c] || '🏳'} {c}</option>
            ))}
          </select>
        </div>

        {selected ? (
          <div className="flight-detail">
            <button className="detail-back" onClick={() => setSelected(null)}>← Back</button>
            <div className="detail-callsign">{selected.callsign || 'Unknown'}</div>
            <div className="detail-country">
              {COUNTRY_FLAGS[selected.country] || '🏳'} {selected.country}
            </div>
            <div className="detail-grid">
              {[
                ['Altitude', `${selected.altitude?.toLocaleString()} ft`],
                ['Speed', `${selected.speed} kts`],
                ['Heading', `${Math.round(selected.heading)}°`],
                ['Lat / Lon', `${selected.lat}, ${selected.lon}`],
                ['Status', selected.on_ground ? '🟡 On Ground' : '🟢 Airborne'],
              ].map(([l, v]) => (
                <div className="detail-item" key={l}>
                  <span className="detail-label">{l}</span>
                  <span className="detail-value">{v}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flight-list">
            <p className="flight-list-hint">
              {searchQuery || countryFilter
                ? `${filtered.length} result(s)`
                : `${filtered.length} airborne aircraft`}
            </p>
            <div className="flight-list-items">
              {filtered.slice(0, 50).map(f => (
                <div key={f.icao24} className="flight-list-item" onClick={() => handleSelectFlight(f)}>
                  <span className="flight-item-callsign">
                    {COUNTRY_FLAGS[f.country] || '✈'} {f.callsign || f.icao24}
                  </span>
                  <span className="flight-item-alt">{f.altitude?.toLocaleString()}ft</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>
      <div className="radar-map" ref={mapRef}></div>
    </div>
  );
}
