"""Main entry point for RL HABITT backend.

This module provides a unified entry point to run either the CLI or the API server.
"""
import os
import sys
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

def run_cli():
    """Run the CLI."""
    from . import __main__
    sys.exit(__main__.main())

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
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="RL HABITT Backend - Run as CLI or API server"
    )
    
    # Create subparsers for different modes
    subparsers = parser.add_subparsers(dest='mode', help='Mode to run')
    
    # CLI mode
    cli_parser = subparsers.add_parser('cli', help='Run in CLI mode')
    
    # API mode
    api_parser = subparsers.add_parser('api', help='Run as API server')
    api_parser.add_argument(
        '--host', 
        default=os.getenv('API_HOST', '0.0.0.0'),
        help='Host to bind the server to (default: 0.0.0.0)'
    )
    api_parser.add_argument(
        '--port', 
        type=int,
        default=int(os.getenv('API_PORT', 5000)),
        help='Port to bind the server to (default: 5000)'
    )
    api_parser.add_argument(
        '--debug',
        action='store_true',
        help='Run the server in debug mode'
    )
    
    args = parser.parse_args()
    
    # Default to CLI mode if no mode specified
    if not args.mode:
        run_cli()
        return
    
    # Run in specified mode
    if args.mode == 'cli':
        run_cli()
    elif args.mode == 'api':
        run_api(host=args.host, port=args.port, debug=args.debug)

if __name__ == '__main__':
    main()