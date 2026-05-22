package com.skypredict.backend.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public record Flight(
    String icao24,
    String callsign,
    double lat,
    double lon,
    int altitude,
    int speed,
    int heading,
    String country,
    @JsonProperty("on_ground") boolean onGround
) {}
