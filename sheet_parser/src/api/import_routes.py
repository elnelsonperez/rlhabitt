"""Import API routes for RL HABITT Backend."""
import os
import logging
import tempfile
import uuid
import threading
from datetime import datetime
from flask import Blueprint, jsonify, request
from flask_cors import cross_origin

from .auth import requires_auth
from ..downloader import OneDriveDownloader
from ..xlsx_parser import CondoRentalParser
from ..postgres_importer import PostgresImporter

# Configure logging
logger = logging.getLogger(__name__)

# Create the blueprint
import_bp = Blueprint('import', __name__, url_prefix='/api/import')

# Track ongoing imports by correlation_id
ongoing_imports = {}

def run_import_job(correlation_id, file_path, months=2):
    """
    Process and import data from an Excel file.
    
    Args:
        correlation_id: UUID string for tracking the import
        file_path: Path to the downloaded Excel file
        months: Number of months to import (default: 2)
    """
    try:
        # Create the parser
        parser = CondoRentalParser(file_path)
        
        if not parser.load_workbook():
            logger.error(f"Import {correlation_id}: Failed to load workbook")
            ongoing_imports[correlation_id] = {"status": "failed", "error": "Failed to load workbook"}
            return
        
        sheet_names = parser.get_sheet_names()
        if not sheet_names:
            logger.error(f"Import {correlation_id}: No sheets found in workbook")
            ongoing_imports[correlation_id] = {"status": "failed", "error": "No sheets found in the workbook"}
            return
        
        # Process based on months parameter
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
            logger.error(f"Import {correlation_id}: No sheets found for the last {months} months")
            ongoing_imports[correlation_id] = {"status": "failed", "error": f"No sheets found for the last {months} months"}
            return
        
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
            logger.error(f"Import {correlation_id}: Failed to parse any sheets")
            ongoing_imports[correlation_id] = {"status": "failed", "error": "Failed to parse any sheets"}
            return
        
        # Import the parsed data into PostgreSQL
        importer = PostgresImporter()
        
        try:
            # Import with correlation_id
            import_result = importer.import_json(combined_data, correlation_id)
            
            # Update ongoing_imports with success status
            if isinstance(import_result, list):
                # Multi-sheet result
                ongoing_imports[correlation_id] = {
                    "status": "completed",
                    "import_logs": import_result,
                    "sheet_count": len(combined_data["sheets"])
                }
            else:
                # Single sheet result
                ongoing_imports[correlation_id] = {
                    "status": "completed", 
                    "import_logs": [import_result],
                    "sheet_count": 1
                }
            
            logger.info(f"Import {correlation_id}: Successfully imported {len(combined_data['sheets'])} sheets")
        
        except Exception as e:
            logger.error(f"Import {correlation_id}: Database import failed: {str(e)}")
            ongoing_imports[correlation_id] = {"status": "failed", "error": f"Database import failed: {str(e)}"}
            
    except Exception as e:
        logger.error(f"Import {correlation_id}: Process failed: {str(e)}")
        ongoing_imports[correlation_id] = {"status": "failed", "error": str(e)}
    
    finally:
        # Clean up the downloaded file
        try:
            os.unlink(file_path)
        except Exception as e:
            logger.warning(f"Import {correlation_id}: Failed to clean up temporary file: {e}")


@import_bp.route('', methods=['POST'])
@requires_auth
@cross_origin()
def trigger_import():
    """
    API endpoint to trigger reservation data import.
    
    Request parameters (JSON):
    - file_id: OneDrive file ID (required)
    - months: Number of months to import (default: 2)
    
    Returns:
        JSON response with correlation_id for tracking the import
    """
    # Parse request data
    data = request.json
    
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400
    
    file_id = data.get('file_id')
    months = data.get('months', 2)
    
    # Validate parameters
    if not file_id:
        return jsonify({"error": "file_id parameter is required"}), 400
    
    try:
        months = int(months)
        if months <= 0:
            return jsonify({"error": "months parameter must be a positive integer"}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "months parameter must be a valid integer"}), 400
    
    # Generate a unique correlation ID for this import
    correlation_id = str(uuid.uuid4())
    
    # Start the import process
    try:
        # Create a temporary file for the download
        with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as temp_file:
            excel_path = temp_file.name
        
        # Record that we're starting the import
        ongoing_imports[correlation_id] = {"status": "downloading"}
        
        # Download the file
        logger.info(f"Import {correlation_id}: Downloading file with ID {file_id}")
        downloader = OneDriveDownloader()
        
        try:
            downloaded_path = downloader.download_file(file_id, excel_path)
            
            # Update status
            ongoing_imports[correlation_id] = {"status": "processing"}
            
            # Run the import job in a separate thread
            import_thread = threading.Thread(
                target=run_import_job,
                args=(correlation_id, downloaded_path, months)
            )
            import_thread.daemon = True
            import_thread.start()
            
            # Return the correlation_id to the client
            return jsonify({
                "correlation_id": correlation_id,
                "status": "processing",
                "message": f"Import job started for the last {months} months"
            })
            
        except Exception as e:
            # Handle download failure
            logger.error(f"Import {correlation_id}: Failed to download file: {e}")
            ongoing_imports[correlation_id] = {"status": "failed", "error": f"Failed to download file: {str(e)}"}
            return jsonify({
                "correlation_id": correlation_id,
                "status": "failed",
                "error": str(e)
            }), 500
    
    except Exception as e:
        logger.error(f"Error starting import: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@import_bp.route('/<correlation_id>/status', methods=['GET'])
@requires_auth
@cross_origin()
def get_import_status(correlation_id):
    """
    Get the status of an import job by its correlation_id.
    
    Args:
        correlation_id: UUID string of the import job
        
    Returns:
        JSON response with the current status of the import
    """
    # First check our in-memory tracking
    if correlation_id in ongoing_imports:
        status_data = ongoing_imports[correlation_id]
        return jsonify({
            "correlation_id": correlation_id,
            **status_data
        })
    
    # If not in memory, check the database
    try:
        importer = PostgresImporter()
        with importer.engine.connect() as conn:
            # Query the database for the import status
            query = """
                SELECT
                    correlation_id,
                    COUNT(*) AS total_sheets,
                    COUNT(*) FILTER (WHERE status = 'completed') AS completed_sheets,
                    COUNT(*) FILTER (WHERE status = 'failed') AS failed_sheets,
                    COUNT(*) FILTER (WHERE status = 'in_progress') AS pending_sheets,
                    CASE
                        WHEN COUNT(*) FILTER (WHERE status = 'failed') > 0 AND 
                             COUNT(*) FILTER (WHERE status = 'completed') = 0 THEN 'failed'
                        WHEN COUNT(*) FILTER (WHERE status = 'failed') > 0 AND 
                             COUNT(*) FILTER (WHERE status = 'completed') > 0 THEN 'partial'
                        WHEN COUNT(*) FILTER (WHERE status = 'in_progress') > 0 THEN 'in_progress'
                        WHEN COUNT(*) FILTER (WHERE status = 'completed') = COUNT(*) THEN 'completed'
                        ELSE 'unknown'
                    END AS overall_status
                FROM import_logs
                WHERE correlation_id = :correlation_id
                GROUP BY correlation_id
            """
            result = conn.execute(query, {"correlation_id": correlation_id}).first()
            
            if result:
                return jsonify({
                    "correlation_id": str(result[0]),
                    "status": result[5],  # overall_status
                    "total_sheets": result[1],
                    "completed_sheets": result[2],
                    "failed_sheets": result[3],
                    "pending_sheets": result[4]
                })
            else:
                return jsonify({
                    "correlation_id": correlation_id,
                    "status": "not_found",
                    "message": "No import job found with this correlation ID"
                }), 404
    
    except Exception as e:
        logger.error(f"Error checking import status: {e}", exc_info=True)
        return jsonify({
            "correlation_id": correlation_id,
            "status": "error",
            "error": f"Error checking status: {str(e)}"
        }), 500