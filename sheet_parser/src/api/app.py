"""Flask API for RL HABITT Backend."""
import os
import logging
import argparse
from datetime import datetime
from flask import Flask, jsonify
from flask_cors import CORS

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def configure_logging(verbose=False):
    """Configure logging based on verbosity level."""
    level = logging.DEBUG if verbose else logging.INFO
    format_str = '%(asctime)s - %(name)s - %(levelname)s - %(message)s' if verbose else '%(levelname)s: %(message)s'
    
    logging.basicConfig(
        level=level,
        format=format_str
    )
    return logging.getLogger(__name__)

# Configure default logging
logger = configure_logging()

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
    from .onedrive_auth_route import onedrive_auth_bp
    from .communication_routes import communication_bp
    
    # Initialize the cache for reservation routes
    init_cache(app)
    
    # Register blueprints
    app.register_blueprint(reservation_bp)
    app.register_blueprint(import_bp)
    app.register_blueprint(onedrive_auth_bp)
    app.register_blueprint(communication_bp)
    
    return app

def run_server(host='0.0.0.0', port=5000, debug=False):
    """Run the Flask API server."""
    app = create_app()
    
    logger.info(f"Starting API server on {host}:{port}")
    app.run(host=host, port=port, debug=debug)

def main():
    """Command line entry point for the API server."""
    parser = argparse.ArgumentParser(
        description="RL HABITT Backend - API Server"
    )
    
    parser.add_argument(
        '--host', 
        default=os.getenv('API_HOST', '0.0.0.0'),
        help='Host to bind the server to (default: 0.0.0.0)'
    )
    parser.add_argument(
        '--port', 
        type=int,
        default=int(os.getenv('API_PORT', 5056)),
        help='Port to bind the server to (default: 5056)'
    )
    parser.add_argument(
        '--debug',
        action='store_true',
        help='Run the server in debug mode'
    )
    
    args = parser.parse_args()
    
    # Reconfigure logging for debug if needed
    if args.debug:
        configure_logging(verbose=True)
    
    # Run API server
    run_server(host=args.host, port=args.port, debug=args.debug)

if __name__ == '__main__':
    main()