"""
Example script to read the color legend from an Excel file.
This script reads the color legend from rows A139:B146 and prints the color values and legends.

Usage:
    poetry run python examples/read_color_legend.py [path/to/excel/file.xlsx] [sheet_name] [-v|--verbose]
    
    If no sheet_name is provided, the first sheet will be used.
    Use -v or --verbose for more detailed output.
"""
import sys
import os
import argparse
from pathlib import Path
import pprint

# Add the src directory to the path so we can import from it
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.xlsx_parser import CondoRentalParser

def main():
    parser = argparse.ArgumentParser(description="Read color legend from Excel file")
    parser.add_argument("file_path", nargs="?", help="Path to the Excel file")
    parser.add_argument("sheet_name", nargs="?", help="Name of the sheet to parse (if omitted, first sheet is used)")
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose output")
    
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
    
    # Read color legend from rows A139:B146
    print(f"Reading color legend from rows A139:B146 in sheet '{sheet_name}'")
    
    # Make sure the workbook is loaded
    if not condo_parser.workbook or not condo_parser.workbook_with_comments:
        print("Error: Workbook not loaded", file=sys.stderr)
        return 1
    
    # Get both sheet versions (with and without formulas for comments)
    sheet = condo_parser.workbook[sheet_name]
    sheet_with_comments = condo_parser.workbook_with_comments[sheet_name]
    
    print("\nColor Legend:")
    print("-" * 40)
    
    # Read rows A139:B146
    color_legend = []
    for row in range(139, 147):  # Rows 139 to 146
        # Get cell in column A (color)
        cell_a = sheet_with_comments.cell(row=row, column=1)
        
        # Get the background color
        color_info = condo_parser._get_cell_color(cell_a)
        
        # Get the legend text from column B
        legend_text = sheet.cell(row=row, column=2).value
        
        # If we have a color or legend text, add to the legend
        if color_info or legend_text:
            legend_entry = {
                "color": color_info,
                "legend": legend_text
            }
            color_legend.append(legend_entry)
            
            # Print formatted color info
            color_type = color_info.get('type', 'unknown') if color_info else "none"
            color_value = color_info.get('value', 'N/A') if color_info else "N/A"
            meaning = color_info.get('meaning', 'N/A') if color_info else "N/A"
            
            meaning_display = f"(meaning: {meaning})" if meaning != 'N/A' else ""
            
            print(f"Row {row}: {color_type}:{color_value} {meaning_display} = {legend_text}")
    
    # Print full color legend in pretty format if verbose
    if args.verbose:
        print("\nDetailed Color Legend Data:")
        pprint.pprint(color_legend)
    
    return 0

if __name__ == "__main__":
    sys.exit(main())