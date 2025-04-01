import logging
from .downloader import OneDriveDownloader

def download_file(file_id, output_path=None, verbose=False):
    """
    Download a shared file from OneDrive using its file ID.
    
    Args:
        file_id (str): The OneDrive file ID in the format 'driveId!itemId'
        output_path (str, optional): Path where the file should be saved.
                                  If not provided, saves to current directory
                                  with the original filename.
        verbose (bool, optional): Enable verbose logging output. Default is False.
    
    Returns:
        str: The path to the downloaded file
    """
    # Configure logging
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
    
    # Create downloader with verbose flag
    downloader = OneDriveDownloader(verbose=verbose)
    
    # Download the file
    return downloader.download_file(file_id, output_path)