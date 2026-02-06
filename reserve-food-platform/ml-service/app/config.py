import os

DB_PATH = os.environ.get('DB_PATH', os.path.join(os.path.dirname(__file__), '..', '..', 'backend', 'reserve.db'))
MODEL_DIR = os.path.join(os.path.dirname(__file__), '..', 'models_saved')
PORT = int(os.environ.get('ML_PORT', 5001))
