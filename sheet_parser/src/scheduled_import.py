"""
Scheduled import script for automatic imports from OneDrive.
This script can be run via a cron job to periodically import data.

Example cron job (runs daily at 2 AM):
0 2 * * * /path/to/python /path/to/sheet_parser/src/scheduled_import.py
"""
import os
import sys
import uuid
import tempfile
import logging
from datetime import datetime
from dotenv import load_dotenv

# Configure path to find project modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

# Import project modules
from src.downloader import OneDriveDownloader
from src.api.import_routes import run_import_job
from src.postgres_importer import PostgresImporter

# Configure logging
log_file = os.getenv('LOG_FILE_PATH', '/var/log/sheet_parser/scheduled_import.log')
os.makedirs(os.path.dirname(log_file), exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(log_file, mode='a')
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Get file_id from environment variable
FILE_ID = os.getenv('ONEDRIVE_FILE_ID')
MONTHS = int(os.getenv('IMPORT_MONTHS', '2'))

def run_scheduled_import():
    """Run the import job with the configured file_id."""
    if not FILE_ID:
        logger.error("ONEDRIVE_FILE_ID environment variable not set. Aborting import.")
        return False

    # Generate a correlation ID
    correlation_id = str(uuid.uuid4())
    logger.info(f"Starting scheduled import with correlation ID: {correlation_id}")
    
    try:
        # Create a temporary file for the download
        with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as temp_file:
            excel_path = temp_file.name
        
        # Download the file
        logger.info(f"Downloading file with ID {FILE_ID}")
        downloader = OneDriveDownloader()
        
        try:
            downloaded_path = downloader.download_file(FILE_ID, excel_path)
            
            # Run the import job
            logger.info(f"Running import job for {MONTHS} months")
            run_import_job(correlation_id, downloaded_path, MONTHS)
            
            # Log the result by checking the database
            importer = PostgresImporter()
            with importer.engine.connect() as conn:
                query = """
                    SELECT
                        correlation_id,
                        COUNT(*) AS total_sheets,
                        COUNT(*) FILTER (WHERE status = 'completed') AS completed_sheets,
                        COUNT(*) FILTER (WHERE status = 'failed') AS failed_sheets
                    FROM import_logs
                    WHERE correlation_id = :correlation_id
                    GROUP BY correlation_id
                """
                result = conn.execute(query, {"correlation_id": correlation_id}).first()
                
                if result:
                    logger.info(f"Import completed: total={result[1]}, success={result[2]}, failed={result[3]}")
                    return True
                else:
                    logger.warning(f"Import may have failed. No logs found for correlation_id: {correlation_id}")
                    return False
                
        except Exception as e:
            logger.error(f"Failed to download file: {e}")
            return False
    
    except Exception as e:
        logger.error(f"Error during scheduled import: {e}", exc_info=True)
        return False

if __name__ == "__main__":
    logger.info(f"Running scheduled import at {datetime.now().isoformat()}")
    success = run_scheduled_import()
    exit_code = 0 if success else 1
    logger.info(f"Scheduled import finished with {'success' if success else 'failure'}")
    sys.exit(exit_code)