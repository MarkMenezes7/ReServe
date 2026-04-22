"""
ReServe Food Platform — Training Data Generator
================================================
Generates realistic synthetic training data for the food spoilage
prediction model. The data simulates real-world food donation scenarios
with scientifically-grounded shelf-life values.

Output:
  - food_spoilage_training_data.xlsx   (Excel for presentation)
  - food_spoilage_training_data.csv    (CSV for model training)
"""

import os
import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

# ─── Seed for reproducibility ───────────────────────────────────────────────────
random.seed(42)
np.random.seed(42)

# ─── Constants ───────────────────────────────────────────────────────────────────

CATEGORIES = {
    'cooked-meals': {
        'names': [
            'Rice & Dal', 'Vegetable Biryani', 'Paneer Butter Masala',
            'Chicken Curry', 'Roti & Sabzi', 'Pasta Alfredo',
            'Fried Rice', 'Sambar Rice', 'Chole Bhature',
            'Rajma Chawal', 'Egg Curry', 'Fish Fry',
            'Pulao', 'Khichdi', 'Kadhi Pakora',
            'Mutton Rogan Josh', 'Butter Chicken', 'Palak Paneer',
            'Mixed Veg Curry', 'Aloo Gobi',
        ],
        'base_shelf_hours': 4,      # Room-temp shelf life (hours)
        'quantity_range': (2, 25),   # kg
    },
    'bakery': {
        'names': [
            'White Bread', 'Whole Wheat Bread', 'Croissants', 'Muffins',
            'Cupcakes', 'Cookies', 'Puff Pastry', 'Buns',
            'Fruit Cake', 'Brownies', 'Donuts', 'Sandwich Bread',
            'Naan Bread', 'Garlic Bread', 'Banana Bread',
            'Dinner Rolls', 'Bagels', 'Scones', 'Rusk', 'Toast',
        ],
        'base_shelf_hours': 48,
        'quantity_range': (5, 40),
    },
    'dairy': {
        'names': [
            'Fresh Milk', 'Curd / Yogurt', 'Paneer', 'Cheese Slices',
            'Butter', 'Cream', 'Buttermilk', 'Lassi',
            'Flavoured Yogurt', 'Cottage Cheese', 'Whey Protein Shake',
            'Milkshake', 'Ice Cream Tub', 'Kheer', 'Raita',
            'Shrikhand', 'Mishti Doi', 'Mozzarella', 'Ghee', 'Condensed Milk',
        ],
        'base_shelf_hours': 6,
        'quantity_range': (1, 15),
    },
    'fruits-vegetables': {
        'names': [
            'Bananas', 'Apples', 'Tomatoes', 'Potatoes', 'Onions',
            'Spinach', 'Carrots', 'Cucumber', 'Mangoes', 'Oranges',
            'Mixed Salad', 'Bell Peppers', 'Cauliflower', 'Cabbage',
            'Grapes', 'Watermelon Slices', 'Papaya', 'Sweet Corn',
            'Broccoli', 'Green Beans',
        ],
        'base_shelf_hours': 72,
        'quantity_range': (3, 35),
    },
    'packaged-food': {
        'names': [
            'Biscuit Packets', 'Chips / Crisps', 'Instant Noodles',
            'Canned Beans', 'Protein Bars', 'Cereal Box',
            'Peanut Butter Jar', 'Jam Bottle', 'Dried Fruits Pack',
            'Granola Mix', 'Ready-to-Eat Meals', 'Soup Packets',
            'Rice Packets', 'Flour Bag', 'Sugar Packets',
            'Namkeen Mix', 'Papad Packets', 'Pickle Jar',
            'Poha Mix', 'Upma Mix',
        ],
        'base_shelf_hours': 720,   # 30 days
        'quantity_range': (5, 50),
    },
    'beverages': {
        'names': [
            'Fruit Juice Cartons', 'Cold Coffee', 'Lemonade',
            'Coconut Water', 'Iced Tea', 'Smoothies',
            'Mango Lassi', 'Sugarcane Juice', 'Herbal Tea Flask',
            'Protein Shake', 'Milkshake Bottles', 'Sparkling Water',
            'Buttermilk Packs', 'Masala Chai Flask', 'Green Juice',
            'Orange Juice', 'Watermelon Juice', 'Lemon Soda',
            'Kombucha', 'Energy Drinks',
        ],
        'base_shelf_hours': 168,   # 7 days
        'quantity_range': (2, 20),
    },
}

STORAGE_TYPES = ['room-temperature', 'refrigerated', 'frozen']

STORAGE_MULTIPLIERS = {
    'room-temperature': 1.0,
    'refrigerated': 3.5,
    'frozen': 12.0,
}

FOOD_TYPES = ['veg', 'non-veg']

FOOD_TYPE_MULTIPLIERS = {
    'veg': 1.0,
    'non-veg': 0.7,
}

CITIES = [
    'New Delhi', 'Mumbai', 'Bangalore', 'Hyderabad', 'Chennai',
    'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow',
    'Chandigarh', 'Noida', 'Gurgaon', 'Kochi', 'Indore',
]


def generate_training_data(n_samples: int = 2000) -> pd.DataFrame:
    """
    Generate n_samples rows of realistic food spoilage training data.
    Each row represents a food donation with features and a spoilage label.
    """
    records = []
    base_date = datetime(2026, 1, 1)

    for i in range(n_samples):
        # Pick random category
        category = random.choice(list(CATEGORIES.keys()))
        cat_info = CATEGORIES[category]

        # Food details
        food_name = random.choice(cat_info['names'])
        food_type = random.choice(FOOD_TYPES)

        # Cooked meals are more likely non-veg variety
        if category == 'cooked-meals':
            food_type = random.choices(['veg', 'non-veg'], weights=[0.55, 0.45])[0]
        elif category in ['fruits-vegetables', 'bakery']:
            food_type = random.choices(['veg', 'non-veg'], weights=[0.9, 0.1])[0]
        elif category == 'dairy':
            food_type = 'veg'

        # Storage
        storage_type = random.choice(STORAGE_TYPES)
        # Packaged food is usually room-temp
        if category == 'packaged-food':
            storage_type = random.choices(
                STORAGE_TYPES, weights=[0.7, 0.2, 0.1]
            )[0]
        # Dairy is usually refrigerated
        if category == 'dairy':
            storage_type = random.choices(
                STORAGE_TYPES, weights=[0.1, 0.7, 0.2]
            )[0]

        # Quantity
        qty_min, qty_max = cat_info['quantity_range']
        quantity = round(random.uniform(qty_min, qty_max), 1)

        # Donation date/time
        day_offset = random.randint(0, 364)
        hour = random.choices(
            range(24),
            weights=[
                1, 0.5, 0.3, 0.2, 0.2, 0.5,   # 0-5  (night)
                2, 3, 5, 7, 10, 12,             # 6-11 (morning)
                11, 10, 8, 6, 5, 6,             # 12-17 (afternoon)
                8, 10, 8, 5, 3, 2,              # 18-23 (evening)
            ],
            k=1,
        )[0]
        donation_datetime = base_date + timedelta(days=day_offset, hours=hour, minutes=random.randint(0, 59))

        # City
        city = random.choice(CITIES)

        # ── Compute shelf life ──────────────────────────────────────────────
        base_shelf = cat_info['base_shelf_hours']
        s_mult = STORAGE_MULTIPLIERS[storage_type]
        f_mult = FOOD_TYPE_MULTIPLIERS[food_type]

        # Add natural variance (±8% — tight enough to keep patterns learnable)
        variance = np.random.uniform(0.92, 1.08)
        shelf_life_hours = round(base_shelf * s_mult * f_mult * variance, 1)

        shelf_life_hours = round(max(1, shelf_life_hours), 1)

        # ── Hours since preparation (random elapsed time) ───────────────────
        # Simulate that someone checks the food at a random point in time
        max_elapsed = shelf_life_hours * 1.5   # can go past shelf life
        hours_since_prepared = round(random.uniform(0, max_elapsed), 1)

        # ── Remaining shelf life ────────────────────────────────────────────
        remaining_hours = round(max(0, shelf_life_hours - hours_since_prepared), 1)

        # ── Spoilage risk level ─────────────────────────────────────────────
        ratio = remaining_hours / shelf_life_hours if shelf_life_hours > 0 else 0
        if ratio > 0.6:
            risk_level = 'Low'
        elif ratio > 0.3:
            risk_level = 'Medium'
        else:
            risk_level = 'High'

        # ── Binary spoilage label (is_spoiled) ──────────────────────────────
        # Food is "spoiled" if elapsed time exceeds shelf life
        # Minimal noise so model can learn clean patterns
        if hours_since_prepared >= shelf_life_hours:
            is_spoiled = 0 if random.random() < 0.01 else 1   # 1 % outlier survives
        elif hours_since_prepared >= shelf_life_hours * 0.9:
            is_spoiled = 1 if random.random() < 0.08 else 0   # 8 % spoil near end
        else:
            is_spoiled = 1 if random.random() < 0.02 else 0   # 2 % random early spoilage

        # ── Confidence ──────────────────────────────────────────────────────
        well_known = ['cooked-meals', 'dairy', 'bakery']
        confidence = 'High' if category in well_known else 'Medium'

        records.append({
            'Sample_ID': i + 1,
            'Food_Name': food_name,
            'Category': category,
            'Food_Type': food_type,
            'Storage_Type': storage_type,
            'Quantity_kg': quantity,
            'City': city,
            'Donation_DateTime': donation_datetime.strftime('%Y-%m-%d %H:%M'),
            'Hour_of_Day': hour,
            'Day_of_Week': donation_datetime.strftime('%A'),
            'Shelf_Life_Hours': shelf_life_hours,
            'Hours_Since_Prepared': hours_since_prepared,
            'Remaining_Hours': remaining_hours,
            'Spoilage_Risk': risk_level,
            'Is_Spoiled': is_spoiled,
            'Prediction_Confidence': confidence,
        })

    df = pd.DataFrame(records)
    return df


def export_data(df: pd.DataFrame, output_dir: str = None):
    """Save the DataFrame as both Excel (.xlsx) and CSV."""
    if output_dir is None:
        output_dir = os.path.dirname(os.path.abspath(__file__))

    os.makedirs(output_dir, exist_ok=True)

    csv_path = os.path.join(output_dir, 'food_spoilage_training_data.csv')
    xlsx_path = os.path.join(output_dir, 'food_spoilage_training_data.xlsx')

    # ── CSV ──
    df.to_csv(csv_path, index=False)
    print(f'  CSV  saved → {csv_path}')

    # ── Excel with formatting ──
    with pd.ExcelWriter(xlsx_path, engine='openpyxl') as writer:
        # Sheet 1: Full Training Data
        df.to_excel(writer, sheet_name='Training Data', index=False)

        # Sheet 2: Summary Statistics
        summary = df.describe(include='all').T
        summary.to_excel(writer, sheet_name='Summary Statistics')

        # Sheet 3: Category-wise Stats
        cat_stats = df.groupby('Category').agg(
            Total_Samples=('Sample_ID', 'count'),
            Avg_Shelf_Life_Hours=('Shelf_Life_Hours', 'mean'),
            Avg_Quantity_kg=('Quantity_kg', 'mean'),
            Spoiled_Count=('Is_Spoiled', 'sum'),
            Spoilage_Rate_Percent=('Is_Spoiled', lambda x: round(x.mean() * 100, 1)),
        ).reset_index()
        cat_stats.to_excel(writer, sheet_name='Category Analysis', index=False)

        # Sheet 4: Storage-wise Stats
        storage_stats = df.groupby('Storage_Type').agg(
            Total_Samples=('Sample_ID', 'count'),
            Avg_Shelf_Life_Hours=('Shelf_Life_Hours', 'mean'),
            Spoiled_Count=('Is_Spoiled', 'sum'),
            Spoilage_Rate_Percent=('Is_Spoiled', lambda x: round(x.mean() * 100, 1)),
        ).reset_index()
        storage_stats.to_excel(writer, sheet_name='Storage Analysis', index=False)

        # Sheet 5: Risk Distribution
        risk_dist = df.groupby(['Category', 'Spoilage_Risk']).size().unstack(fill_value=0)
        risk_dist.to_excel(writer, sheet_name='Risk Distribution')

        # Format column widths on the Training Data sheet
        ws = writer.sheets['Training Data']
        for col_idx, col_name in enumerate(df.columns, 1):
            max_len = max(len(str(col_name)), df[col_name].astype(str).map(len).max())
            ws.column_dimensions[chr(64 + col_idx) if col_idx <= 26 else 'A'].width = min(max_len + 3, 30)

    print(f'  Excel saved → {xlsx_path}')
    return csv_path, xlsx_path


# ─── Run directly ────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print('Generating 5000 training samples...')
    df = generate_training_data(5000)
    export_data(df)

    print(f'\nDataset shape: {df.shape}')
    print(f'\nSpoilage distribution:\n{df["Is_Spoiled"].value_counts()}')
    print(f'\nRisk distribution:\n{df["Spoilage_Risk"].value_counts()}')
    print(f'\nCategory distribution:\n{df["Category"].value_counts()}')
