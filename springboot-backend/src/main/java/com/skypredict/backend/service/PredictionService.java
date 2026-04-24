package com.skypredict.backend.service;

import com.skypredict.backend.model.PredictRequest;
import com.skypredict.backend.model.PredictResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

@Service
public class PredictionService {
    private static final Logger logger = LoggerFactory.getLogger(PredictionService.class);
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${python.ml.service.url:http://127.0.0.1:8090}")
    private String pythonServiceUrl;

    public PredictResponse predict(PredictRequest request) {
        String url = pythonServiceUrl + "/predict";
        try {
            logger.info("Forwarding /predict request to Python ML sidecar at {}", url);
            ResponseEntity<PredictResponse> response = restTemplate.postForEntity(url, request, PredictResponse.class);
            return response.getBody();
        } catch (Exception e) {
            logger.error("Failed to fetch prediction from Python sidecar: {}", e.getMessage());
            throw new RuntimeException("ML Sidecar Error: " + e.getMessage(), e);
        }
    }

    public Map<String, Object> predictAb(PredictRequest request) {
        String url = pythonServiceUrl + "/predict/ab";
        try {
            logger.info("Forwarding /predict/ab request to Python ML sidecar at {}", url);
            ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);
            return response.getBody();
        } catch (Exception e) {
            logger.error("Failed to fetch A/B prediction from Python sidecar: {}", e.getMessage());
            throw new RuntimeException("ML Sidecar Error: " + e.getMessage(), e);
        }
    }

    public Map<String, Object> chat(String message) {
        String url = pythonServiceUrl + "/chat";
        try {
            logger.info("Forwarding /chat request to Python RAG sidecar at {}", url);
            Map<String, String> request = new HashMap<>();
            request.put("message", message);
            ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);
            return response.getBody();
        } catch (Exception e) {
            logger.error("Failed to query RAG chatbot from Python sidecar: {}", e.getMessage());
            Map<String, Object> error = new HashMap<>();
            error.put("answer", "RAG Pipeline Sidecar is currently unavailable. Please check backend logs.");
            error.put("sources", new String[]{});
            return error;
        }
    }

    public Map<String, Object> uploadDoc(MultipartFile file) {
        String url = pythonServiceUrl + "/upload-doc";
        try {
            logger.info("Forwarding document upload to Python RAG sidecar at {}", url);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            ByteArrayResource fileResource = new ByteArrayResource(file.getBytes()) {
                @Override
                public String getFilename() {
                    return file.getOriginalFilename();
                }
            };
            body.add("file", fileResource);

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
            ResponseEntity<Map> response = restTemplate.postForEntity(url, requestEntity, Map.class);
            return response.getBody();
        } catch (IOException e) {
            logger.error("Failed to read upload file bytes: {}", e.getMessage());
            throw new RuntimeException("File Reading Error: " + e.getMessage(), e);
        } catch (Exception e) {
            logger.error("Failed to forward upload to Python sidecar: {}", e.getMessage());
            throw new RuntimeException("ML Sidecar File Upload Error: " + e.getMessage(), e);
        }
    }

    public Map<String, Object> getDriftMetrics() {
        String url = pythonServiceUrl + "/monitoring/drift";
        try {
            logger.info("Fetching MLOps drift metrics from Python sidecar at {}", url);
            return restTemplate.getForObject(url, Map.class);
        } catch (Exception e) {
            logger.error("Failed to fetch drift metrics from Python sidecar: {}", e.getMessage());
            Map<String, Object> error = new HashMap<>();
            error.put("status", "error");
            error.put("message", "MLOps sidecar unavailable: " + e.getMessage());
            error.put("features", new HashMap<>());
            error.put("drift_detected", false);
            return error;
        }
    }

    public Map<String, Object> getAnalytics() {
        String url = pythonServiceUrl + "/analytics";
        try {
            logger.info("Fetching model analytics from Python sidecar at {}", url);
            return restTemplate.getForObject(url, Map.class);
        } catch (Exception e) {
            logger.error("Failed to fetch analytics from Python sidecar: {}", e.getMessage());
            // Fallback to basic empty analytics DTO
            Map<String, Object> fallback = new HashMap<>();
            fallback.put("total_predictions", 0);
            fallback.put("overall_delay_rate", 0.0);
            fallback.put("avg_probability", 0.0);
            fallback.put("airline_delay_rates", new String[]{});
            fallback.put("hourly_trend", new String[]{});
            fallback.put("recent", new String[]{});
            fallback.put("note", "ML Sidecar unavailable. Real analytics currently offline.");
            return fallback;
        }
    }

    public Map<String, Object> getHealth() {
        String url = pythonServiceUrl + "/health";
        Map<String, Object> health = new HashMap<>();
        try {
            Map sidecarHealth = restTemplate.getForObject(url, Map.class);
            health.put("status", "ok");
            health.put("python_sidecar", sidecarHealth);
        } catch (Exception e) {
            health.put("status", "degraded");
            health.put("python_sidecar", Map.of("status", "offline", "error", e.getMessage()));
        }
        return health;
    }
}
