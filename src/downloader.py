import os
import requests
import logging
from pathlib import Path
from .auth import OneDriveAuth

logger = logging.getLogger(__name__)

class OneDriveDownloader:
    def __init__(self, verbose=False):
        self.auth = OneDriveAuth()
        self.base_url = "https://graph.microsoft.com/v1.0"
        self.verbose = verbose
        
        # Configure logging based on verbosity
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
    
    def parse_drive_id(self, file_id):
        """
        Extract the drive ID from a OneDrive file ID like '2124047165A6F26!493036'
        where the drive ID is '2124047165A6F26'
        """
        parts = file_id.split('!')
        if len(parts) < 2:
            raise ValueError(f"Invalid file ID format: {file_id}. Expected format: 'driveId!itemId'")
        
        drive_id = parts[0]
        return drive_id
    
    def download_file(self, file_id, output_path=None):
        """Download a file from OneDrive using its file ID"""
        # Get drive ID from the file ID
        drive_id = self.parse_drive_id(file_id)
        logger.info(f"Downloading file with ID {file_id} from drive {drive_id}")
        
        # Get an access token
        token = self.auth.get_token()
        logger.debug("Successfully obtained access token")
        
        # Get file metadata to determine name
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "*/*"
        }
        
        # Get file details
        url = f"{self.base_url}/drives/{drive_id}/items/{file_id}"
        logger.debug(f"Fetching file details from: {url}")
        response = requests.get(url, headers=headers)
        
        if response.status_code != 200:
            logger.error(f"Failed to get file details: {response.status_code} - {response.text}")
            raise Exception(f"Error getting file details: {response.status_code} - {response.text}")
        
        file_data = response.json()
        file_name = file_data.get('name')
        
        if not file_name:
            logger.error("Could not determine file name from metadata")
            raise Exception("Could not determine file name from metadata")
        
        logger.debug(f"File name: {file_name}")
        
        # Set output path
        if not output_path:
            output_path = os.path.join(os.getcwd(), file_name)
            logger.debug(f"Using default output path: {output_path}")
        else:
            logger.debug(f"Using specified output path: {output_path}")
        
        # Download the file content
        download_url = f"{self.base_url}/drives/{drive_id}/items/{file_id}/content"
        logger.debug(f"Downloading file from: {download_url}")
        response = requests.get(download_url, headers=headers, stream=True)
        
        if response.status_code != 200:
            logger.error(f"Failed to download file: {response.status_code} - {response.text}")
            raise Exception(f"Error downloading file: {response.status_code} - {response.text}")
        
        # Save the file
        with open(output_path, 'wb') as f:
            downloaded_size = 0
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                downloaded_size += len(chunk)
                if self.verbose:
                    logger.debug(f"Downloaded {downloaded_size} bytes")
        
        logger.info(f"File downloaded successfully to: {output_path}")
        return output_path