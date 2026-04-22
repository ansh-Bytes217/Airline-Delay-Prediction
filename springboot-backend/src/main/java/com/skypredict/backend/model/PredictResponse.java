package com.skypredict.backend.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record PredictResponse(
    int prediction,
    double probability,
    @JsonProperty("shap_values") List<ShapValue> shapValues,
    @JsonProperty("model_used") String modelUsed,
    String status,
    String message,
    WeatherData weather
) {
    public record ShapValue(String feature, double value) {}
}
