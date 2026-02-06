from app import create_app
from app.config import PORT

app = create_app()

if __name__ == '__main__':
    print(f'ReServe ML Service starting on port {PORT}...')
    app.run(host='0.0.0.0', port=PORT, debug=True)
