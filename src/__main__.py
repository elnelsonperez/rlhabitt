import sys
import os
import argparse
import logging
from dotenv import load_dotenv
from .downloader import OneDriveDownloader

# Load environment variables from .env file
load_dotenv()

logger = logging.getLogger(__name__)

def main():
    parser = argparse.ArgumentParser(description="Download shared files from OneDrive")
    parser.add_argument("file_id", help="OneDrive file ID (format: 'driveId!itemId')")
    parser.add_argument("-o", "--output", help="Output file path (default: current directory with original filename)")
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose output")
    
    args = parser.parse_args()
    
    try:
        # Initialize downloader with verbose flag
        downloader = OneDriveDownloader(verbose=args.verbose)
        
        # Download the file
        output_path = downloader.download_file(args.file_id, args.output)
        
        # No need to print here as the logger in downloader will handle it
        return 0
    except Exception as e:
        logger.error(f"Error: {e}")
        # In non-verbose mode, ensure the error is printed to stderr
        if not args.verbose:
            print(f"Error: {e}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())