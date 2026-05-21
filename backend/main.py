from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import logging
import time
import random
import httpx
import os

# ── RAG Pipeline ─────────────────────────────────────────────────────────────
try:
    from rag_pipeline import ask_question, init_rag_pipeline
    RAG_AVAILABLE = True
except ImportError as e:
    logging.warning(f"RAG dependencies not met: {e}")
    RAG_AVAILABLE = False

# ── ML Libraries ─────────────────────────────────────────────────────────────
try:
    import pandas as pd
    import numpy as np
    import joblib
    import shap
    HAS_ML_LIBS = True
except ImportError:
    HAS_ML_LIBS = False
    logging.warning("ML libs not found. Mock predictions will be used.")

# ── DistilBERT Text Risk Classifier ──────────────────────────────────────────
_text_classifier = None
def _get_text_classifier():
    global _text_classifier
    if _text_classifier is None:
        try:
            from transformers import pipeline as hf_pipeline
            _text_classifier = hf_pipeline(
                "text-classification",
                model="distilbert-base-uncased-finetuned-sst-2-english",
                top_k=None
            )
            logging.info("DistilBERT text risk classifier loaded.")
        except Exception as e:
            logging.warning(f"DistilBERT load failed: {e}")
    return _text_classifier

def extract_text_risk_score(flight_notes: str) -> float:
    """
    Run DistilBERT sentiment classifier on flight notes.
    Negative sentiment (storms, delays, alerts) maps to a high disruption risk score.
    Returns a float in [0, 1] representing the probability of disruption.
    """
    if not flight_notes or not flight_notes.strip():
        return 0.35  # baseline mean disruption probability
    try:
        clf = _get_text_classifier()
        if clf is None:
            return 0.35
        results = clf(flight_notes[:512])[0]  # truncate for transformer
        # results is a list like [{'label': 'NEGATIVE', 'score': 0.98}, ...]
        neg_score = next((r['score'] for r in results if r['label'] == 'NEGATIVE'), 0.35)
        return round(float(neg_score), 4)
    except Exception as e:
        logging.warning(f"Text risk extraction failed: {e}")
        return 0.35

# ── Model Monitor ─────────────────────────────────────────────────────────────
try:
    from model_monitor import log_prediction, get_monitoring_stats, get_feature_drift
    MONITOR_AVAILABLE = True
except ImportError:
    MONITOR_AVAILABLE = False

# ── Rate Limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

# ── Weather Integration (Open-Meteo) ──────────────────────────────────────────
AIRPORT_COORDS = {
    'ATL': {'lat': 33.6407, 'lon': -84.4277},
    'ORD': {'lat': 41.9742, 'lon': -87.9073},
    'DFW': {'lat': 32.8998, 'lon': -97.0403},
    'DEN': {'lat': 39.8561, 'lon': -104.6737},
    'LAX': {'lat': 33.9416, 'lon': -118.4085},
    'SFO': {'lat': 37.6213, 'lon': -122.3790},
    'LAS': {'lat': 36.0840, 'lon': -115.1537},
    'PHX': {'lat': 33.4352, 'lon': -112.0101},
    'MCO': {'lat': 28.4281, 'lon': -81.3060},
    'IAH': {'lat': 29.9902, 'lon': -95.3368},
    'JFK': {'lat': 40.6413, 'lon': -73.7781},
    'SEA': {'lat': 47.4502, 'lon': -122.3088},
    'MIA': {'lat': 25.7959, 'lon': -80.2870},
    'EWR': {'lat': 40.6895, 'lon': -74.1745},
    'BOS': {'lat': 42.3656, 'lon': -71.0096},
}

async def fetch_weather(lat: float, lon: float):
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m"
    async with httpx.AsyncClient(timeout=5.0) as client:
        r = await client.get(url)
        if r.status_code == 200:
            data = r.json()
            curr = data.get("current", {})
            return {
                "temp": curr.get("temperature_2m", 20.0),
                "temp_apparent": curr.get("apparent_temperature", 20.0),
                "humidity": curr.get("relative_humidity_2m", 50.0),
                "precipitation": curr.get("precipitation", 0.0),
                "rain": curr.get("rain", 0.0),
                "showers": curr.get("showers", 0.0),
                "snowfall": curr.get("snowfall", 0.0),
                "wind_speed": curr.get("wind_speed_10m", 0.0),
                "weather_code": curr.get("weather_code", 0)
            }
    raise Exception(f"Weather API returned status {r.status_code}")

def get_weather_description(code: int) -> str:
    if code == 0: return "Clear sky"
    elif code in [1, 2, 3]: return "Partly cloudy"
    elif code in [45, 48]: return "Foggy"
    elif code in [51, 53, 55]: return "Drizzle"
    elif code in [56, 57]: return "Freezing drizzle"
    elif code in [61, 63]: return "Light rain"
    elif code in [65]: return "Heavy rain"
    elif code in [66, 67]: return "Freezing rain"
    elif code in [71, 73, 75]: return "Snowfall"
    elif code in [77]: return "Snow grains"
    elif code in [80, 81, 82]: return "Rain showers"
    elif code in [85, 86]: return "Snow showers"
    elif code in [95]: return "Thunderstorm"
    elif code in [96, 99]: return "Thunderstorm with hail"
    return "Overcast"

def get_weather_impact(weather_data: dict) -> dict:
    code = weather_data.get("weather_code", 0)
    wind = weather_data.get("wind_speed", 0.0)
    precip = weather_data.get("precipitation", 0.0)
    
    impact = "Low"
    multiplier = 1.0
    reason = "Clear weather conditions"
    
    if code in [95, 96, 99, 82, 86, 75, 67, 65]:
        impact = "High"
        multiplier = 1.25
        reason = f"Severe weather detected ({get_weather_description(code)})"
    elif code in [56, 57, 66, 71, 73, 77, 85] or wind > 30.0:
        impact = "High"
        multiplier = 1.20
        reason = f"Adverse weather or high winds ({wind} km/h)"
    elif code in [51, 53, 55, 61, 63, 80, 81] or wind > 15.0 or precip > 0.5:
        impact = "Medium"
        multiplier = 1.10
        reason = f"Moderate rain/wind conditions"
        
    return {
        "impact": impact,
        "multiplier": multiplier,
        "reason": reason
    }

# ── Pydantic Models ───────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str

class WeatherData(BaseModel):
    temp: float
    temp_apparent: float
    humidity: float
    precipitation: float
    rain: float
    showers: float
    snowfall: float
    wind_speed: float
    weather_code: int
    description: str
    impact: str
    multiplier: float
    reason: str

class FlightData(BaseModel):
    Airline: str
    AirportFrom: str
    AirportTo: str
    DayOfWeek: int
    Time: int
    Length: int
    model: str = "ensemble"
    weather: WeatherData = None
    flight_notes: str = ""   # Optional unstructured text for DistilBERT risk extraction

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="SkyPredict API",
    description="Airline Delay Prediction + RAG Chatbot + Live Flights + Analytics",
    version="2.0.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    logging.basicConfig(level=logging.INFO)
    logging.info("SkyPredict API v2.0 started")

# ── Model Loading ─────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
MODEL_PATH    = os.path.join(BASE_DIR, "best_model.pkl")
XGB_PATH      = os.path.join(BASE_DIR, "xgb_model.pkl")
CAT_PATH      = os.path.join(BASE_DIR, "cat_model.pkl")

model = xgb_model = cat_model = None
if HAS_ML_LIBS:
    for path, name in [(MODEL_PATH, "ensemble"), (XGB_PATH, "xgboost"), (CAT_PATH, "catboost")]:
        if os.path.exists(path):
            try:
                loaded = joblib.load(path)
                if name == "ensemble": model = loaded
                elif name == "xgboost": xgb_model = loaded
                elif name == "catboost": cat_model = loaded
                logging.info(f"Loaded {name} model from {path}")
            except Exception as e:
                logging.warning(f"Could not load {name}: {e}")
    if model is None and (xgb_model or cat_model):
        model = xgb_model or cat_model

# ── Flight Cache ──────────────────────────────────────────────────────────────
_flight_cache: dict = {"data": None, "timestamp": 0}
FLIGHT_CACHE_TTL = 15

SIMULATED_FLIGHTS = [
    {"icao24": f"sim{i:03d}",
     "callsign": random.choice(["AAL","DAL","UAL","SWA","BAW","AFR","DLH","UAE","SIA","QFA","CCA","JAL","KLM","THY"]) + str(100 + i * 7),
     "lat": round(-60 + (i * 2.47) % 140, 4),
     "lon": round(-180 + (i * 3.71) % 360, 4),
     "altitude": round(15000 + (i * 1234) % 25000),
     "speed": round(350 + (i * 17) % 200),
     "heading": round((i * 53) % 360),
     "country": random.choice(["United States","United Kingdom","Germany","France","UAE","Australia","Japan","China","India","Brazil","Canada","Singapore"]),
     "on_ground": False}
    for i in range(200)
]

# ── Feature Engineering ───────────────────────────────────────────────────────
def feature_engineering_single_row(data_dict, text_risk_score: float = 0.35):
    df = pd.DataFrame([data_dict])
    if "Time" in df.columns:
        df["Departure_Hour"] = (df["Time"] // 60).astype(int)
        df["Departure_TimeOfDay"] = pd.cut(
            df["Departure_Hour"], bins=[0,6,12,18,24],
            labels=["Night","Morning","Afternoon","Evening"], right=False
        )
    if "DayOfWeek" in df.columns:
        df["Is_Weekend"] = df["DayOfWeek"].apply(lambda x: 1 if x >= 6 else 0)
    if "Length" in df.columns:
        df["Flight_Duration_Cat"] = pd.cut(
            df["Length"], bins=[0,60,180,360,np.inf],
            labels=["Short","Medium","Long","Very Long"]
        )
    busy = ["ATL","ORD","DFW","DEN","LAX","SFO","LAS","PHX","MCO","IAH"]
    if "AirportFrom" in df.columns:
        df["Is_Busy_Airport"] = df["AirportFrom"].apply(lambda x: 1 if x in busy else 0)
    # 🧬 Inject DistilBERT text risk score as a tabular feature
    df["Text_Risk_Score"] = text_risk_score
    return df

def _run_model(m, df):
    prediction = int(m.predict(df)[0])
    try:
        probability = float(m.predict_proba(df)[0][1])
    except Exception:
        probability = 1.0 if prediction == 1 else 0.0

    shap_explanation = []
    try:
        classifier = m.named_steps["classifier"]
        preprocessor = m.named_steps["preprocessor"]
        X_transformed = preprocessor.transform(df)
        if not isinstance(X_transformed, np.ndarray):
            X_transformed = X_transformed.toarray()
        explainer = shap.TreeExplainer(classifier)
        shap_values = explainer.shap_values(X_transformed)
        if isinstance(shap_values, list):
            shap_values = shap_values[1]
        num_cols = df.select_dtypes(include=["int64","float64","int32"]).columns.tolist()
        cat_cols = df.select_dtypes(include=["object","category","string"]).columns.tolist()
        cat_enc = preprocessor.named_transformers_["cat"]
        cat_feats = cat_enc.get_feature_names_out(cat_cols) if hasattr(cat_enc, "get_feature_names_out") else cat_enc.get_feature_names(cat_cols)
        feature_names = np.concatenate([num_cols, cat_feats])
        shap_dict = dict(zip(feature_names, shap_values[0]))
        sorted_shap = sorted(shap_dict.items(), key=lambda x: abs(x[1]), reverse=True)
        shap_explanation = [{"feature": k.replace("x0_","").replace("x1_",""), "value": float(v)} for k,v in sorted_shap[:5]]
    except Exception as e:
        logging.warning(f"SHAP failed: {e}")

    return prediction, probability, shap_explanation

# ── /weather/{airport} ────────────────────────────────────────────────────────
@app.get("/weather/{airport}")
async def get_airport_weather(airport: str):
    airport = airport.upper()
    if airport not in AIRPORT_COORDS:
        raise HTTPException(status_code=404, detail=f"Airport {airport} coordinates not mapped.")
    try:
        coords = AIRPORT_COORDS[airport]
        w = await fetch_weather(coords['lat'], coords['lon'])
        desc = get_weather_description(w['weather_code'])
        imp = get_weather_impact(w)
        return {
            "airport": airport,
            "coords": coords,
            "weather": {
                **w,
                "description": desc,
                **imp
            }
        }
    except Exception as e:
        logging.warning(f"Failed to fetch weather for {airport}: {e}")
        return {
            "airport": airport,
            "coords": AIRPORT_COORDS.get(airport, {"lat": 0, "lon": 0}),
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
                "description": "Clear sky (Simulated)",
                "impact": "Low",
                "multiplier": 1.0,
                "reason": "Clear weather conditions (Simulated)"
            }
        }

# ── /predict ─────────────────────────────────────────────────────────────────
@app.post("/predict")
@limiter.limit("30/minute")
async def predict_delay(request: Request, flight: FlightData):
    data_dict = flight.model_dump()
    chosen_model_name = data_dict.pop("model", "ensemble")
    weather_input = data_dict.pop("weather", None)

    # Fetch weather if not provided
    if not weather_input:
        airport = data_dict.get("AirportFrom", "").upper()
        if airport in AIRPORT_COORDS:
            try:
                coords = AIRPORT_COORDS[airport]
                w = await fetch_weather(coords['lat'], coords['lon'])
                desc = get_weather_description(w['weather_code'])
                imp = get_weather_impact(w)
                weather_input = {
                    **w,
                    "description": desc,
                    **imp
                }
            except Exception:
                pass

    if not HAS_ML_LIBS or model is None:
        is_delayed = random.choice([0, 1])
        prob = random.uniform(0.5, 0.99) if is_delayed else random.uniform(0.01, 0.49)
        if weather_input:
            prob = min(prob * weather_input.get("multiplier", 1.0), 0.99)
            is_delayed = 1 if prob >= 0.5 else 0
        return {
            "prediction": is_delayed,
            "probability": prob,
            "shap_values": [],
            "model_used": "mock",
            "status": "success",
            "message": "Mock prediction" + (" with weather adjustment" if weather_input and weather_input.get("multiplier", 1.0) > 1.0 else ""),
            "weather": weather_input
        }

    try:
        flight_notes = data_dict.pop("flight_notes", "")
        text_risk_score = extract_text_risk_score(flight_notes)
        df = feature_engineering_single_row(data_dict, text_risk_score=text_risk_score)
        chosen = {"xgboost": xgb_model, "catboost": cat_model}.get(chosen_model_name) or model
        if chosen is None:
            chosen = model
        prediction, probability, shap_explanation = _run_model(chosen, df)

        if weather_input:
            multiplier = weather_input.get("multiplier", 1.0)
            probability = min(probability * multiplier, 0.99)
            prediction = 1 if probability >= 0.5 else 0

        if MONITOR_AVAILABLE:
            log_prediction(data_dict, prediction, probability)

        return {
            "prediction": prediction,
            "probability": probability,
            "shap_values": shap_explanation,
            "model_used": chosen_model_name,
            "status": "success",
            "message": f"Prediction from {chosen_model_name} model" + (" with weather adjustment" if weather_input and weather_input.get("multiplier", 1.0) > 1.0 else ""),
            "weather": weather_input
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── /predict/ab — side-by-side comparison ────────────────────────────────────
@app.post("/predict/ab")
@limiter.limit("20/minute")
async def predict_ab(request: Request, flight: FlightData):
    data_dict = flight.model_dump()
    data_dict.pop("model", None)
    weather_input = data_dict.pop("weather", None)

    # Fetch weather if not provided
    if not weather_input:
        airport = data_dict.get("AirportFrom", "").upper()
        if airport in AIRPORT_COORDS:
            try:
                coords = AIRPORT_COORDS[airport]
                w = await fetch_weather(coords['lat'], coords['lon'])
                desc = get_weather_description(w['weather_code'])
                imp = get_weather_impact(w)
                weather_input = {
                    **w,
                    "description": desc,
                    **imp
                }
            except Exception:
                pass

    if not HAS_ML_LIBS or model is None:
        def mock():
            is_delayed = random.choice([0,1])
            prob = random.uniform(0.3,0.99)
            if weather_input:
                prob = min(prob * weather_input.get("multiplier", 1.0), 0.99)
                is_delayed = 1 if prob >= 0.5 else 0
            return {
                "prediction": is_delayed,
                "probability": round(prob, 3),
                "shap_values": [],
                "weather": weather_input
            }
        return {"xgboost": mock(), "catboost": mock(), "ensemble": mock()}

    try:
        flight_notes = data_dict.pop("flight_notes", "")
        text_risk_score = extract_text_risk_score(flight_notes)
        df = feature_engineering_single_row(data_dict, text_risk_score=text_risk_score)
        results = {}
        for name, m in [("xgboost", xgb_model), ("catboost", cat_model), ("ensemble", model)]:
            if m is not None:
                pred, prob, shap = _run_model(m, df)
                if weather_input:
                    multiplier = weather_input.get("multiplier", 1.0)
                    prob = min(prob * multiplier, 0.99)
                    pred = 1 if prob >= 0.5 else 0
                results[name] = {
                    "prediction": pred,
                    "probability": prob,
                    "shap_values": shap,
                    "weather": weather_input
                }
            else:
                results[name] = None
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── /chat ────────────────────────────────────────────────────────────────────
@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    if not RAG_AVAILABLE:
        raise HTTPException(status_code=501, detail="RAG Pipeline not available.")
    question = req.message
    answer, sources = ask_question(question)
    formatted_sources = []
    for s in sources:
        clean = s[:150].replace("\n", " ") + "..."
        if clean not in formatted_sources:
            formatted_sources.append(clean)
    return {"answer": answer, "sources": formatted_sources}

# ── /upload-doc — dynamic RAG document ingestion ─────────────────────────────
@app.post("/upload-doc")
async def upload_document(file: UploadFile = File(...)):
    if not RAG_AVAILABLE:
        raise HTTPException(status_code=501, detail="RAG Pipeline not available.")
    allowed = {".txt", ".pdf", ".md"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"File type {ext} not supported. Use: {allowed}")

    docs_dir = os.path.join(os.path.dirname(__file__), "docs")
    os.makedirs(docs_dir, exist_ok=True)
    save_path = os.path.join(docs_dir, file.filename)

    content = await file.read()
    with open(save_path, "wb") as f:
        f.write(content)

    # Re-initialise RAG to include the new doc
    try:
        from rag_pipeline import init_rag_pipeline
        # Reset so next query reinitialises with all docs
        import rag_pipeline as rp
        if hasattr(rp, "retriever"):
            rp.retriever = None
        init_rag_pipeline()
        return {"status": "success", "message": f"Document '{file.filename}' ingested into RAG knowledge base.", "filename": file.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Document saved but RAG re-init failed: {e}")

# ── /monitoring/drift — KS statistical drift detection ──────────────────────
@app.get("/monitoring/drift")
async def drift_endpoint():
    if not MONITOR_AVAILABLE:
        raise HTTPException(status_code=501, detail="Monitor not available.")
    return get_feature_drift()

# ── /analytics ───────────────────────────────────────────────────────────────
@app.get("/analytics")
async def analytics():
    if MONITOR_AVAILABLE:
        stats = get_monitoring_stats()
        if stats:
            return stats

    # Seeded demo data when no real predictions logged yet
    airlines = ["WN","AA","DL","UA","B6","AS","NK","F9","MQ","OO"]
    return {
        "total_predictions": 248,
        "overall_delay_rate": 42.3,
        "avg_probability": 0.461,
        "airline_delay_rates": [
            {"airline": a, "delay_rate": round(random.uniform(25, 68), 1), "total": random.randint(10,40)}
            for a in airlines
        ],
        "hourly_trend": [
            {"hour": h, "delay_rate": round(20 + 30 * abs((h-6)/12 if h<18 else (h-18)/12), 1)}
            for h in range(0, 24, 2)
        ],
        "recent": [],
        "note": "Demo data — make predictions to see real analytics",
    }

# ── /flights ─────────────────────────────────────────────────────────────────
@app.get("/flights")
async def get_flights():
    global _flight_cache
    now = time.time()
    if _flight_cache["data"] and (now - _flight_cache["timestamp"]) < FLIGHT_CACHE_TTL:
        return _flight_cache["data"]
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                "https://opensky-network.org/api/states/all"
            )
        if resp.status_code == 200:
            states = resp.json().get("states") or []
            flights = [
                {"icao24": s[0], "callsign": (s[1] or "").strip() or s[0],
                 "lat": round(s[6], 4), "lon": round(s[5], 4),
                 "altitude": round(s[7] * 3.281) if s[7] else 0,
                 "speed": round(s[9] * 1.944) if s[9] else 0,
                 "heading": round(s[10]) if s[10] else 0,
                 "country": s[2] or "Unknown", "on_ground": bool(s[8])}
                for s in states if s[5] and s[6] and not bool(s[8])  # airborne only
            ]
            if flights:
                result = {"source": "opensky", "count": len(flights), "cached_at": now, "flights": flights[:500]}
                _flight_cache = {"data": result, "timestamp": now}
                return result
    except Exception as e:
        logging.warning(f"OpenSky error: {e}")
    result = {"source": "simulated", "count": len(SIMULATED_FLIGHTS), "cached_at": now, "flights": SIMULATED_FLIGHTS}
    _flight_cache = {"data": result, "timestamp": now}
    return result

# ── /health ───────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "ok",
        "rag": RAG_AVAILABLE,
        "ml": HAS_ML_LIBS and model is not None,
        "monitor": MONITOR_AVAILABLE,
        "models": {
            "ensemble": model is not None,
            "xgboost": xgb_model is not None,
            "catboost": cat_model is not None,
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
