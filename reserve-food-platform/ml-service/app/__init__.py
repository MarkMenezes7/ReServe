from flask import Flask
from flask_cors import CORS

def create_app():
    app = Flask(__name__)
    CORS(app)

    from app.routes.predictions import predictions_bp
    from app.routes.forecasting import forecasting_bp
    from app.routes.analytics import analytics_bp
    from app.routes.health import health_bp

    app.register_blueprint(predictions_bp, url_prefix='/api/ml')
    app.register_blueprint(forecasting_bp, url_prefix='/api/ml')
    app.register_blueprint(analytics_bp, url_prefix='/api/ml')
    app.register_blueprint(health_bp, url_prefix='/api/ml')

    return app
