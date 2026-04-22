from flask import Blueprint, jsonify
import os
import joblib

health_bp = Blueprint('health', __name__)

MODEL_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'models_saved')


@health_bp.route('/health')
def health_check():
    # Check if trained models exist
    models_available = os.path.exists(os.path.join(MODEL_DIR, 'rf_risk_classifier.joblib'))

    metrics = {}
    if models_available:
        try:
            metrics = joblib.load(os.path.join(MODEL_DIR, 'model_metrics.joblib'))
        except Exception:
            pass

    return jsonify({
        'status': 'healthy',
        'service': 'reserve-ml',
        'version': '2.0.0',
        'models': {
            'spoilage_risk': 'random-forest' if models_available else 'heuristic-fallback',
            'shelf_life': 'random-forest' if models_available else 'heuristic-fallback',
            'spoilage_binary': 'random-forest' if models_available else 'heuristic-fallback',
            'availability': 'heuristic',
            'quantity': 'heuristic',
            'category': 'heuristic',
            'forecaster': 'statistical',
        },
        'ml_details': {
            'algorithm': 'Random Forest (scikit-learn)',
            'n_estimators': 300,
            'training_samples': 5000,
            'risk_accuracy': round(metrics.get('risk_accuracy', 0) * 100, 1) if metrics else None,
            'shelf_r2': round(metrics.get('shelf_r2', 0), 4) if metrics else None,
            'spoilage_accuracy': round(metrics.get('spoilage_accuracy', 0) * 100, 1) if metrics else None,
        } if models_available else None,
    })
