"""WSGI entry point for the application."""
from sheet_parser.src.api.app import create_app

# Create the Flask application
application = create_app()

# For running with gunicorn
app = application

if __name__ == "__main__":
    application.run()