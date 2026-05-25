FROM python:3.13-slim

WORKDIR /app

# Install system dependencies (needed for compiling some python packages)
RUN apt-get update && apt-get install -y build-essential curl && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
# Install basic requirements
RUN pip install --no-cache-dir -r requirements.txt

# Install advanced ML requirements to serve the XGBoost model with SHAP
RUN pip install --no-cache-dir xgboost catboost shap imbalanced-learn

COPY backend/ ./backend/
COPY best_model.pkl ./
COPY xgb_model.pkl ./
COPY cat_model.pkl ./
COPY keras_model.h5 ./
COPY feature_mappings.pkl ./
COPY airlines_delay.csv ./

EXPOSE 8090

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8090"]

# Pinning thin base image
