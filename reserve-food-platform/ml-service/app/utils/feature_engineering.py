import numpy as np
from datetime import datetime


def extract_time_features(timestamp_str):
    """Extract time-based features from a timestamp string."""
    try:
        dt = datetime.fromisoformat(timestamp_str)
    except (ValueError, TypeError):
        dt = datetime.now()

    return {
        'hour': dt.hour,
        'dayOfWeek': dt.weekday(),
        'month': dt.month,
        'isWeekend': 1 if dt.weekday() >= 5 else 0,
        'isPeakHour': 1 if (10 <= dt.hour <= 14 or 18 <= dt.hour <= 21) else 0,
        'quarter': (dt.month - 1) // 3 + 1,
    }


def encode_category(category):
    """One-hot encode food category."""
    categories = ['cooked-food', 'bakery', 'fruits-vegetables', 'dairy', 'packaged', 'beverages', 'other']
    encoding = [1 if category == cat else 0 for cat in categories]
    return encoding


def normalize_features(features, min_vals=None, max_vals=None):
    """Min-max normalize a feature array."""
    features = np.array(features, dtype=float)
    if min_vals is None:
        min_vals = features.min(axis=0)
    if max_vals is None:
        max_vals = features.max(axis=0)

    range_vals = max_vals - min_vals
    range_vals[range_vals == 0] = 1
    return (features - min_vals) / range_vals
