import sys
import os
import json
import argparse
import logging
from pathlib import Path
from dotenv import load_dotenv
from .downloader import OneDriveDownloader
from .xlsx_parser import CondoRentalParser

# Load environment variables from .env file
load_dotenv()

logger = logging.getLogger(__name__)

class JSONEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle date objects"""
    def default(self, obj):
        from datetime import date
        if isinstance(obj, date):
            return obj.isoformat()
        return super().default(obj)

def configure_logging(verbose=False):
    """Configure logging based on verbosity level"""
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

def download_onedrive_file(file_id, output_path=None, verbose=False):
    """Download a file from OneDrive"""
    logger.info(f"Downloading file with ID {file_id} from OneDrive")
    try:
        # Initialize downloader with verbose flag
        downloader = OneDriveDownloader(verbose=verbose)
        
        # Download the file
        downloaded_path = downloader.download_file(file_id, output_path)
        logger.info(f"File downloaded to: {downloaded_path}")
        
        return downloaded_path
    except Exception as e:
        logger.error(f"Error downloading file: {e}")
        raise

def parse_excel_file(excel_path, sheet_name=None, parse_all=False, verbose=False):
    """Parse the Excel file and return the data"""
    logger.info(f"Parsing Excel file: {excel_path}")
    try:
        # Initialize parser with verbose flag
        parser = CondoRentalParser(excel_path, verbose=verbose)
        
        # Load the workbook
        if not parser.load_workbook():
            raise Exception(f"Failed to load workbook: {excel_path}")
        
        # Get available sheets
        sheet_names = parser.get_sheet_names()
        if not sheet_names:
            raise Exception("No sheets found in the workbook")
        
        # If parse_all flag is set, process all sheets with valid month names
        if parse_all:
            logger.info("Processing all sheets with valid month names")
            valid_sheets = []
            for s in sheet_names:
                month_num, year = parser.parse_sheet_date(s)
                if month_num is not None and year is not None:
                    valid_sheets.append(s)
            
            if not valid_sheets:
                raise Exception("No sheets found with valid month names")
            
            logger.info(f"Found {len(valid_sheets)} sheets with valid month names: {', '.join(valid_sheets)}")
            
            # Parse all valid sheets
            combined_data = {
                "sheets": []
            }
            
            for valid_sheet in valid_sheets:
                logger.info(f"Parsing sheet: {valid_sheet}")
                sheet_data = parser.parse_sheet(valid_sheet)
                if sheet_data:
                    combined_data["sheets"].append({
                        "name": valid_sheet,
                        "data": sheet_data
                    })
                else:
                    logger.warning(f"Failed to parse sheet: {valid_sheet}")
            
            if not combined_data["sheets"]:
                raise Exception("Failed to parse any sheets")
            
            return combined_data
        
        # Process a single sheet
        else:
            # If no sheet_name provided, find the first sheet with a valid month abbreviation
            if not sheet_name:
                # Try to find a sheet with a valid month abbreviation
                valid_sheet = None
                for s in sheet_names:
                    # Check if the sheet name matches the [Month]. [Year] pattern
                    month_num, year = parser.parse_sheet_date(s)
                    if month_num is not None and year is not None:
                        valid_sheet = s
                        break
                
                if valid_sheet:
                    sheet_name = valid_sheet
                    logger.info(f"No sheet specified, using first valid month sheet: {sheet_name}")
                else:
                    # Fallback to the first sheet if no valid month sheet found
                    sheet_name = sheet_names[0]
                    logger.warning(f"No valid month sheet found, using first sheet: {sheet_name}")
            elif sheet_name not in sheet_names:
                available_sheets = ", ".join(sheet_names)
                raise Exception(f"Sheet '{sheet_name}' not found. Available sheets: {available_sheets}")
            
            # Parse the sheet
            logger.info(f"Parsing sheet: {sheet_name}")
            data = parser.parse_sheet(sheet_name)
            if not data:
                raise Exception(f"Failed to parse sheet: {sheet_name}")
            
            return data
            
    except Exception as e:
        logger.error(f"Error parsing Excel file: {e}")
        raise

def save_json_data(data, output_path, pretty=False):
    """Save data as JSON to the specified path"""
    logger.info(f"Saving JSON data to: {output_path}")
    try:
        # Ensure the directory exists
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        
        # Convert to JSON
        indent = 2 if pretty else None
        json_data = json.dumps(data, indent=indent, cls=JSONEncoder)
        
        # Write to file
        with open(output_path, 'w') as f:
            f.write(json_data)
        
        logger.info(f"JSON data saved successfully to: {output_path}")
    except Exception as e:
        logger.error(f"Error saving JSON data: {e}")
        raise

def main():
    parser = argparse.ArgumentParser(
        description="Download a shared Excel file from OneDrive and parse it into JSON"
    )
    
    # Required OneDrive file ID
    parser.add_argument(
        "file_id", 
        help="OneDrive file ID (format: 'driveId!itemId')"
    )
    
    # Optional arguments
    parser.add_argument(
        "-s", "--sheet", 
        help="Name of the sheet to parse (default: first sheet with valid month name)"
    )
    parser.add_argument(
        "-a", "--all",
        action="store_true",
        help="Process all sheets with valid month names instead of just one"
    )
    parser.add_argument(
        "-o", "--output", 
        help="Output JSON file path (default: ./reservations.json)"
    )
    parser.add_argument(
        "--excel-output", 
        help="Path to save the downloaded Excel file (default: temporary file)"
    )
    parser.add_argument(
        "--pretty", 
        action="store_true", 
        help="Pretty-print the JSON output"
    )
    parser.add_argument(
        "--download-only", 
        action="store_true", 
        help="Only download the Excel file, don't parse it"
    )
    parser.add_argument(
        "--parse-only", 
        action="store_true", 
        help="Only parse the Excel file (requires --excel-output to be a valid file)"
    )
    parser.add_argument(
        "-v", "--verbose", 
        action="store_true", 
        help="Enable verbose output"
    )
    
    args = parser.parse_args()
    
    # Configure logging
    configure_logging(args.verbose)
    
    try:
        # Set default output path for JSON if not specified
        if not args.output:
            args.output = "reservations.json"
        
        # Validate options
        if args.download_only and args.parse_only:
            raise ValueError("Cannot use both --download-only and --parse-only together")
            
        if args.sheet and args.all:
            raise ValueError("Cannot use both --sheet and --all together")
        
        # Parse only mode - skip download
        if args.parse_only:
            if not args.excel_output or not os.path.exists(args.excel_output):
                raise ValueError("--parse-only requires --excel-output to be a valid file")
            
            excel_path = args.excel_output
            logger.info(f"Parse-only mode: using existing Excel file at {excel_path}")
        else:
            # Download the Excel file
            excel_path = download_onedrive_file(args.file_id, args.excel_output, args.verbose)
        
        # Skip parsing if download-only mode
        if args.download_only:
            logger.info(f"Download-only mode: Excel file saved to {excel_path}")
            return 0
        
        # Parse the Excel file
        data = parse_excel_file(excel_path, args.sheet, args.all, args.verbose)
        
        # Save the JSON data
        save_json_data(data, args.output, args.pretty)
        
        logger.info("Process completed successfully")
        return 0
        
    except Exception as e:
        logger.error(f"Error: {e}")
        # In non-verbose mode, ensure the error is printed to stderr
        if not args.verbose:
            print(f"Error: {e}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())