# config.py

import os

# File paths
DATASET_PATH = 'airlines_delay.csv'
MODEL_SAVE_PATH = 'best_model.pkl'

# General Settings
SAMPLE_SIZE = 50000  # Set to None to use full dataset
TEST_SIZE = 0.2
CV_FOLDS = 3
RANDOM_STATE = 42

# Hyperparameters for RandomizedSearchCV
RF_PARAM_GRID = {
    'classifier__n_estimators': [50, 100, 200],
    'classifier__max_depth': [10, 20, None],
    'classifier__min_samples_split': [2, 5, 10]
}

XGB_PARAM_GRID = {
    'classifier__n_estimators': [50, 100, 200],
    'classifier__max_depth': [3, 6, 9],
    'classifier__learning_rate': [0.01, 0.1, 0.2]
}

DT_PARAM_GRID = {
    'classifier__max_depth': [5, 10, 20],
    'classifier__min_samples_split': [2, 10]
}
