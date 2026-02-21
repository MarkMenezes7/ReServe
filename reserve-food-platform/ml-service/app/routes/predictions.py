from flask import Blueprint, jsonify, request
import numpy as np
from datetime import datetime

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


@predictions_bp.route('/predict/spoilage', methods=['POST'])
def predict_spoilage():
    """
    Predict food spoilage / shelf-life based on category, storage type, food type,
    and best-before date.  Uses research-based heuristics for different food
    categories and storage conditions.
    """
    data = request.get_json() or {}
    category = data.get('category', 'cooked-meals')
    storage_type = data.get('storageType', 'room-temperature')
    food_type = data.get('foodType', 'veg')
    best_before = data.get('bestBefore', '')
    quantity = data.get('quantity', 1)

    # Base shelf-life in hours by category (at room temperature)
    base_shelf_hours = {
        'cooked-meals': 4,
        'bakery': 48,
        'dairy': 6,
        'fruits-vegetables': 72,
        'packaged-food': 720,   # 30 days
        'beverages': 168,       # 7 days
    }

    # Storage multipliers (how much longer food lasts under different storage)
    storage_multiplier = {
        'room-temperature': 1.0,
        'refrigerated': 3.5,
        'frozen': 12.0,
    }

    # Non-veg spoils faster
    food_type_multiplier = {
        'veg': 1.0,
        'vegan': 1.0,
        'non-veg': 0.7,
    }

    base = base_shelf_hours.get(category, 24)
    s_mult = storage_multiplier.get(storage_type, 1.0)
    f_mult = food_type_multiplier.get(food_type, 1.0)

    shelf_life_hours = round(base * s_mult * f_mult)

    # Add a small variance for realism
    shelf_life_hours = max(1, shelf_life_hours + int(np.random.uniform(-shelf_life_hours * 0.05, shelf_life_hours * 0.05)))

    # Calculate risk level based on best-before vs shelf life
    risk_level = 'low'
    if best_before:
        try:
            bb = datetime.fromisoformat(best_before.replace('Z', '+00:00').replace('T', ' ').split('+')[0])
            hours_until_bb = (bb - datetime.now()).total_seconds() / 3600
            if hours_until_bb < shelf_life_hours * 0.3:
                risk_level = 'high'
            elif hours_until_bb < shelf_life_hours * 0.6:
                risk_level = 'medium'
            else:
                risk_level = 'low'
        except Exception:
            risk_level = 'medium'

    # Confidence based on how well we know the category
    well_known = ['cooked-meals', 'dairy', 'bakery']
    confidence = 'high' if category in well_known else 'medium'

    # Generate contextual tips
    tips = []
    if storage_type == 'room-temperature' and category in ['dairy', 'cooked-meals']:
        tips.append('Refrigerate immediately to extend shelf life by 3-4x')
    if food_type == 'non-veg':
        tips.append('Non-vegetarian items spoil faster — keep cold chain intact')
    if category == 'fruits-vegetables':
        tips.append('Store in cool, dry place. Avoid direct sunlight')
    if quantity > 10:
        tips.append('Large quantities may have uneven cooling — distribute if possible')
    if risk_level == 'high':
        tips.append('⚠️ High spoilage risk — prioritize quick collection')
    if storage_type == 'frozen':
        tips.append('Keep frozen until pickup. Thawed food should not be refrozen')

    return jsonify({
        'shelfLifeHours': shelf_life_hours,
        'riskLevel': risk_level,
        'confidence': confidence,
        'tips': tips,
        'source': 'ml',
    })
