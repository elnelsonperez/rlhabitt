#!/usr/bin/env python3
"""
Import reservation data from JSON files to PostgreSQL database.
"""

import sys
import json
import logging
import argparse
from pathlib import Path
from dotenv import load_dotenv

from src.postgres_importer import PostgresImporter

# Configure logging with detailed formatting
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

def import_json_to_postgres(json_data, verbose=False):
    """
    Import JSON data to PostgreSQL database.
    
    Args:
        json_data: JSON data as dictionary or path to JSON file
        verbose: Enable verbose logging
    
    Returns:
        str: Import log UUID
    """
    # If json_data is a string, try to load it as a file path
    if isinstance(json_data, str):
        try:
            with open(json_data, 'r', encoding='utf-8') as f:
                json_data = json.load(f)
        except (IOError, json.JSONDecodeError) as e:
            logger.error(f"Failed to load JSON file: {e}")
            return None
    
    # Create importer
    try:
        # Set logging level to DEBUG if verbose is True
        if verbose:
            logging.getLogger('src.postgres_importer').setLevel(logging.DEBUG)
        
        importer = PostgresImporter()
        
        # Import the data
        logger.info("Starting import process to PostgreSQL database")
        import_id = importer.import_json(json_data)
        
        logger.info(f"Import completed successfully with ID: {import_id}")
        return import_id
        
    except Exception as e:
        logger.error(f"Failed to import data: {e}")
        if verbose:
            logger.exception(e)
        return None

def main():
    # Load environment variables from .env file
    load_dotenv()
    
    parser = argparse.ArgumentParser(description="Import reservation data from JSON to PostgreSQL")
    parser.add_argument("file_path", help="Path to JSON file to import")
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose logging")
    
    args = parser.parse_args()
    
    # Validate file is JSON
    file_path = args.file_path
    file_ext = Path(file_path).suffix.lower()
    
    if file_ext != '.json':
        logger.error(f"Unsupported file type: {file_ext}, only .json files are supported")
        return 1
    
    # Import directly from JSON file
    logger.info(f"Importing data from {file_path}")
    import_id = import_json_to_postgres(
        json_data=file_path,
        verbose=args.verbose
    )
    
    return 0 if import_id else 1

if __name__ == "__main__":
    sys.exit(main())