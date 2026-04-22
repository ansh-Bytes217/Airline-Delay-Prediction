package com.skypredict.backend.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public record WeatherData(
    double temp,
    @JsonProperty("temp_apparent") double tempApparent,
    double humidity,
    double precipitation,
    double rain,
    double showers,
    double snowfall,
    @JsonProperty("wind_speed") double windSpeed,
    @JsonProperty("weather_code") int weatherCode,
    String description,
    String impact,
    double multiplier,
    String reason
) {}
