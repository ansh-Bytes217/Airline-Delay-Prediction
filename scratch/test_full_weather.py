import httpx
import json

payload = {
    "Airline": "WN",
    "AirportFrom": "ATL",
    "AirportTo": "DFW",
    "DayOfWeek": 1,
    "Time": 360,
    "Length": 120,
    "model": "ensemble",
    "flight_notes": "",
    "weather": {
        "temp": 20.0,
        "temp_apparent": 20.0,
        "humidity": 50.0,
        "precipitation": 0.0,
        "rain": 0.0,
        "showers": 0.0,
        "snowfall": 0.0,
        "wind_speed": 5.0,
        "weather_code": 0,
        "description": "Clear sky",
        "impact": "Low",
        "multiplier": 1.0,
        "reason": "Clear weather conditions"
    }
}

print("Testing gateway with full weather object...")
try:
    r = httpx.post("http://127.0.0.1:8080/predict", json=payload, timeout=10.0)
    print(f"Status: {r.status_code}")
    print(json.dumps(r.json(), indent=2))
except Exception as e:
    print(f"Failed: {e}")
