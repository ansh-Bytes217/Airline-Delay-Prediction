package com.skypredict.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

@Service
public class SmsService {
    private static final Logger logger = LoggerFactory.getLogger(SmsService.class);
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${twilio.account.sid:ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX}")
    private String accountSid;

    @Value("${twilio.auth.token:your_auth_token_here}")
    private String authToken;

    @Value("${twilio.phone.number:+15017122661}")
    private String fromNumber;

    @Value("${twilio.recipient.phone:+1234567890}")
    private String toNumber;

    @Async
    public void sendDelayAlertAsync(String airline, String origin, String destination, double probability) {
        if ("ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX".equals(accountSid) || "your_auth_token_here".equals(authToken)) {
            logger.warn("Twilio credentials not configured. Skipping SMS alert dispatch (Mock Mode).");
            logger.info("MOCK SMS DISPATCHED TO {}: High delay risk alert for {} from {} to {}. Delay probability: {}%", 
                    toNumber, airline, origin, destination, Math.round(probability * 100));
            return;
        }

        String url = "https://api.twilio.com/2010-04-01/Accounts/" + accountSid + "/Messages.json";
        try {
            logger.info("Sending Twilio SMS alert for high delay risk to {}...", toNumber);
            
            // Build Basic Authentication Header
            String auth = accountSid + ":" + authToken;
            byte[] encodedAuth = Base64.getEncoder().encode(auth.getBytes(StandardCharsets.US_ASCII));
            String authHeader = "Basic " + new String(encodedAuth);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            headers.set("Authorization", authHeader);

            // Form parameters
            MultiValueMap<String, String> map = new LinkedMultiValueMap<>();
            map.add("From", fromNumber);
            map.add("To", toNumber);
            
            String messageText = String.format(
                "🚨 SkyPredict Alert: High flight disruption risk detected! Flight %s from %s to %s has a %d%% probability of delay. Plan ahead!",
                airline, origin, destination, Math.round(probability * 100)
            );
            map.add("Body", messageText);

            HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(map, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                logger.info("Twilio SMS successfully dispatched. Response status: {}", response.getStatusCode());
            } else {
                logger.error("Twilio SMS request failed with status: {}, response: {}", response.getStatusCode(), response.getBody());
            }
        } catch (Exception e) {
            logger.error("Failed to send Twilio SMS alert: {}", e.getMessage());
        }
    }
}
