package com.skypredict.backend.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public record PredictRequest(
    @JsonProperty("Airline") String airline,
    @JsonProperty("AirportFrom") String airportFrom,
    @JsonProperty("AirportTo") String airportTo,
    @JsonProperty("DayOfWeek") int dayOfWeek,
    @JsonProperty("Time") int time,
    @JsonProperty("Length") int length,
    String model,
    WeatherData weather,
    @JsonProperty("flight_notes") String flightNotes
) {}
