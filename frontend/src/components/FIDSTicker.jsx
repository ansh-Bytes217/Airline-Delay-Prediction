import { useState, useEffect, useRef } from 'react';

const SAMPLE_FLIGHTS = [
  { callsign: 'AA1234', from: 'LAX', to: 'JFK', alt: '35000', speed: '520' },
  { callsign: 'DL892', from: 'ATL', to: 'ORD', alt: '32000', speed: '490' },
  { callsign: 'UA557', from: 'SFO', to: 'DEN', alt: '38000', speed: '510' },
  { callsign: 'WN401', from: 'DAL', to: 'PHX', alt: '28000', speed: '460' },
  { callsign: 'B6114', from: 'BOS', to: 'MCO', alt: '36000', speed: '505' },
  { callsign: 'AS210', from: 'SEA', to: 'LAS', alt: '33000', speed: '480' },
  { callsign: 'NK831', from: 'MIA', to: 'EWR', alt: '37000', speed: '515' },
  { callsign: 'F9220', from: 'DEN', to: 'LAX', alt: '34000', speed: '495' },
  { callsign: 'HA71', from: 'HNL', to: 'LAX', alt: '39000', speed: '530' },
  { callsign: 'MQ4502', from: 'DFW', to: 'MSP', alt: '31000', speed: '470' },
];

export default function FIDSTicker() {
  const [flights, setFlights] = useState(SAMPLE_FLIGHTS);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    // Try to fetch from OpenSky Network - free API, no key needed
    const fetchLiveFlights = async () => {
      try {
        const res = await fetch('https://opensky-network.org/api/states/all?lamin=24.0&lomin=-125.0&lamax=49.0&lomax=-66.0', {
          signal: AbortSignal.timeout(5000)
        });
        if (res.ok) {
          const data = await res.json();
          if (data.states && data.states.length > 0) {
            const live = data.states
              .filter(s => s[1] && s[1].trim() && s[7] && s[9] !== null)
              .slice(0, 15)
              .map(s => ({
                callsign: s[1].trim(),
                from: s[2] || 'US',
                to: '---',
                alt: s[7] ? Math.round(s[7] * 3.281).toLocaleString() : '---',
                speed: s[9] ? Math.round(s[9] * 1.944) : '---',
              }));
            if (live.length > 0) {
              setFlights(live);
              setIsLive(true);
            }
          }
        }
      } catch {
        // Silently fall back to sample data
      }
    };

    fetchLiveFlights();
    const interval = setInterval(fetchLiveFlights, 60000);
    return () => clearInterval(interval);
  }, []);

  const tickerText = flights.map(f =>
    `✈  ${f.callsign}  ${f.from} → ${f.to}  |  ALT ${f.alt}ft  |  ${f.speed} kts`
  ).join('          ');

  return (
    <div className="fids-ticker">
      <div className="fids-label">
        <span className={`fids-dot ${isLive ? 'live' : 'sim'}`}></span>
        {isLive ? 'LIVE' : 'SIM'}
      </div>
      <div className="fids-scroll-wrapper">
        <div className="fids-scroll-track">
          <span>{tickerText}</span>
          <span aria-hidden="true">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{tickerText}</span>
        </div>
      </div>
    </div>
  );
}
