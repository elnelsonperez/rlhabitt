#!/usr/bin/env python3
"""
Import reservation data from Excel sheets using the Supabase API.
"""

import os
import sys
import json
import logging
import argparse
from pathlib import Path
from dotenv import load_dotenv

from src.xlsx_parser import CondoRentalParser
from src.supabase_importer import SupabaseImporter

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def parse_excel_to_json(file_path, sheet_name=None, output_file=None, verbose=False):
    """
    Parse Excel file to JSON format.
    
    Args:
        file_path: Path to the Excel file
        sheet_name: Optional sheet name to parse (if None, parse all sheets)
        output_file: Path to save JSON output (if None, print to stdout)
        verbose: Enable verbose logging
    
    Returns:
        dict: Parsed data as a dictionary
    """
    parser = CondoRentalParser(file_path, verbose=verbose)
    
    if not parser.load_workbook():
        logger.error(f"Failed to load workbook: {file_path}")
        return None
    
    sheet_names = parser.get_sheet_names()
    if not sheet_names:
        logger.error("No sheets found in the workbook")
        return None
    
    # If specific sheet requested, parse only that sheet
    if sheet_name:
        if sheet_name not in sheet_names:
            logger.error(f"Sheet '{sheet_name}' not found in workbook")
            return None
        
        logger.info(f"Parsing sheet: {sheet_name}")
        result = parser.parse_sheet(sheet_name)
        
        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            logger.info(f"JSON data saved to: {output_file}")
        
        return result
    
    # Otherwise parse all sheets
    logger.info(f"Parsing all sheets in workbook")
    
    # For multi-sheet parsing, we'll use a different format
    all_sheets = []
    for sheet_name in sheet_names:
        month_num, year = parser.parse_sheet_date(sheet_name)
        if month_num is None or year is None:
            logger.warning(f"Skipping sheet with invalid name: {sheet_name}")
            continue
        
        sheet_data = parser.parse_sheet(sheet_name)
        if sheet_data:
            all_sheets.append({
                "name": sheet_name,
                "data": sheet_data
            })
    
    result = {"sheets": all_sheets}
    
    if output_file:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        logger.info(f"JSON data saved to: {output_file}")
    
    return result

def import_json_to_supabase(json_data, verbose=False):
    """
    Import JSON data to Supabase.
    
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
        importer = SupabaseImporter()
        
        # Import the data
        logger.info("Importing data to Supabase")
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
    
    parser = argparse.ArgumentParser(description="Import reservation data from Excel to Supabase")
    parser.add_argument("file_path", help="Path to Excel file or JSON file to import")
    parser.add_argument("--sheet", help="Specific sheet name to import (default: all sheets)")
    parser.add_argument("--json", help="Output JSON to this file instead of importing")
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose logging")
    
    args = parser.parse_args()
    
    # Determine if input is Excel or JSON
    file_path = args.file_path
    file_ext = Path(file_path).suffix.lower()
    
    if file_ext in ['.xlsx', '.xls']:
        # Parse Excel to JSON
        json_data = parse_excel_to_json(
            file_path=file_path,
            sheet_name=args.sheet,
            output_file=args.json,
            verbose=args.verbose
        )
        
        # If only JSON output requested, stop here
        if args.json:
            return 0
        
        # Otherwise import the JSON data
        if json_data:
            import_id = import_json_to_supabase(
                json_data=json_data,
                verbose=args.verbose
            )
            return 0 if import_id else 1
        else:
            return 1
    
    elif file_ext == '.json':
        # Import directly from JSON file
        import_id = import_json_to_supabase(
            json_data=file_path,
            verbose=args.verbose
        )
        return 0 if import_id else 1
    
    else:
        logger.error(f"Unsupported file type: {file_ext}")
        return 1

if __name__ == "__main__":
    sys.exit(main())