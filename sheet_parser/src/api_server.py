"""API server for RL HABITT backend.

This module provides the entry point to run the API server.
"""
import os
import logging
import argparse
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def configure_logging(verbose=False):
    """Configure logging based on verbosity level."""
    if verbose:
        logging.basicConfig(
            level=logging.DEBUG,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
    else:
        logging.basicConfig(
            level=logging.INFO,
            format='%(levelname)s: %(message)s'
        )

def run_api(host='0.0.0.0', port=5000, debug=False):
    """Run the Flask API server."""
    from .api.app import create_app
    app = create_app()
    
    print(f"Starting API server on {host}:{port}")
    app.run(host=host, port=port, debug=debug)

def download_file(file_id, output_path=None, verbose=False):
    """
    Download a shared file from OneDrive using its file ID.
    
    Args:
        file_id (str): The OneDrive file ID in the format 'driveId!itemId'
        output_path (str, optional): Path where the file should be saved.
                              If not provided, saves to current directory
                              with the original filename.
        verbose (bool, optional): Enable verbose logging output. Default is False.
    
    Returns:
        str: The path to the downloaded file
    """
    # Configure logging
    configure_logging(verbose)
    
    # Create downloader with verbose flag
    from .downloader import OneDriveDownloader
    downloader = OneDriveDownloader(verbose=verbose)
    
    # Download the file
    return downloader.download_file(file_id, output_path)

def main():
    """Main entry point for API server."""
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
        default=int(os.getenv('API_PORT', 5052)),
        help='Port to bind the server to (default: 5052)'
    )
    parser.add_argument(
        '--debug',
        action='store_true',
        help='Run the server in debug mode'
    )
    
    args = parser.parse_args()
    
    # Configure logging
    configure_logging(args.debug)
    
    # Run API server
    run_api(host=args.host, port=args.port, debug=args.debug)

if __name__ == '__main__':
    main()