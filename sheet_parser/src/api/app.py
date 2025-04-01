"""Flask API for RL HABITT Backend."""
import os
import logging
from datetime import datetime
from flask import Flask, jsonify
from flask_cors import CORS

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def create_app():
    """Create and configure the Flask app."""
    app = Flask(__name__)
    
    # Enable CORS for all routes
    CORS(app)
    
    # Set config values from environment variables
    app.config["API_CACHE_DIR"] = os.getenv("API_CACHE_DIR", None)
    app.config["API_CACHE_EXPIRE_TIME"] = int(os.getenv("API_CACHE_EXPIRE_TIME", 3600))
    
    # Health check endpoint
    @app.route('/health', methods=['GET'])
    def health_check():
        """Health check endpoint."""
        return jsonify({"status": "ok", "timestamp": datetime.now().isoformat()})
    
    # Register blueprints
    from .reservation_routes import reservation_bp, init_cache
    from .import_routes import import_bp
    
    # Initialize the cache for reservation routes
    init_cache(app)
    
    # Register blueprints
    app.register_blueprint(reservation_bp)
    app.register_blueprint(import_bp)
    
    return app

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)