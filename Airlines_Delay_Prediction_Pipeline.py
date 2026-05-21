import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import logging
import joblib
import warnings

import config

from sklearn.model_selection import train_test_split, cross_val_score, RandomizedSearchCV, TimeSeriesSplit, learning_curve
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score, accuracy_score, precision_score, recall_score, f1_score
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.compose import ColumnTransformer

# Imbalanced-learn handles SMOTE in pipelines correctly (avoids data leakage)
try:
    from imblearn.pipeline import Pipeline as ImbPipeline
    from imblearn.over_sampling import SMOTE
    IMBLEARN_AVAILABLE = True
except ImportError:
    from sklearn.pipeline import Pipeline as ImbPipeline
    IMBLEARN_AVAILABLE = False
    
try:
    import xgboost as xgb
    import catboost as cb
    import shap
    ADVANCED_MODELS_AVAILABLE = True
except ImportError:
    ADVANCED_MODELS_AVAILABLE = False

warnings.filterwarnings('ignore')

# 6. Logging setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

if not ADVANCED_MODELS_AVAILABLE:
    logger.warning("XGBoost, CatBoost, or SHAP not installed. Advanced models and SHAP will be skipped.")
if not IMBLEARN_AVAILABLE:
    logger.warning("Imbalanced-learn not installed. SMOTE will be skipped, but class_weights will still be used.")


# 1. Clean the Dataset
def clean_dataset(df):
    logger.info("Cleaning Dataset...")
    
    # Check data imbalance
    if 'Class' in df.columns:
        imbalance = df['Class'].value_counts(normalize=True).to_dict()
        logger.info(f"Data Imbalance: {imbalance}")
        
    # Handle missing values
    missing = df.isnull().sum()
    if missing.sum() > 0:
        logger.info(f"Missing values found:\n{missing[missing > 0]}")
        
    # Median imputation for numerical features
    num_cols = df.select_dtypes(include=['int64', 'float64']).columns
    for col in num_cols:
        df[col].fillna(df[col].median(), inplace=True)
        
    # Mode imputation for categorical features
    cat_cols = df.select_dtypes(include=['object']).columns
    for col in cat_cols:
        df[col].fillna(df[col].mode()[0], inplace=True)
        
    # Remove duplicates
    initial_len = len(df)
    df.drop_duplicates(inplace=True)
    if initial_len > len(df):
        logger.info(f"Removed {initial_len - len(df)} duplicates.")
    
    # Detect outliers using IQR method for 'Length'
    if 'Length' in df.columns:
        Q1 = df['Length'].quantile(0.25)
        Q3 = df['Length'].quantile(0.75)
        IQR = Q3 - Q1
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR
        outliers = df[(df['Length'] < lower_bound) | (df['Length'] > upper_bound)]
        logger.info(f"Capping {len(outliers)} outliers in 'Length'.")
        df['Length'] = np.where(df['Length'] > upper_bound, upper_bound, df['Length'])
        df['Length'] = np.where(df['Length'] < lower_bound, lower_bound, df['Length'])
        
    return df

# 2. Perform Proper EDA
def perform_eda(df):
    logger.info("Performing EDA...")
    sns.set_theme(style="whitegrid")
    
    plt.figure(figsize=(6, 4))
    sns.countplot(data=df, x='Class')
    plt.title("Delay Distribution")
    plt.savefig("delay_distribution.png")
    plt.close()
    
    if 'Airline' in df.columns:
        plt.figure(figsize=(12, 6))
        sns.countplot(data=df, x='Airline', hue='Class')
        plt.title("Airline-wise Delays")
        plt.xticks(rotation=45)
        plt.savefig("airline_delays.png")
        plt.close()
        
    if 'AirportFrom' in df.columns:
        top_airports = df['AirportFrom'].value_counts().nlargest(20).index
        plt.figure(figsize=(14, 6))
        sns.countplot(data=df[df['AirportFrom'].isin(top_airports)], x='AirportFrom', hue='Class')
        plt.title("Airport-wise Delays (Top 20 Source Airports)")
        plt.xticks(rotation=45)
        plt.savefig("airport_delays.png")
        plt.close()
        
    plt.figure(figsize=(10, 8))
    numeric_df = df.select_dtypes(include=[np.number])
    sns.heatmap(numeric_df.corr(), annot=True, cmap="coolwarm", fmt=".2f")
    plt.title("Correlation Heatmap")
    plt.savefig("correlation_heatmap.png")
    plt.close()

# Feature Engineering
def feature_engineering(df):
    logger.info("Performing Feature Engineering...")
    if 'Time' in df.columns:
        df['Departure_Hour'] = (df['Time'] // 60).astype(int)
        bins = [0, 6, 12, 18, 24]
        labels = ['Night', 'Morning', 'Afternoon', 'Evening']
        df['Departure_TimeOfDay'] = pd.cut(df['Departure_Hour'], bins=bins, labels=labels, right=False)
        
    if 'DayOfWeek' in df.columns:
        df['Is_Weekend'] = df['DayOfWeek'].apply(lambda x: 1 if x >= 6 else 0)
        
    if 'Length' in df.columns:
        bins = [0, 60, 180, 360, np.inf]
        labels = ['Short', 'Medium', 'Long', 'Very Long']
        df['Flight_Duration_Cat'] = pd.cut(df['Length'], bins=bins, labels=labels)
        
    if 'AirportFrom' in df.columns:
        airport_counts = df['AirportFrom'].value_counts()
        busy_threshold = airport_counts.quantile(0.8)
        busy_airports = airport_counts[airport_counts >= busy_threshold].index
        df['Is_Busy_Airport'] = df['AirportFrom'].apply(lambda x: 1 if x in busy_airports else 0)
        
    return df

# 1. Learning Curves for Overfitting/Underfitting Analysis
def plot_learning_curve(estimator, X, y, cv, title="Learning Curve"):
    logger.info(f"Generating learning curve for {title}...")
    train_sizes, train_scores, test_scores = learning_curve(
        estimator, X, y, cv=cv, n_jobs=-1, train_sizes=np.linspace(0.1, 1.0, 5), scoring='f1'
    )
    train_scores_mean = np.mean(train_scores, axis=1)
    test_scores_mean = np.mean(test_scores, axis=1)
    
    plt.figure(figsize=(8, 6))
    plt.plot(train_sizes, train_scores_mean, 'o-', color="r", label="Training F1-Score")
    plt.plot(train_sizes, test_scores_mean, 'o-', color="g", label="Cross-validation F1-Score")
    plt.title(title)
    plt.xlabel("Training examples")
    plt.ylabel("F1-Score")
    plt.legend(loc="best")
    plt.grid(True)
    plt.savefig(f"{title.replace(' ', '_').lower()}.png")
    plt.close()

def main():
    try:
        df = pd.read_csv(config.DATASET_PATH)
        logger.info(f"Loaded dataset from {config.DATASET_PATH} with {len(df)} rows.")
    except FileNotFoundError:
        logger.error(f"{config.DATASET_PATH} not found. Please ensure the dataset is present.")
        return

    if config.SAMPLE_SIZE and len(df) > config.SAMPLE_SIZE:
        df = df.sample(config.SAMPLE_SIZE, random_state=config.RANDOM_STATE).reset_index(drop=True)
        logger.info(f"Sampled dataset to {config.SAMPLE_SIZE} rows to speed up processing.")

    df = clean_dataset(df)
    perform_eda(df)
    df = feature_engineering(df)
    
    if 'Flight' in df.columns:
        df.drop('Flight', axis=1, inplace=True)
        
    X = df.drop('Class', axis=1)
    y = df['Class']
    
    categorical_cols = X.select_dtypes(include=['object', 'category']).columns.tolist()
    numerical_cols = X.select_dtypes(include=['int64', 'float64', 'int32']).columns.tolist()
    
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', StandardScaler(), numerical_cols),
            ('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False), categorical_cols)
        ])
    
    # 3. Temporal Awareness Split
    # Since flight data is naturally chronological but we might lack a distinct timestamp, 
    # we simulate chronological split by avoiding shuffle. This validates on future data.
    split_idx = int(len(X) * (1 - config.TEST_SIZE))
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]
    logger.info("Performed sequential/temporal train-test split.")

    # TimeSeriesSplit for CV ensures we train on past and validate on future during CV folds
    tscv = TimeSeriesSplit(n_splits=config.CV_FOLDS)
    
    # 2. Class imbalance handling: native class weights are added as a baseline.
    models = {
        'Logistic Regression': LogisticRegression(max_iter=1000, class_weight='balanced'),
        'Decision Tree': DecisionTreeClassifier(random_state=config.RANDOM_STATE, class_weight='balanced'),
        'Random Forest': RandomForestClassifier(random_state=config.RANDOM_STATE, n_estimators=50, class_weight='balanced')
    }
    
    if ADVANCED_MODELS_AVAILABLE:
        # XGBoost handles imbalance with scale_pos_weight or standard weighting
        models['XGBoost'] = xgb.XGBClassifier(use_label_encoder=False, eval_metric='logloss', random_state=config.RANDOM_STATE)
        models['CatBoost'] = cb.CatBoostClassifier(verbose=0, random_state=config.RANDOM_STATE, auto_class_weights='Balanced')

    results = {}
    
    logger.info("Training and Evaluating Models...")
    for name, model in models.items():
        # Using ImbPipeline to incorporate SMOTE
        steps = [('preprocessor', preprocessor)]
        
        # 2. Add SMOTE for class imbalance handling if available
        if IMBLEARN_AVAILABLE:
            steps.append(('smote', SMOTE(random_state=config.RANDOM_STATE)))
            
        steps.append(('classifier', model))
        
        clf = ImbPipeline(steps=steps)
        
        # Cross-validation with TimeSeriesSplit
        cv_scores = cross_val_score(clf, X_train, y_train, cv=tscv, scoring='f1')
        logger.info(f"{name} CV F1-Score: {cv_scores.mean():.4f} (+/- {cv_scores.std() * 2:.4f})")
        
        clf.fit(X_train, y_train)
        
        # 1. Train vs Validation Analysis (Overfitting/Underfitting Check)
        y_train_pred = clf.predict(X_train)
        y_test_pred = clf.predict(X_test)
        
        train_acc = accuracy_score(y_train, y_train_pred)
        test_acc = accuracy_score(y_test, y_test_pred)
        logger.info(f"{name} Train Acc: {train_acc:.4f} | Test Acc: {test_acc:.4f}")
        
        if (train_acc - test_acc) > 0.1:
            logger.warning(f"Overfitting detected for {name}! (Train Acc >> Test Acc)")
        elif train_acc < 0.6:
            logger.warning(f"Underfitting detected for {name}! (Model struggles to learn training data)")
            
        f1 = f1_score(y_test, y_test_pred)
        results[name] = f1
        
    best_model_name = max(results, key=results.get)
    logger.info(f"Best Model based on F1-Score: {best_model_name}")
    
    logger.info("Hyperparameter Tuning the Best Model...")
    if best_model_name == 'Random Forest':
        param_grid = config.RF_PARAM_GRID
        best_base_model = RandomForestClassifier(random_state=config.RANDOM_STATE, class_weight='balanced')
    elif best_model_name == 'XGBoost' and ADVANCED_MODELS_AVAILABLE:
        param_grid = config.XGB_PARAM_GRID
        best_base_model = xgb.XGBClassifier(use_label_encoder=False, eval_metric='logloss', random_state=config.RANDOM_STATE)
    else:
        param_grid = config.DT_PARAM_GRID
        best_base_model = DecisionTreeClassifier(random_state=config.RANDOM_STATE, class_weight='balanced')
        
    tune_steps = [('preprocessor', preprocessor)]
    if IMBLEARN_AVAILABLE:
        tune_steps.append(('smote', SMOTE(random_state=config.RANDOM_STATE)))
    tune_steps.append(('classifier', best_base_model))
    
    tune_pipeline = ImbPipeline(steps=tune_steps)
    random_search = RandomizedSearchCV(
        tune_pipeline, 
        param_distributions=param_grid, 
        n_iter=5, 
        cv=tscv, 
        scoring='f1', 
        random_state=config.RANDOM_STATE, 
        n_jobs=-1
    )
    
    random_search.fit(X_train, y_train)
    logger.info(f"Best Parameters found: {random_search.best_params_}")
    
    final_model = random_search.best_estimator_
    
    # 1. Learning Curve plot for final model
    plot_learning_curve(final_model, X_train, y_train, cv=tscv, title="Final Best Model Learning Curve")
    
    y_pred_final = final_model.predict(X_test)
    logger.info(f"\n{classification_report(y_test, y_pred_final)}")
    
    # 5. Model Persistence
    logger.info(f"Saving final trained model to {config.MODEL_SAVE_PATH} via joblib.dump...")
    joblib.dump(final_model, config.MODEL_SAVE_PATH)
    
    # 4. SHAP Explanations
    if ADVANCED_MODELS_AVAILABLE and best_model_name in ['Random Forest', 'XGBoost', 'CatBoost', 'Decision Tree']:
        logger.info("Generating SHAP explanations...")
        classifier = final_model.named_steps['classifier']
        
        # Transform X_test to match classifier inputs
        X_test_transformed = final_model.named_steps['preprocessor'].transform(X_test)
        
        # Extract meaningful feature names after OneHotEncoding
        cat_encoder = final_model.named_steps['preprocessor'].named_transformers_['cat']
        if hasattr(cat_encoder, 'get_feature_names_out'):
            cat_features = cat_encoder.get_feature_names_out(categorical_cols)
        else:
            cat_features = cat_encoder.get_feature_names(categorical_cols)
            
        feature_names = np.concatenate([numerical_cols, cat_features])
        
        explainer = shap.TreeExplainer(classifier)
        
        # SHAP can be computationally heavy; use a sample for background
        sample_size = min(500, X_test_transformed.shape[0])
        shap_X = X_test_transformed[:sample_size]
        
        if type(shap_X) != np.ndarray: # E.g. if it is a sparse matrix from OneHotEncoder
            shap_X = shap_X.toarray()
            
        shap_values = explainer.shap_values(shap_X)
        
        # Binary classification SHAP values might come as a list [negative_class, positive_class]
        if isinstance(shap_values, list):
            shap_values = shap_values[1]
            
        # Summary Plot
        plt.figure()
        shap.summary_plot(shap_values, shap_X, feature_names=feature_names, show=False)
        plt.title("SHAP Summary Plot")
        plt.tight_layout()
        plt.savefig("shap_summary.png")
        plt.close()
        
        # Dependence Plot for top feature
        mean_abs_shap = np.mean(np.abs(shap_values), axis=0)
        top_feature_idx = np.argmax(mean_abs_shap)
        top_feature_name = feature_names[top_feature_idx]
        
        plt.figure()
        shap.dependence_plot(top_feature_idx, shap_values, shap_X, feature_names=feature_names, show=False)
        plt.title(f"SHAP Dependence: {top_feature_name}")
        plt.tight_layout()
        # Clean feature name for filename
        clean_feature_name = str(top_feature_name).replace(' ', '_').replace('<', 'lt').replace('>', 'gt')
        plt.savefig(f"shap_dependence_{clean_feature_name}.png")
        plt.close()
        
        logger.info("SHAP Summary and Dependence plots saved successfully.")

if __name__ == "__main__":
    main()
