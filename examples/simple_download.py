"""
Simple example showing how to download a shared OneDrive file.

Environment variables will be loaded from .env file automatically.
"""
import os
import sys
import argparse
from dotenv import load_dotenv
from src.main import download_file

def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Download a shared OneDrive file")
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose output")
    parser.add_argument("-o", "--output", help="Path to save the downloaded file")
    args = parser.parse_args()
    
    # Load environment variables from .env file
    load_dotenv()
    
    # Check if client ID is set
    if not os.environ.get("ONEDRIVE_CLIENT_ID"):
        print("Error: ONEDRIVE_CLIENT_ID environment variable is not set", file=sys.stderr)
        print("Please create a .env file based on .env.example", file=sys.stderr)
        return 1
    
    # Example file ID (replace with a real one)
    file_id = "2124047165A6F26!493036"
    
    try:
        # Download the file with verbose flag if specified
        output_path = download_file(file_id, args.output, verbose=args.verbose)
        
        # Success message only if not in verbose mode (logging will handle it if verbose)
        if not args.verbose:
            print(f"File downloaded successfully to: {output_path}")
        
        return 0
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())