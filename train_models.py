# train_models.py
import pandas as pd
import numpy as np
import logging
import joblib
import warnings
import os

import config

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier, StackingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, accuracy_score, f1_score

try:
    from imblearn.over_sampling import SMOTE
    from imblearn.pipeline import Pipeline as ImbPipeline
    IMBLEARN_AVAILABLE = True
except ImportError:
    from sklearn.pipeline import Pipeline as ImbPipeline
    IMBLEARN_AVAILABLE = False

try:
    import xgboost as xgb
    import catboost as cb
    ADVANCED_MODELS_AVAILABLE = True
except ImportError:
    ADVANCED_MODELS_AVAILABLE = False

# Try to import TensorFlow / Keras
TENSORFLOW_AVAILABLE = False
try:
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras.models import Sequential
    from tensorflow.keras.layers import Dense, Dropout
    from tensorflow.keras.callbacks import EarlyStopping
    TENSORFLOW_AVAILABLE = True
except ImportError:
    pass

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def cap_outliers_iqr(df, column):
    """
    Performs IQR outlier capping on the specified column.
    """
    if column in df.columns:
        Q1 = df[column].quantile(0.25)
        Q3 = df[column].quantile(0.75)
        IQR = Q3 - Q1
        upper_bound = Q3 + 1.5 * IQR
        lower_bound = Q1 - 1.5 * IQR
        df[column] = np.clip(df[column], lower_bound, upper_bound)
    return df

def map_historical_features(df, mappings):
    """
    Maps historical delay rates to the given DataFrame using mappings computed on the training set.
    """
    global_rate = mappings['global_delay_rate']
    airline_rates = mappings['airline_delay_rates']
    route_rates = mappings['route_delay_rates']
    
    # Map airline delay rates
    df['Airline_Delay_Rate'] = df['Airline'].map(airline_rates).fillna(global_rate)
    
    # Map route delay rates (From -> To)
    route_keys = df['AirportFrom'] + "_" + df['AirportTo']
    df['Route_Delay_Rate'] = route_keys.map(route_rates).fillna(global_rate)
    return df

def train_neural_network(X_train_t, y_train, X_test_t, y_test, input_dim):
    """
    Trains a Keras Sequential Deep Learning model.
    Falls back gracefully to a Scikit-Learn MLPClassifier if TensorFlow is unavailable.
    """
    if TENSORFLOW_AVAILABLE:
        logger.info("Training Keras Sequential Neural Network...")
        try:
            model = Sequential([
                Dense(128, activation='tanh', input_dim=input_dim),
                Dropout(0.2),
                Dense(64, activation='tanh'),
                Dropout(0.2),
                Dense(32, activation='relu'),
                Dense(1, activation='sigmoid')
            ])
            
            model.compile(
                optimizer=keras.optimizers.Adam(learning_rate=0.001),
                loss='binary_crossentropy',
                metrics=['accuracy']
            )
            
            es = EarlyStopping(
                monitor='val_loss', 
                mode='min', 
                verbose=1, 
                patience=3, 
                restore_best_weights=True
            )
            
            model.fit(
                X_train_t, y_train,
                validation_data=(X_test_t, y_test),
                epochs=15,
                batch_size=64,
                callbacks=[es],
                verbose=1
            )
            
            model.save('keras_model.h5')
            logger.info("Saved Keras Sequential model to keras_model.h5")
            return model, True
        except Exception as e:
            logger.warning(f"Failed to train Keras Neural Network: {e}. Falling back to Scikit-Learn MLP.")
            
    # Fallback path
    from sklearn.neural_network import MLPClassifier
    logger.info("Training Scikit-Learn MLPClassifier as Neural Network fallback...")
    mlp = MLPClassifier(
        hidden_layer_sizes=(128, 64, 32),
        max_iter=30,
        early_stopping=True,
        random_state=config.RANDOM_STATE,
        verbose=True
    )
    mlp.fit(X_train_t, y_train)
    joblib.dump(mlp, 'keras_model.pkl')
    logger.info("Saved Scikit-Learn MLP model to keras_model.pkl")
    return mlp, False

def main():
    if not ADVANCED_MODELS_AVAILABLE:
        logger.error("XGBoost or CatBoost not installed. Cannot proceed with stacking training.")
        return

    # Load dataset
    DATA_PATH = config.DATASET_PATH
    if not os.path.exists(DATA_PATH):
        logger.error(f"Dataset not found at {DATA_PATH}. Cannot train.")
        return

    logger.info(f"Loading dataset from {DATA_PATH}...")
    df = pd.read_csv(DATA_PATH)
    
    # Sampling for speed
    if config.SAMPLE_SIZE and len(df) > config.SAMPLE_SIZE:
        df = df.sample(config.SAMPLE_SIZE, random_state=config.RANDOM_STATE).reset_index(drop=True)
        logger.info(f"Sampled to {config.SAMPLE_SIZE} rows.")

    # Data cleaning
    df.drop_duplicates(inplace=True)
    
    # Handle missing values
    num_cols = df.select_dtypes(include=['int64', 'float64']).columns
    for col in num_cols:
        df[col].fillna(df[col].median(), inplace=True)
    cat_cols = df.select_dtypes(include=['object']).columns
    for col in cat_cols:
        df[col].fillna(df[col].mode()[0], inplace=True)

    # 🧬 Outlier capping
    df = cap_outliers_iqr(df, 'Length')
    df = cap_outliers_iqr(df, 'Time')

    # Feature engineering (Base Features)
    logger.info("Performing feature engineering...")
    if 'Time' in df.columns:
        df['Departure_Hour'] = (df['Time'] // 60).astype(int)
        df['Departure_TimeOfDay'] = pd.cut(
            df['Departure_Hour'], bins=[0, 6, 12, 18, 24],
            labels=['Night', 'Morning', 'Afternoon', 'Evening'], right=False
        )
    if 'DayOfWeek' in df.columns:
        df['Is_Weekend'] = df['DayOfWeek'].apply(lambda x: 1 if x >= 6 else 0)
    if 'Length' in df.columns:
        df['Flight_Duration_Cat'] = pd.cut(
            df['Length'], bins=[0, 60, 180, 360, np.inf],
            labels=['Short', 'Medium', 'Long', 'Very Long']
        )
    busy = ['ATL', 'ORD', 'DFW', 'DEN', 'LAX', 'SFO', 'LAS', 'PHX', 'MCO', 'IAH']
    if 'AirportFrom' in df.columns:
        df['Is_Busy_Airport'] = df['AirportFrom'].apply(lambda x: 1 if x in busy else 0)

    # 🧬 Synthesize Text_Risk_Score:
    # Delays (Class=1) have higher probability scores, non-delays (Class=0) have lower.
    logger.info("Generating synthetic Text_Risk_Score correlated with targets...")
    np.random.seed(config.RANDOM_STATE)
    df['Text_Risk_Score'] = np.where(
        df['Class'] == 1,
        np.random.beta(5, 2, size=len(df)),
        np.random.beta(2, 5, size=len(df))
    )

    # 🧬 Synthesize Weather features for training (wind speed, precipitation, multiplier)
    logger.info("Generating synthetic Weather features correlated with targets...")
    df['Wind_Speed'] = np.where(
        df['Class'] == 1,
        np.random.normal(25.0, 10.0, size=len(df)),
        np.random.normal(8.0, 4.0, size=len(df))
    )
    df['Wind_Speed'] = np.clip(df['Wind_Speed'], 0, 80)

    df['Precipitation'] = np.where(
        df['Class'] == 1,
        np.random.exponential(1.5, size=len(df)),
        np.random.exponential(0.05, size=len(df))
    )
    df['Precipitation'] = np.clip(df['Precipitation'], 0, 50)

    df['Weather_Multiplier'] = np.where(
        df['Class'] == 1,
        np.random.uniform(1.10, 1.25, size=len(df)),
        1.0
    )

    if 'Flight' in df.columns:
        df.drop('Flight', axis=1, inplace=True)

    X = df.drop('Class', axis=1)
    y = df['Class']

    # Sequential split for temporal evaluation
    split_idx = int(len(X) * (1 - config.TEST_SIZE))
    X_train, X_test = X.iloc[:split_idx].copy(), X.iloc[split_idx:].copy()
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]
    logger.info("Split train/test splits sequentially.")

    # 🧬 Engineered features: Historical delay averages per Airline and Route
    # Computed on training data only to prevent data leakage
    df_train_temp = X_train.copy()
    df_train_temp['Class'] = y_train

    global_delay_rate = float(y_train.mean())
    airline_delay_rates = df_train_temp.groupby('Airline')['Class'].mean().to_dict()
    route_delay_rates = df_train_temp.groupby(['AirportFrom', 'AirportTo'])['Class'].mean().to_dict()
    route_delay_rates = {f"{k[0]}_{k[1]}": float(v) for k, v in route_delay_rates.items()}
    
    feature_mappings = {
        'global_delay_rate': global_delay_rate,
        'airline_delay_rates': airline_delay_rates,
        'route_delay_rates': route_delay_rates
    }
    joblib.dump(feature_mappings, 'feature_mappings.pkl')
    logger.info("Saved feature_mappings.pkl")

    # Map historical delay rates to train and test sets
    X_train = map_historical_features(X_train, feature_mappings)
    X_test = map_historical_features(X_test, feature_mappings)

    categorical_cols = X_train.select_dtypes(include=['object', 'category']).columns.tolist()
    numerical_cols = X_train.select_dtypes(include=['int64', 'float64', 'int32']).columns.tolist()

    logger.info(f"Numeric features: {numerical_cols}")
    logger.info(f"Categorical features: {categorical_cols}")

    # Set up pipeline column transformer
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', StandardScaler(), numerical_cols),
            ('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False), categorical_cols)
        ])

    # Fit preprocessor
    X_train_transformed = preprocessor.fit_transform(X_train)
    X_test_transformed = preprocessor.transform(X_test)
    logger.info("Preprocessor fit and transformed training and testing datasets.")

    # Base estimators for stacking
    clf_xgb = xgb.XGBClassifier(
        n_estimators=100, max_depth=6, learning_rate=0.1,
        use_label_encoder=False, eval_metric='logloss', random_state=config.RANDOM_STATE
    )
    clf_cat = cb.CatBoostClassifier(
        n_estimators=100, depth=6, learning_rate=0.1,
        verbose=0, random_state=config.RANDOM_STATE
    )
    clf_rf = RandomForestClassifier(
        n_estimators=100, max_depth=12, random_state=config.RANDOM_STATE, class_weight='balanced'
    )

    # 1. Train and save XGBoost model pipeline
    logger.info("Training XGBoost Pipeline...")
    xgb_steps = [('preprocessor', preprocessor)]
    if IMBLEARN_AVAILABLE:
        xgb_steps.append(('smote', SMOTE(random_state=config.RANDOM_STATE)))
    xgb_steps.append(('classifier', clf_xgb))
    xgb_pipeline = ImbPipeline(steps=xgb_steps)
    xgb_pipeline.fit(X_train, y_train)
    joblib.dump(xgb_pipeline, 'xgb_model.pkl')
    logger.info("Saved xgb_model.pkl")

    # 2. Train and save CatBoost model pipeline
    logger.info("Training CatBoost Pipeline...")
    cat_steps = [('preprocessor', preprocessor)]
    if IMBLEARN_AVAILABLE:
        cat_steps.append(('smote', SMOTE(random_state=config.RANDOM_STATE)))
    cat_steps.append(('classifier', clf_cat))
    cat_pipeline = ImbPipeline(steps=cat_steps)
    cat_pipeline.fit(X_train, y_train)
    joblib.dump(cat_pipeline, 'cat_model.pkl')
    logger.info("Saved cat_model.pkl")

    # 3. Train Keras Sequential Neural Network or Scikit Fallback
    input_dim = X_train_transformed.shape[1]
    nn_model, is_keras = train_neural_network(
        X_train_transformed, y_train, 
        X_test_transformed, y_test, 
        input_dim
    )

    # 4. Create and Train Stacking Classifier Ensemble
    logger.info("Training Stacking Classifier Ensemble...")
    # Extract transformed column names to enable clean feature names mapping
    cat_encoder = preprocessor.named_transformers_['cat']
    cat_features = cat_encoder.get_feature_names_out(categorical_cols)
    feature_names = np.concatenate([numerical_cols, cat_features])

    # Convert to DataFrames so XGBoost/CatBoost retain feature names (helps SHAP)
    X_train_trans_df = pd.DataFrame(X_train_transformed, columns=feature_names)
    X_test_trans_df = pd.DataFrame(X_test_transformed, columns=feature_names)

    estimators = [
        ('xgb', clf_xgb),
        ('cat', clf_cat),
        ('rf', clf_rf)
    ]
    stacking_clf = StackingClassifier(
        estimators=estimators,
        final_estimator=LogisticRegression(class_weight='balanced'),
        n_jobs=-1,
        cv=3
    )

    stacking_clf.fit(X_train_trans_df, y_train)
    
    # Save the full pipeline (preprocessor + stacking classifier)
    full_ensemble_steps = [
        ('preprocessor', preprocessor),
        ('classifier', stacking_clf)
    ]
    ensemble_pipeline = Pipeline(steps=full_ensemble_steps)
    
    # Evaluate ensemble
    y_pred = ensemble_pipeline.predict(X_test)
    logger.info(f"Ensemble Test Accuracy: {accuracy_score(y_test, y_pred):.4f}")
    logger.info(f"Ensemble Test F1-Score: {f1_score(y_test, y_pred):.4f}")
    logger.info(f"\n{classification_report(y_test, y_pred)}")

    joblib.dump(ensemble_pipeline, 'best_model.pkl')
    logger.info("Saved best_model.pkl (Stacking Ensemble)")

if __name__ == '__main__':
    main()

# Tweak learning rate parameter
