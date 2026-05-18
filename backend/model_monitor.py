"""
Model Monitoring — production-grade with KS-test statistical drift detection.
Logs every prediction and compares live feature distributions against the
training baseline via Kolmogorov-Smirnov two-sample test (scipy.stats.ks_2samp).
"""
import json
import os
import logging
import numpy as np
import pandas as pd
from datetime import datetime
from collections import deque, defaultdict

logger = logging.getLogger(__name__)

LOG_PATH = os.path.join(os.path.dirname(__file__), "prediction_log.jsonl")
_recent_predictions = deque(maxlen=500)   # in-memory rolling window

DRIFT_THRESHOLD = 0.75
KS_PVALUE_THRESHOLD = 0.05   # p < 0.05 => drift detected
DRIFT_WINDOW = 100            # min samples before running KS test

# Training baseline distributions — loaded lazily
_baseline_distributions: dict = {}

MONITORED_FEATURES = ["Time", "Length", "DayOfWeek"]


def _load_baseline():
    """Load training data distributions for KS-test comparison."""
    global _baseline_distributions
    if _baseline_distributions:
        return

    dataset_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "airlines_delay.csv")
    if not os.path.exists(dataset_path):
        logger.warning("Training dataset not found — KS-test drift detection disabled.")
        return

    try:
        logger.info("Loading training data baseline distributions for drift detection...")
        df = pd.read_csv(dataset_path, usecols=MONITORED_FEATURES)
        df = df.sample(min(20000, len(df)), random_state=42).dropna()
        for feat in MONITORED_FEATURES:
            if feat in df.columns:
                _baseline_distributions[feat] = df[feat].values.tolist()
        logger.info(f"Baseline loaded for {list(_baseline_distributions.keys())}")
    except Exception as e:
        logger.warning(f"Could not load baseline distributions: {e}")


def log_prediction(flight_data: dict, prediction: int, probability: float):
    """Persist a prediction record and check for probability drift."""
    record = {
        "ts": datetime.utcnow().isoformat(),
        "airline": flight_data.get("Airline"),
        "from": flight_data.get("AirportFrom"),
        "to": flight_data.get("AirportTo"),
        "Time": flight_data.get("Time"),
        "Length": flight_data.get("Length"),
        "DayOfWeek": flight_data.get("DayOfWeek"),
        "prediction": prediction,
        "probability": round(probability, 4),
    }
    _recent_predictions.append(record)

    try:
        with open(LOG_PATH, "a") as f:
            f.write(json.dumps(record) + "\n")
    except Exception as e:
        logger.warning(f"Could not write prediction log: {e}")

    _check_probability_drift()


def _check_probability_drift():
    if len(_recent_predictions) < 20:
        return
    avg_prob = sum(r["probability"] for r in _recent_predictions) / len(_recent_predictions)
    if avg_prob > DRIFT_THRESHOLD:
        logger.warning(
            f"[DRIFT ALERT] Avg delay probability over last "
            f"{len(_recent_predictions)} predictions = {avg_prob:.2%} "
            f"(threshold {DRIFT_THRESHOLD:.0%})"
        )


def get_feature_drift() -> dict:
    """
    Run Kolmogorov-Smirnov two-sample test comparing the last DRIFT_WINDOW
    production requests against the training distribution baseline.
    Returns per-feature drift statistics and alerts.
    """
    from scipy.stats import ks_2samp

    _load_baseline()

    preds = list(_recent_predictions)
    if len(preds) < DRIFT_WINDOW:
        return {
            "status": "insufficient_data",
            "message": f"Need at least {DRIFT_WINDOW} predictions to evaluate drift (have {len(preds)}).",
            "features": {},
            "drift_detected": False,
        }

    live_window = preds[-DRIFT_WINDOW:]
    drift_results = {}
    any_drift = False

    for feat in MONITORED_FEATURES:
        if feat not in _baseline_distributions or not _baseline_distributions[feat]:
            drift_results[feat] = {"status": "no_baseline"}
            continue

        live_vals = [r[feat] for r in live_window if r.get(feat) is not None]
        if len(live_vals) < 20:
            drift_results[feat] = {"status": "insufficient_live_data"}
            continue

        baseline_sample = np.random.choice(_baseline_distributions[feat], size=DRIFT_WINDOW, replace=True)
        stat, p_value = ks_2samp(baseline_sample, live_vals)

        is_drifted = p_value < KS_PVALUE_THRESHOLD
        if is_drifted:
            any_drift = True
            logger.warning(f"[KS-DRIFT] Feature '{feat}': KS={stat:.4f}, p={p_value:.4f} — DRIFT DETECTED")

        drift_results[feat] = {
            "ks_statistic": round(float(stat), 4),
            "p_value": round(float(p_value), 4),
            "drift_detected": is_drifted,
            "live_mean": round(float(np.mean(live_vals)), 2),
            "live_std": round(float(np.std(live_vals)), 2),
            "baseline_mean": round(float(np.mean(_baseline_distributions[feat][:DRIFT_WINDOW])), 2),
            "baseline_std": round(float(np.std(_baseline_distributions[feat][:DRIFT_WINDOW])), 2),
        }

    return {
        "status": "ok",
        "window_size": len(live_window),
        "features": drift_results,
        "drift_detected": any_drift,
        "message": "Drift detected in one or more features!" if any_drift else "No significant feature drift detected.",
    }


def get_monitoring_stats() -> dict:
    """Return aggregated stats for the /analytics endpoint."""
    if not _recent_predictions:
        return {}

    preds = list(_recent_predictions)
    total = len(preds)
    delayed = sum(1 for p in preds if p["prediction"] == 1)

    airline_stats = defaultdict(lambda: {"total": 0, "delayed": 0})
    for p in preds:
        a = p["airline"] or "Unknown"
        airline_stats[a]["total"] += 1
        if p["prediction"] == 1:
            airline_stats[a]["delayed"] += 1

    airline_delay_rates = [
        {
            "airline": k,
            "delay_rate": round(v["delayed"] / v["total"] * 100, 1),
            "total": v["total"],
        }
        for k, v in airline_stats.items()
    ]
    airline_delay_rates.sort(key=lambda x: x["delay_rate"], reverse=True)

    hour_stats = defaultdict(lambda: {"total": 0, "delayed": 0})
    for p in preds:
        try:
            hour = int(p["ts"][11:13])
        except Exception:
            hour = 0
        hour_stats[hour]["total"] += 1
        if p["prediction"] == 1:
            hour_stats[hour]["delayed"] += 1

    hourly_trend = [
        {
            "hour": h,
            "delay_rate": round(hour_stats[h]["delayed"] / hour_stats[h]["total"] * 100, 1),
        }
        for h in sorted(hour_stats)
    ]

    return {
        "total_predictions": total,
        "overall_delay_rate": round(delayed / total * 100, 1),
        "avg_probability": round(sum((p["probability"] if p["prediction"] == 1 else (1.0 - p["probability"])) for p in preds) / total, 3),
        "airline_delay_rates": airline_delay_rates[:10],
        "hourly_trend": hourly_trend,
        "recent": preds[-20:][::-1],
    }

# Log check thresholds results
