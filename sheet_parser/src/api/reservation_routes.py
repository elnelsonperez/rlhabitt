"""Reservation API routes for RL HABITT Backend."""
import os
import json
import logging
import tempfile
from datetime import datetime, date
from flask import Blueprint, jsonify, request, Response

from .auth import requires_auth
from .cache import ResponseCache
from ..downloader import OneDriveDownloader
from ..xlsx_parser import CondoRentalParser

# Configure logging
logger = logging.getLogger(__name__)

# Create the blueprint
reservation_bp = Blueprint('reservations', __name__, url_prefix='/api/reservations')

# Initialize the response cache
def init_cache(app):
    global cache
    cache_dir = app.config.get("API_CACHE_DIR", None)
    cache_expire_time = int(app.config.get("API_CACHE_EXPIRE_TIME", 3600))
    cache = ResponseCache(cache_dir=cache_dir, expire_time=cache_expire_time)
    return cache

# Initialize cache as None, will be set when app is created
cache = None

@reservation_bp.route('', methods=['GET'])
@requires_auth
def get_reservations():
    """Get reservations data.
    
    Query parameters:
    - file_id: OneDrive file ID (required)
    - months: Number of months to look back (including current month)
    - refresh: If set to 'true', forces a fresh download of the file
    - pretty: If set to 'true', formats the JSON response
    
    Returns:
        JSON response with reservations data
    """
    # Initialize cache if not already done
    global cache
    if cache is None:
        from flask import current_app
        cache = init_cache(current_app)

    # Get query parameters
    file_id = request.args.get('file_id')
    months_str = request.args.get('months')
    refresh = request.args.get('refresh', '').lower() == 'true'
    pretty = request.args.get('pretty', '').lower() == 'true'
    
    # Validate file_id
    if not file_id:
        return jsonify({"error": "file_id parameter is required"}), 400
    
    # Parse months parameter
    months = None
    if months_str:
        try:
            months = int(months_str)
            if months <= 0:
                return jsonify({"error": "months parameter must be a positive integer"}), 400
        except ValueError:
            return jsonify({"error": "months parameter must be a valid integer"}), 400
    
    # Create cache key based on parameters
    cache_key = f"{file_id}_{months if months else 'current'}"
    
    # Check cache unless refresh is requested
    if not refresh:
        cached_data, cache_hit = cache.get(cache_key)
        if cache_hit:
            logger.info(f"Serving cached response for file_id={file_id}, months={months}")
            return format_response(cached_data, pretty)
    
    # Download and process the file
    try:
        # Create a temporary file
        with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as temp_file:
            excel_path = temp_file.name
        
        logger.info(f"Downloading file with ID {file_id}")
        downloader = OneDriveDownloader()
        downloaded_path = downloader.download_file(file_id, excel_path)
        
        logger.info(f"Processing Excel file at {downloaded_path}")
        parser = CondoRentalParser(downloaded_path)
        
        if not parser.load_workbook():
            return jsonify({"error": "Failed to load workbook"}), 500
        
        sheet_names = parser.get_sheet_names()
        if not sheet_names:
            return jsonify({"error": "No sheets found in the workbook"}), 500
        
        # Process based on months parameter
        if months:
            # Process multiple months
            current_date = datetime.now()
            current_month = current_date.month
            current_year = current_date.year
            
            # Find sheets for requested months
            valid_sheets = []
            for s in sheet_names:
                month_num, year = parser.parse_sheet_date(s)
                if month_num is not None and year is not None:
                    # Check if this sheet is within the requested months range
                    month_diff = (current_year - year) * 12 + (current_month - month_num)
                    if 0 <= month_diff < months:
                        valid_sheets.append(s)
            
            if not valid_sheets:
                return jsonify({"error": f"No sheets found for the last {months} months"}), 404
            
            # Process all valid sheets
            combined_data = {
                "sheets": []
            }
            
            for sheet_name in valid_sheets:
                sheet_data = parser.parse_sheet(sheet_name)
                if sheet_data:
                    combined_data["sheets"].append({
                        "name": sheet_name,
                        "data": sheet_data
                    })
            
            if not combined_data["sheets"]:
                return jsonify({"error": "Failed to parse any sheets"}), 500
            
            data = combined_data
        else:
            # Process current month sheet
            current_date = datetime.now()
            current_month = current_date.month
            current_year = current_date.year
            
            # Try to find current month sheet
            current_month_sheet = None
            valid_sheet = None
            
            for s in sheet_names:
                month_num, year = parser.parse_sheet_date(s)
                if month_num is not None and year is not None:
                    if valid_sheet is None:
                        valid_sheet = s
                    
                    if month_num == current_month and year == current_year:
                        current_month_sheet = s
                        break
            
            if current_month_sheet:
                sheet_name = current_month_sheet
            elif valid_sheet:
                sheet_name = valid_sheet
            else:
                sheet_name = sheet_names[0]
            
            data = parser.parse_sheet(sheet_name)
            if not data:
                return jsonify({"error": f"Failed to parse sheet: {sheet_name}"}), 500
        
        # Cache the response
        cache.set(cache_key, data)
        
        # Cleanup downloaded file
        try:
            os.unlink(downloaded_path)
        except Exception as e:
            logger.warning(f"Failed to clean up temporary file: {e}")
        
        return format_response(data, pretty)
    
    except Exception as e:
        logger.error(f"Error processing request: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

def format_response(data, pretty=False):
    """Format the JSON response with optional pretty-printing."""
    if pretty:
        return jsonify(data)
    else:
        return Response(
            json.dumps(data, cls=JSONEncoder),
            mimetype='application/json'
        )

class JSONEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle date objects."""
    def default(self, obj):
        if isinstance(obj, date):
            return obj.isoformat()
        return super().default(obj)