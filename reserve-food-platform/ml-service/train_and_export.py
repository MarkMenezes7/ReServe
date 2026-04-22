"""
ReServe ML — Master Script
============================
Generates training data → Exports to Excel/CSV → Trains Random Forest models.

Usage:
    cd ml-service
    pip install -r requirements.txt
    python train_and_export.py
"""

import os
import sys

# Ensure we can import from app/
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.data.generate_training_data import generate_training_data, export_data


def main():
    data_dir = os.path.join(os.path.dirname(__file__), 'app', 'data')
    model_dir = os.path.join(os.path.dirname(__file__), 'models_saved')

    # ── Step 1: Generate Training Data ──────────────────────────────────────
    print('=' * 60)
    print('STEP 1: Generating 5000 training samples...')
    print('=' * 60)
    df = generate_training_data(5000)

    # ── Step 2: Export to Excel & CSV ───────────────────────────────────────
    print('\n' + '=' * 60)
    print('STEP 2: Exporting to Excel and CSV...')
    print('=' * 60)
    csv_path, xlsx_path = export_data(df, data_dir)

    print(f'\n  Dataset shape: {df.shape}')
    print(f'  Columns: {list(df.columns)}')
    print(f'  Spoilage rate: {df["Is_Spoiled"].mean()*100:.1f}%')

    # ── Step 3: Train Random Forest Models ──────────────────────────────────
    print('\n' + '=' * 60)
    print('STEP 3: Training Random Forest models...')
    print('=' * 60)

    from train_model import load_data, prepare_features, train_models, save_models
    # Override paths
    import train_model
    train_model.DATA_DIR = data_dir
    train_model.MODEL_DIR = model_dir

    df2 = load_data(csv_path)
    X, y_risk, y_shelf, y_spoiled, encoders, feature_cols = prepare_features(df2)

    print(f'\n  Samples: {X.shape[0]}, Features: {X.shape[1]}')
    rf_cls, rf_reg, rf_spl, metrics = train_models(X, y_risk, y_shelf, y_spoiled)
    save_models(rf_cls, rf_reg, rf_spl, encoders, metrics)

    # ── Summary ─────────────────────────────────────────────────────────────
    print('\n' + '=' * 60)
    print('ALL DONE!')
    print('=' * 60)
    print(f'  Excel file : {xlsx_path}')
    print(f'  CSV file   : {csv_path}')
    print(f'  Models dir : {model_dir}/')
    print(f'\n  Risk Classifier Accuracy   : {metrics["risk_accuracy"]*100:.1f}%')
    print(f'  Shelf Life Regressor R²    : {metrics["shelf_r2"]:.4f}')
    print(f'  Spoilage Classifier Accuracy: {metrics["spoilage_accuracy"]*100:.1f}%')
    print(f'\n  You can show the Excel file to your teacher:')
    print(f'  → {os.path.abspath(xlsx_path)}')


if __name__ == '__main__':
    main()
