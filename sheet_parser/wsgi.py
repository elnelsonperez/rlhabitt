"""WSGI entry point for the application."""
import os
from src.api.app import create_app, main as run_cli

# Create the Flask application for WSGI servers to use
app = create_app()

if __name__ == "__main__":
    # When run directly, handle command line arguments
    run_cli()