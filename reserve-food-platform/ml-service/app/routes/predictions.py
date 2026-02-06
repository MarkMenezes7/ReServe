from flask import Blueprint, jsonify, request
import numpy as np

predictions_bp = Blueprint('predictions', __name__)


@predictions_bp.route('/predict/availability', methods=['POST'])
def predict_availability():
    data = request.get_json() or {}
    hour = data.get('hour', 12)
    day_of_week = data.get('dayOfWeek', 3)
    category = data.get('category', 'cooked-food')

    # Simple heuristic model (will be replaced with trained model)
    base_prob = 50
    # Peak hours boost
    if 10 <= hour <= 14 or 18 <= hour <= 21:
        base_prob += 20
    # Weekend boost
    if day_of_week in [0, 6]:
        base_prob += 10
    # Category adjustment
    cat_boost = {'cooked-food': 15, 'bakery': 10, 'fruits-vegetables': 8, 'dairy': 5, 'packaged': 3}
    base_prob += cat_boost.get(category, 0)

    probability = min(100, max(0, base_prob + np.random.randint(-5, 6)))

    return jsonify({
        'probability': float(probability),
        'confidence': 'medium',
        'factors': {
            'hour': hour,
            'dayOfWeek': day_of_week,
            'category': category,
        },
        'source': 'ml'
    })


@predictions_bp.route('/predict/quantity', methods=['POST'])
def predict_quantity():
    data = request.get_json() or {}
    category = data.get('category', 'cooked-food')
    hour = data.get('hour', 12)

    # Simple heuristic
    base_qty = {'cooked-food': 15, 'bakery': 20, 'fruits-vegetables': 25, 'dairy': 10, 'packaged': 30}
    qty = base_qty.get(category, 15)

    if 10 <= hour <= 14:
        qty *= 1.3
    elif 18 <= hour <= 21:
        qty *= 1.5

    qty += np.random.uniform(-3, 3)

    return jsonify({
        'predictedQuantity': round(float(qty), 1),
        'unit': 'kg',
        'confidence': 'medium',
        'source': 'ml'
    })


@predictions_bp.route('/predict/category', methods=['POST'])
def predict_category():
    data = request.get_json() or {}
    hour = data.get('hour', 12)
    day_of_week = data.get('dayOfWeek', 3)

    categories = ['cooked-food', 'bakery', 'fruits-vegetables', 'dairy', 'packaged', 'beverages', 'other']

    # Time-based probability distribution
    if 6 <= hour <= 10:
        probs = [0.15, 0.35, 0.15, 0.15, 0.1, 0.05, 0.05]
    elif 11 <= hour <= 14:
        probs = [0.4, 0.15, 0.15, 0.1, 0.1, 0.05, 0.05]
    elif 15 <= hour <= 18:
        probs = [0.2, 0.25, 0.2, 0.1, 0.15, 0.05, 0.05]
    else:
        probs = [0.3, 0.1, 0.1, 0.1, 0.2, 0.1, 0.1]

    predictions = [
        {'category': cat, 'probability': round(float(p * 100), 1)}
        for cat, p in sorted(zip(categories, probs), key=lambda x: -x[1])
    ]

    return jsonify({
        'predictions': predictions,
        'source': 'ml'
    })
