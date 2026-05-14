package com.skypredict.backend.service;

import com.skypredict.backend.model.WeatherData;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class WeatherService {
    private static final Logger logger = LoggerFactory.getLogger(WeatherService.class);
    private final RestTemplate restTemplate = new RestTemplate();
    
    // Cache weather data to prevent rate-limiting: CacheKey -> CachedWeather
    private final Map<String, CachedWeather> cache = new ConcurrentHashMap<>();
    private static final long CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

    public static final Map<String, double[]> AIRPORT_COORDS = new HashMap<>();
    static {
        // North America
        AIRPORT_COORDS.put("ATL", new double[]{33.6407, -84.4277});
        AIRPORT_COORDS.put("ORD", new double[]{41.9742, -87.9073});
        AIRPORT_COORDS.put("DFW", new double[]{32.8998, -97.0403});
        AIRPORT_COORDS.put("DEN", new double[]{39.8561, -104.6737});
        AIRPORT_COORDS.put("LAX", new double[]{33.9416, -118.4085});
        AIRPORT_COORDS.put("SFO", new double[]{37.6213, -122.3790});
        AIRPORT_COORDS.put("LAS", new double[]{36.0840, -115.1537});
        AIRPORT_COORDS.put("PHX", new double[]{33.4352, -112.0101});
        AIRPORT_COORDS.put("MCO", new double[]{28.4281, -81.3060});
        AIRPORT_COORDS.put("IAH", new double[]{29.9902, -95.3368});
        AIRPORT_COORDS.put("JFK", new double[]{40.6413, -73.7781});
        AIRPORT_COORDS.put("SEA", new double[]{47.4502, -122.3088});
        AIRPORT_COORDS.put("MIA", new double[]{25.7959, -80.2870});
        AIRPORT_COORDS.put("EWR", new double[]{40.6895, -74.1745});
        AIRPORT_COORDS.put("BOS", new double[]{42.3656, -71.0096});
        // International Airports
        AIRPORT_COORDS.put("LHR", new double[]{51.4775, -0.4614});
        AIRPORT_COORDS.put("CDG", new double[]{49.0097, 2.5479});
        AIRPORT_COORDS.put("FRA", new double[]{50.0379, 8.5622});
        AIRPORT_COORDS.put("AMS", new double[]{52.3086, 4.7639});
        AIRPORT_COORDS.put("DXB", new double[]{25.2532, 55.3657});
        AIRPORT_COORDS.put("SIN", new double[]{1.3644, 103.9915});
        AIRPORT_COORDS.put("NRT", new double[]{35.7647, 140.3864});
        AIRPORT_COORDS.put("SYD", new double[]{-33.9461, 151.1770});
        AIRPORT_COORDS.put("GRU", new double[]{-23.4356, -46.4731});
    }

    public WeatherData getWeatherForAirport(String airport) {
        String code = airport.trim().toUpperCase();
        double[] coords = AIRPORT_COORDS.get(code);
        if (coords == null) {
            logger.warn("Airport coordinates not mapped for: {}. Using simulated clear weather.", code);
            return getSimulatedWeather();
        }

        long now = System.currentTimeMillis();
        CachedWeather cached = cache.get(code);
        if (cached != null && (now - cached.timestamp < CACHE_TTL_MS)) {
            return cached.data;
        }

        try {
            double lat = coords[0];
            double lon = coords[1];
            String url = String.format(
                "https://api.open-meteo.com/v1/forecast?latitude=%f&longitude=%f&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m",
                lat, lon
            );

            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response != null && response.containsKey("current")) {
                Map<String, Object> current = (Map<String, Object>) response.get("current");
                
                double temp = getDoubleValue(current.get("temperature_2m"), 20.0);
                double tempApparent = getDoubleValue(current.get("apparent_temperature"), 20.0);
                double humidity = getDoubleValue(current.get("relative_humidity_2m"), 50.0);
                double precipitation = getDoubleValue(current.get("precipitation"), 0.0);
                double rain = getDoubleValue(current.get("rain"), 0.0);
                double showers = getDoubleValue(current.get("showers"), 0.0);
                double snowfall = getDoubleValue(current.get("snowfall"), 0.0);
                double windSpeed = getDoubleValue(current.get("wind_speed_10m"), 0.0);
                int weatherCode = getIntValue(current.get("weather_code"), 0);

                String description = getWeatherDescription(weatherCode);
                WeatherImpact impact = getWeatherImpact(weatherCode, windSpeed, precipitation);

                WeatherData data = new WeatherData(
                    temp, tempApparent, humidity, precipitation, rain, showers, snowfall,
                    windSpeed, weatherCode, description, impact.level(), impact.multiplier(), impact.reason()
                );
                
                cache.put(code, new CachedWeather(data, now));
                return data;
            }
        } catch (Exception e) {
            logger.error("Failed to fetch weather for airport {}: {}", code, e.getMessage());
        }

        return getSimulatedWeather();
    }

    private double getDoubleValue(Object obj, double defaultValue) {
        if (obj == null) return defaultValue;
        if (obj instanceof Number) return ((Number) obj).doubleValue();
        return defaultValue;
    }

    private int getIntValue(Object obj, int defaultValue) {
        if (obj == null) return defaultValue;
        if (obj instanceof Number) return ((Number) obj).intValue();
        return defaultValue;
    }

    private String getWeatherDescription(int code) {
        return switch (code) {
            case 0 -> "Clear sky";
            case 1, 2, 3 -> "Partly cloudy";
            case 45, 48 -> "Foggy";
            case 51, 53, 55 -> "Drizzle";
            case 56, 57 -> "Freezing drizzle";
            case 61, 63 -> "Light rain";
            case 65 -> "Heavy rain";
            case 66, 67 -> "Freezing rain";
            case 71, 73, 75 -> "Snowfall";
            case 77 -> "Snow grains";
            case 80, 81, 82 -> "Rain showers";
            case 85, 86 -> "Snow showers";
            case 95 -> "Thunderstorm";
            case 96, 99 -> "Thunderstorm with hail";
            default -> "Overcast";
        };
    }

    private WeatherImpact getWeatherImpact(int code, double windSpeed, double precipitation) {
        String level = "Low";
        double multiplier = 1.0;
        String reason = "Clear weather conditions";

        if (code == 95 || code == 96 || code == 99 || code == 82 || code == 86 || code == 75 || code == 67 || code == 65) {
            level = "High";
            multiplier = 1.25;
            reason = "Severe weather detected (" + getWeatherDescription(code) + ")";
        } else if (code == 56 || code == 57 || code == 66 || code == 71 || code == 73 || code == 77 || code == 85 || windSpeed > 30.0) {
            level = "High";
            multiplier = 1.20;
            reason = String.format("Adverse weather or high winds (%.1f km/h)", windSpeed);
        } else if (code == 51 || code == 53 || code == 55 || code == 61 || code == 63 || code == 80 || code == 81 || windSpeed > 15.0 || precipitation > 0.5) {
            level = "Medium";
            multiplier = 1.10;
            reason = "Moderate rain/wind conditions";
        }

        return new WeatherImpact(level, multiplier, reason);
    }

    private WeatherData getSimulatedWeather() {
        return new WeatherData(
            20.0, 20.0, 50.0, 0.0, 0.0, 0.0, 0.0, 5.0, 0,
            "Clear sky (Simulated)", "Low", 1.0, "Clear weather conditions (Simulated)"
        );
    }

    private record WeatherImpact(String level, double multiplier, String reason) {}
    private record CachedWeather(WeatherData data, long timestamp) {}
}

// Logging weather fetch exceptions
