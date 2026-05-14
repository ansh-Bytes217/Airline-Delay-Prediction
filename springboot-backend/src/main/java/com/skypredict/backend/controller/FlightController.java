package com.skypredict.backend.controller;

import com.skypredict.backend.model.Flight;
import com.skypredict.backend.model.PredictRequest;
import com.skypredict.backend.model.PredictResponse;
import com.skypredict.backend.model.WeatherData;
import com.skypredict.backend.service.FlightService;
import com.skypredict.backend.service.PredictionService;
import com.skypredict.backend.service.WeatherService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.Map;

@RestController
@CrossOrigin(originPatterns = "*", allowCredentials = "true")
public class FlightController {
    private static final Logger logger = LoggerFactory.getLogger(FlightController.class);

    private final WeatherService weatherService;
    private final FlightService flightService;
    private final PredictionService predictionService;

    public FlightController(WeatherService weatherService, FlightService flightService, PredictionService predictionService) {
        this.weatherService = weatherService;
        this.flightService = flightService;
        this.predictionService = predictionService;
    }

    @GetMapping("/weather/{airport}")
    public ResponseEntity<Map<String, Object>> getWeather(@PathVariable String airport) {
        logger.info("GET /weather/{}", airport);
        WeatherData weather = weatherService.getWeatherForAirport(airport);
        
        Map<String, Object> response = new HashMap<>();
        response.put("airport", airport.toUpperCase());
        response.put("coords", WeatherService.AIRPORT_COORDS.getOrDefault(airport.toUpperCase(), new double[]{0, 0}));
        response.put("weather", weather);
        
        return ResponseEntity.ok(response);
    }

    @GetMapping("/flights")
    public ResponseEntity<Map<String, Object>> getFlights() {
        logger.info("GET /flights");
        return ResponseEntity.ok(flightService.getFlights());
    }

    @PostMapping("/predict")
    public ResponseEntity<PredictResponse> predict(@RequestBody PredictRequest request) {
        logger.info("POST /predict for airline {}", request.airline());
        
        // Fetch weather if not provided in the request
        WeatherData weather = request.weather();
        if (weather == null) {
            weather = weatherService.getWeatherForAirport(request.airportFrom());
        }
        
        // Create request with weather injected
        PredictRequest enrichedRequest = new PredictRequest(
            request.airline(),
            request.airportFrom(),
            request.airportTo(),
            request.dayOfWeek(),
            request.time(),
            request.length(),
            request.model(),
            weather,
            request.flightNotes()
        );
        
        PredictResponse response = predictionService.predict(enrichedRequest);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/predict/ab")
    public ResponseEntity<Map<String, Object>> predictAb(@RequestBody PredictRequest request) {
        logger.info("POST /predict/ab for airline {}", request.airline());
        
        WeatherData weather = request.weather();
        if (weather == null) {
            weather = weatherService.getWeatherForAirport(request.airportFrom());
        }
        
        PredictRequest enrichedRequest = new PredictRequest(
            request.airline(),
            request.airportFrom(),
            request.airportTo(),
            request.dayOfWeek(),
            request.time(),
            request.length(),
            request.model(),
            weather,
            request.flightNotes()
        );
        
        Map<String, Object> response = predictionService.predictAb(enrichedRequest);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/chat")
    public ResponseEntity<Map<String, Object>> chat(@RequestBody Map<String, String> body) {
        String message = body.getOrDefault("message", "");
        logger.info("POST /chat: {}", message);
        return ResponseEntity.ok(predictionService.chat(message));
    }

    @PostMapping("/upload-doc")
    public ResponseEntity<Map<String, Object>> uploadDoc(@RequestParam("file") MultipartFile file) {
        logger.info("POST /upload-doc: {}", file.getOriginalFilename());
        return ResponseEntity.ok(predictionService.uploadDoc(file));
    }

    @GetMapping("/monitoring/drift")
    public ResponseEntity<Map<String, Object>> getDrift() {
        logger.info("GET /monitoring/drift");
        return ResponseEntity.ok(predictionService.getDriftMetrics());
    }

    @GetMapping("/analytics")
    public ResponseEntity<Map<String, Object>> getAnalytics() {
        logger.info("GET /analytics");
        return ResponseEntity.ok(predictionService.getAnalytics());
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> getHealth() {
        logger.info("GET /health");
        return ResponseEntity.ok(predictionService.getHealth());
    }
}

// Request validator safety helper
