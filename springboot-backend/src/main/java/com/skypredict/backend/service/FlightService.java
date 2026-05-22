package com.skypredict.backend.service;

import com.skypredict.backend.model.Flight;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class FlightService {
    private static final Logger logger = LoggerFactory.getLogger(FlightService.class);
    private final RestTemplate restTemplate = new RestTemplate();

    private final Map<String, Object> flightCache = new ConcurrentHashMap<>();
    private static final long CACHE_TTL_MS = 15000; // 15 seconds cache

    private static final List<Flight> SIMULATED_FLIGHTS = new ArrayList<>();
    static {
        String[] callsignPrefixes = {"AAL", "DAL", "UAL", "BAW", "AFR", "DLH", "UAE", "SIA", "QFA", "CCA", "JAL", "KLM", "THY", "QTR", "ANA"};
        String[] countries = {"United States", "United Kingdom", "Germany", "France", "UAE", "Australia", "Japan", "China", "India", "Brazil", "Canada", "Singapore", "Turkey", "Qatar"};
        
        Random random = new Random(42);
        for (int i = 0; i < 200; i++) {
            String icao = String.format("sim%03d", i);
            String callsign = callsignPrefixes[i % callsignPrefixes.length] + (100 + i * 7);
            double lat = Math.round((-60.0 + (i * 2.47) % 140.0) * 10000.0) / 10000.0;
            double lon = Math.round((-180.0 + (i * 3.71) % 360.0) * 10000.0) / 10000.0;
            int altitude = 15000 + (i * 1234) % 25000;
            int speed = 350 + (i * 17) % 200;
            int heading = (i * 53) % 360;
            String country = countries[i % countries.length];
            
            SIMULATED_FLIGHTS.add(new Flight(icao, callsign, lat, lon, altitude, speed, heading, country, false));
        }
    }

    public Map<String, Object> getFlights() {
        long now = System.currentTimeMillis();
        if (flightCache.containsKey("data") && flightCache.containsKey("timestamp")) {
            long cachedTime = (long) flightCache.get("timestamp");
            if (now - cachedTime < CACHE_TTL_MS) {
                return (Map<String, Object>) flightCache.get("data");
            }
        }

        try {
            logger.info("Fetching live flights from OpenSky...");
            // Use 8 seconds timeout
            Map<String, Object> response = restTemplate.getForObject("https://opensky-network.org/api/states/all", Map.class);
            if (response != null && response.containsKey("states")) {
                List<List<Object>> states = (List<List<Object>>) response.get("states");
                List<Flight> flights = new ArrayList<>();
                
                if (states != null) {
                    for (List<Object> s : states) {
                        if (s.size() > 10 && s.get(5) != null && s.get(6) != null) {
                            String icao24 = (String) s.get(0);
                            String callsign = s.get(1) != null ? ((String) s.get(1)).trim() : icao24;
                            if (callsign.isEmpty()) callsign = icao24;
                            
                            double lon = getDouble(s.get(5));
                            double lat = getDouble(s.get(6));
                            
                            // Convert altitude from meters to feet (1m = 3.281 ft)
                            int altitude = s.get(7) != null ? (int) Math.round(getDouble(s.get(7)) * 3.281) : 0;
                            // Convert speed from m/s to knots (1 m/s = 1.944 kts)
                            int speed = s.get(9) != null ? (int) Math.round(getDouble(s.get(9)) * 1.944) : 0;
                            int heading = s.get(10) != null ? (int) Math.round(getDouble(s.get(10))) : 0;
                            String country = s.get(2) != null ? (String) s.get(2) : "Unknown";
                            boolean onGround = s.get(8) != null && (boolean) s.get(8);

                            // Only track airborne flights
                            if (!onGround) {
                                flights.add(new Flight(
                                    icao24, callsign, 
                                    Math.round(lat * 10000.0) / 10000.0, 
                                    Math.round(lon * 10000.0) / 10000.0, 
                                    altitude, speed, heading, country, false
                                ));
                            }
                        }
                    }
                }

                if (!flights.isEmpty()) {
                    // Limit to 500 flights for map display performance
                    List<Flight> capped = flights.subList(0, Math.min(flights.size(), 500));
                    Map<String, Object> result = new HashMap<>();
                    result.put("source", "opensky");
                    result.put("count", flights.size());
                    result.put("cached_at", (double) now / 1000.0);
                    result.put("flights", capped);
                    
                    flightCache.put("data", result);
                    flightCache.put("timestamp", now);
                    return result;
                }
            }
        } catch (Exception e) {
            logger.warn("OpenSky API fetch failed: {}. Using simulated flights.", e.getMessage());
        }

        // Fallback to simulated flights
        Map<String, Object> result = new HashMap<>();
        result.put("source", "simulated");
        result.put("count", SIMULATED_FLIGHTS.size());
        result.put("cached_at", (double) now / 1000.0);
        result.put("flights", SIMULATED_FLIGHTS);
        
        flightCache.put("data", result);
        flightCache.put("timestamp", now);
        return result;
    }

    private double getDouble(Object val) {
        if (val instanceof Number) {
            return ((Number) val).doubleValue();
        }
        return 0.0;
    }
}
