"""
ReServe Food Platform — Random Forest Spoilage Model
=====================================================
Trains two Random Forest models on the generated training data:

1. **Random Forest Classifier** — predicts spoilage risk level (Low / Medium / High)
2. **Random Forest Regressor**  — predicts remaining shelf-life in hours

Both models are saved via joblib for use by the Flask prediction API.

Algorithm: scikit-learn RandomForestClassifier / RandomForestRegressor
Features:  Category (encoded), Food Type, Storage Type, Quantity,
           Hours Since Prepared, Hour of Day
"""

import os
import sys
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    mean_absolute_error,
    r2_score,
    accuracy_score,
)
from sklearn.preprocessing import LabelEncoder

# ─── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, '..', 'app', 'data')
MODEL_DIR = os.path.join(BASE_DIR, '..', 'models_saved')

# Also check if we're called from ml-service root
if not os.path.exists(DATA_DIR):
    DATA_DIR = os.path.join(BASE_DIR, 'app', 'data')
    MODEL_DIR = os.path.join(BASE_DIR, 'models_saved')


def load_data(csv_path: str = None) -> pd.DataFrame:
    """Load training data from CSV."""
    if csv_path is None:
        csv_path = os.path.join(DATA_DIR, 'food_spoilage_training_data.csv')

    if not os.path.exists(csv_path):
        print(f'Training data not found at {csv_path}')
        print('Run generate_training_data.py first.')
        sys.exit(1)

    df = pd.read_csv(csv_path)
    print(f'Loaded {len(df)} training samples from {csv_path}')
    return df


def prepare_features(df: pd.DataFrame):
    """
    Encode categorical variables and select features for training.
    Returns: X (feature matrix), y_risk (risk labels), y_shelf (shelf hours),
             encoders (dict of LabelEncoders for inference)
    """
    # Label-encode categoricals
    le_category = LabelEncoder()
    le_food_type = LabelEncoder()
    le_storage = LabelEncoder()
    le_risk = LabelEncoder()

    df = df.copy()
    df['Category_Enc'] = le_category.fit_transform(df['Category'])
    df['Food_Type_Enc'] = le_food_type.fit_transform(df['Food_Type'])
    df['Storage_Type_Enc'] = le_storage.fit_transform(df['Storage_Type'])
    df['Risk_Enc'] = le_risk.fit_transform(df['Spoilage_Risk'])

    # Feature columns — only features that donors actually provide
    # (Temperature & Humidity are NOT user inputs, so excluded from model)
    feature_cols = [
        'Category_Enc',
        'Food_Type_Enc',
        'Storage_Type_Enc',
        'Quantity_kg',
        'Hours_Since_Prepared',
        'Hour_of_Day',
    ]

    X = df[feature_cols].values
    y_risk = df['Risk_Enc'].values           # Classification target
    y_shelf = df['Shelf_Life_Hours'].values   # Regression target
    y_spoiled = df['Is_Spoiled'].values       # Binary spoilage label

    encoders = {
        'category': le_category,
        'food_type': le_food_type,
        'storage_type': le_storage,
        'risk': le_risk,
    }

    return X, y_risk, y_shelf, y_spoiled, encoders, feature_cols


def train_models(X, y_risk, y_shelf, y_spoiled):
    """
    Train Random Forest models:
      - Classifier for risk level (Low / Medium / High)
      - Regressor for shelf life (hours)
      - Classifier for binary spoilage (0 / 1)
    """
    # ── Split data ──────────────────────────────────────────────────────────
    X_train, X_test, yr_train, yr_test, ys_train, ys_test, yb_train, yb_test = \
        train_test_split(X, y_risk, y_shelf, y_spoiled, test_size=0.2, random_state=42, stratify=y_risk)

    # ── 1. Risk Level Classifier ────────────────────────────────────────────
    print('\n' + '=' * 60)
    print('Training Random Forest Classifier (Spoilage Risk Level)...')
    print('=' * 60)

    rf_classifier = RandomForestClassifier(
        n_estimators=300,       # 300 decision trees in the forest
        max_depth=18,
        min_samples_split=4,
        min_samples_leaf=1,
        class_weight='balanced',
        random_state=42,
        n_jobs=-1,              # Use all CPU cores
    )
    rf_classifier.fit(X_train, yr_train)

    yr_pred = rf_classifier.predict(X_test)
    risk_accuracy = accuracy_score(yr_test, yr_pred)
    print(f'\nRisk Classifier Accuracy: {risk_accuracy:.4f} ({risk_accuracy*100:.1f}%)')
    print('\nClassification Report:')
    print(classification_report(yr_test, yr_pred, zero_division=0))

    # ── 2. Shelf Life Regressor ─────────────────────────────────────────────
    print('=' * 60)
    print('Training Random Forest Regressor (Shelf Life Hours)...')
    print('=' * 60)

    rf_regressor = RandomForestRegressor(
        n_estimators=300,
        max_depth=20,
        min_samples_split=3,
        min_samples_leaf=1,
        random_state=42,
        n_jobs=-1,
    )
    rf_regressor.fit(X_train, ys_train)

    ys_pred = rf_regressor.predict(X_test)
    mae = mean_absolute_error(ys_test, ys_pred)
    r2 = r2_score(ys_test, ys_pred)
    print(f'\nShelf Life Regressor MAE: {mae:.2f} hours')
    print(f'Shelf Life Regressor R² Score: {r2:.4f}')

    # ── 3. Binary Spoilage Classifier ───────────────────────────────────────
    print('\n' + '=' * 60)
    print('Training Random Forest Classifier (Binary Spoilage)...')
    print('=' * 60)

    rf_spoilage = RandomForestClassifier(
        n_estimators=300,
        max_depth=18,
        min_samples_split=4,
        min_samples_leaf=1,
        class_weight='balanced',
        random_state=42,
        n_jobs=-1,
    )
    rf_spoilage.fit(X_train, yb_train)

    yb_pred = rf_spoilage.predict(X_test)
    spoilage_accuracy = accuracy_score(yb_test, yb_pred)
    print(f'\nSpoilage Classifier Accuracy: {spoilage_accuracy:.4f} ({spoilage_accuracy*100:.1f}%)')
    print('\nClassification Report:')
    print(classification_report(yb_test, yb_pred, target_names=['Not Spoiled', 'Spoiled'], zero_division=0))
    print('\nConfusion Matrix:')
    print(confusion_matrix(yb_test, yb_pred))

    # ── Feature Importances ─────────────────────────────────────────────────
    print('\n' + '=' * 60)
    print('Feature Importances (Risk Classifier):')
    print('=' * 60)
    feature_names = [
        'Category', 'Food Type', 'Storage Type', 'Quantity (kg)',
        'Hours Since Prepared', 'Hour of Day',
    ]
    importances = rf_classifier.feature_importances_
    for name, imp in sorted(zip(feature_names, importances), key=lambda x: -x[1]):
        bar = '█' * int(imp * 50)
        print(f'  {name:25s} {imp:.4f}  {bar}')

    return rf_classifier, rf_regressor, rf_spoilage, {
        'risk_accuracy': risk_accuracy,
        'shelf_mae': mae,
        'shelf_r2': r2,
        'spoilage_accuracy': spoilage_accuracy,
    }


def save_models(rf_classifier, rf_regressor, rf_spoilage, encoders, metrics):
    """Save trained models and encoders to disk."""
    os.makedirs(MODEL_DIR, exist_ok=True)

    joblib.dump(rf_classifier, os.path.join(MODEL_DIR, 'rf_risk_classifier.joblib'))
    joblib.dump(rf_regressor, os.path.join(MODEL_DIR, 'rf_shelf_regressor.joblib'))
    joblib.dump(rf_spoilage, os.path.join(MODEL_DIR, 'rf_spoilage_classifier.joblib'))
    joblib.dump(encoders, os.path.join(MODEL_DIR, 'label_encoders.joblib'))
    joblib.dump(metrics, os.path.join(MODEL_DIR, 'model_metrics.joblib'))

    print(f'\nModels saved to {MODEL_DIR}/')
    print(f'  - rf_risk_classifier.joblib')
    print(f'  - rf_shelf_regressor.joblib')
    print(f'  - rf_spoilage_classifier.joblib')
    print(f'  - label_encoders.joblib')
    print(f'  - model_metrics.joblib')


# ─── Main ────────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    # Adjust paths when run from ml-service root
    if os.path.exists(os.path.join(os.getcwd(), 'app', 'data')):
        DATA_DIR = os.path.join(os.getcwd(), 'app', 'data')
        MODEL_DIR = os.path.join(os.getcwd(), 'models_saved')

    df = load_data()
    X, y_risk, y_shelf, y_spoiled, encoders, feature_cols = prepare_features(df)

    print(f'\nDataset: {X.shape[0]} samples, {X.shape[1]} features')
    print(f'Risk classes: {np.unique(y_risk)}')
    print(f'Spoilage ratio: {y_spoiled.mean()*100:.1f}%')

    rf_cls, rf_reg, rf_spl, metrics = train_models(X, y_risk, y_shelf, y_spoiled)
    save_models(rf_cls, rf_reg, rf_spl, encoders, metrics)

    print('\n✅ Training complete!')
