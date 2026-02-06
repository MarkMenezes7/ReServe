from flask import Blueprint, jsonify
from app.services.data_service import get_db_connection

analytics_bp = Blueprint('analytics', __name__)


@analytics_bp.route('/analytics/donor-patterns')
def donor_patterns():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT u.id, u.name, u.organizationName,
                   COUNT(l.id) as donationCount,
                   AVG(l.quantity) as avgQuantity,
                   GROUP_CONCAT(DISTINCT strftime('%w', l.createdAt)) as typicalDays,
                   MAX(l.createdAt) as lastDonation
            FROM users u JOIN listings l ON l.donorId = u.id
            WHERE u.userType = 'donor'
            GROUP BY u.id ORDER BY donationCount DESC LIMIT 20
        """)

        donors = [
            {
                'id': row[0],
                'name': row[1],
                'organizationName': row[2],
                'donationCount': row[3],
                'avgQuantity': round(float(row[4]), 1) if row[4] else 0,
                'typicalDays': row[5],
                'lastDonation': row[6],
            }
            for row in cursor.fetchall()
        ]

        conn.close()
        return jsonify({'donors': donors, 'source': 'ml'})
    except Exception as e:
        return jsonify({'error': str(e), 'donors': [], 'source': 'error'})


@analytics_bp.route('/analytics/peak-hours')
def peak_hours():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT CAST(strftime('%H', createdAt) AS INTEGER) as hour, COUNT(*) as count
            FROM listings WHERE status != 'deleted'
            GROUP BY hour ORDER BY hour
        """)

        hours = [{'hour': row[0], 'count': row[1]} for row in cursor.fetchall()]

        conn.close()
        return jsonify({'hours': hours, 'source': 'ml'})
    except Exception as e:
        return jsonify({'error': str(e), 'hours': [], 'source': 'error'})


@analytics_bp.route('/analytics/category-trends')
def category_trends():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT category, strftime('%Y-%m', createdAt) as month,
                   COUNT(*) as count, SUM(quantity) as totalQuantity
            FROM listings WHERE status != 'deleted'
            GROUP BY category, month ORDER BY month DESC, count DESC
        """)

        trends = [
            {
                'category': row[0],
                'month': row[1],
                'count': row[2],
                'totalQuantity': round(float(row[3]), 1) if row[3] else 0,
            }
            for row in cursor.fetchall()
        ]

        conn.close()
        return jsonify({'trends': trends, 'source': 'ml'})
    except Exception as e:
        return jsonify({'error': str(e), 'trends': [], 'source': 'error'})
