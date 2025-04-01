"""
Example script to parse a condo rental Excel sheet.
This script parses the rental data from the Excel sheet and outputs it as JSON.

Usage:
    poetry run python examples/parse_condo_sheet.py [path/to/excel/file.xlsx] [sheet_name] [-v|--verbose] [--output file.json]
    
    If no sheet_name is provided, the first sheet will be used.
    Use -v or --verbose for more detailed output.
    Use --output to specify an output JSON file (otherwise prints to stdout).
"""
import sys
import os
import json
import argparse
from pathlib import Path

# Add the src directory to the path so we can import from it
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.xlsx_parser import CondoRentalParser

class JSONEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle date objects"""
    def default(self, obj):
        from datetime import date
        if isinstance(obj, date):
            return obj.isoformat()
        return super().default(obj)

def main():
    parser = argparse.ArgumentParser(description="Parse condo rental Excel sheet into JSON")
    parser.add_argument("file_path", nargs="?", help="Path to the Excel file")
    parser.add_argument("sheet_name", nargs="?", help="Name of the sheet to parse (if omitted, first sheet is used)")
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose output")
    parser.add_argument("-o", "--output", help="Output JSON file path (if omitted, prints to stdout)")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print the JSON output")
    
    args = parser.parse_args()
    
    # If no file_path provided, use the default example file
    if not args.file_path:
        args.file_path = str(Path(__file__).parent.parent / "example.xlsx")
    
    if not os.path.exists(args.file_path):
        print(f"Error: File not found: {args.file_path}", file=sys.stderr)
        return 1
    
    # Create and initialize the parser
    condo_parser = CondoRentalParser(args.file_path, verbose=args.verbose)
    if not condo_parser.load_workbook():
        print(f"Error: Failed to load workbook: {args.file_path}", file=sys.stderr)
        return 1
    
    # Get all sheet names
    sheet_names = condo_parser.get_sheet_names()
    if not sheet_names:
        print("Error: No sheets found in the workbook", file=sys.stderr)
        return 1
    
    # If no sheet_name provided, use the first one
    sheet_name = args.sheet_name or sheet_names[0]
    if sheet_name not in sheet_names:
        print(f"Error: Sheet '{sheet_name}' not found in workbook", file=sys.stderr)
        print(f"Available sheets: {', '.join(sheet_names)}", file=sys.stderr)
        return 1
    
    # Parse the sheet
    sheet_data = condo_parser.parse_sheet(sheet_name)
    if not sheet_data:
        print(f"Error: Failed to parse sheet: {sheet_name}", file=sys.stderr)
        return 1
    
    # Convert to JSON
    indent = 2 if args.pretty else None
    json_data = json.dumps(sheet_data, indent=indent, cls=JSONEncoder)
    
    # Output the JSON
    if args.output:
        try:
            with open(args.output, 'w') as f:
                f.write(json_data)
            print(f"JSON data written to: {args.output}")
        except Exception as e:
            print(f"Error writing to output file: {e}", file=sys.stderr)
            return 1
    else:
        print(json_data)
    
    return 0

if __name__ == "__main__":
    sys.exit(main())