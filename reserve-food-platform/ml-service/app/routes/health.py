from flask import Blueprint, jsonify

health_bp = Blueprint('health', __name__)


@health_bp.route('/health')
def health_check():
    return jsonify({
        'status': 'healthy',
        'service': 'reserve-ml',
        'version': '1.0.0',
        'models': {
            'availability': 'heuristic',
            'quantity': 'heuristic',
            'category': 'heuristic',
            'forecaster': 'statistical',
        }
    })
