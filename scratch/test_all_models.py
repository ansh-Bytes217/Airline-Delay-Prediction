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

models = ["ensemble", "xgboost", "catboost", "nn"]
for m in models:
    payload["model"] = m
    print(f"\n--- Testing model: {m} ---")
    try:
        r = httpx.post("http://127.0.0.1:8080/predict", json=payload, timeout=10.0)
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            res = r.json()
            print(f"Prediction: {res.get('prediction')}, Probability: {res.get('probability')}, Model used: {res.get('model_used')}")
        else:
            print(f"Error: {r.text}")
    except Exception as e:
        print(f"Failed: {e}")

print("\n--- Testing A/B Compare ---")
try:
    r = httpx.post("http://127.0.0.1:8080/predict/ab", json=payload, timeout=10.0)
    print(f"Status: {r.status_code}")
    if r.status_code == 200:
        res = r.json()
        for k, v in res.items():
            if v:
                print(f"  {k}: prediction={v.get('prediction')}, probability={v.get('probability')}")
            else:
                print(f"  {k}: None")
    else:
        print(f"Error: {r.text}")
except Exception as e:
    print(f"Failed: {e}")

# Monitor loading dataset verification validations
