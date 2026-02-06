import numpy as np
import random
from datetime import datetime, timedelta


def generate_synthetic_listings(n=200):
    """Generate synthetic listing data for model bootstrapping."""
    categories = ['cooked-food', 'bakery', 'fruits-vegetables', 'dairy', 'packaged', 'beverages']
    units = ['kg', 'plates', 'packets', 'litres', 'pieces']

    data = []
    base_date = datetime.now() - timedelta(days=90)

    for i in range(n):
        # Generate realistic timestamps
        day_offset = random.randint(0, 89)
        hour = random.choices(
            range(24),
            weights=[1, 0.5, 0.3, 0.2, 0.2, 0.5, 2, 3, 4, 5, 8, 10, 10, 8, 6, 5, 5, 6, 8, 9, 7, 5, 3, 2],
            k=1
        )[0]

        dt = base_date + timedelta(days=day_offset, hours=hour, minutes=random.randint(0, 59))
        category = random.choice(categories)

        qty_ranges = {
            'cooked-food': (3, 30),
            'bakery': (5, 50),
            'fruits-vegetables': (5, 40),
            'dairy': (2, 20),
            'packaged': (5, 60),
            'beverages': (3, 25),
        }
        qty_min, qty_max = qty_ranges.get(category, (5, 30))
        quantity = round(random.uniform(qty_min, qty_max), 1)

        # Delhi NCR coordinates with some spread
        lat = 28.6139 + random.uniform(-0.15, 0.15)
        lng = 77.2090 + random.uniform(-0.15, 0.15)

        statuses = random.choices(
            ['collected', 'active', 'expired', 'claimed'],
            weights=[0.5, 0.2, 0.2, 0.1],
            k=1
        )[0]

        data.append({
            'id': i + 1,
            'donorId': random.randint(1, 20),
            'foodName': f'Food Item {i+1}',
            'category': category,
            'quantity': quantity,
            'unit': random.choice(units),
            'latitude': round(lat, 6),
            'longitude': round(lng, 6),
            'status': statuses,
            'createdAt': dt.isoformat(),
            'hour': hour,
            'dayOfWeek': dt.weekday(),
        })

    return data
