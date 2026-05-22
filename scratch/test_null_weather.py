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
    "weather": None,
    "flight_notes": ""
}

print("Testing gateway with weather: null...")
try:
    r = httpx.post("http://127.0.0.1:8080/predict", json=payload, timeout=10.0)
    print(f"Status: {r.status_code}")
    print(json.dumps(r.json(), indent=2))
except Exception as e:
    print(f"Failed: {e}")
