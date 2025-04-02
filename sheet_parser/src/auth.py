import msal
import os
from pathlib import Path
from dotenv import load_dotenv

from src.logger import get_logger

# Load environment variables from .env file
load_dotenv()

logger = get_logger(__name__)

class OneDriveAuth:
    def __init__(self, cache_file=None, verbose=False):
        self.authority = "https://login.microsoftonline.com/consumers"
        self.client_id = os.environ.get("ONEDRIVE_CLIENT_ID")
        self.verbose = verbose
        
        if not self.client_id:
            logger.error("ONEDRIVE_CLIENT_ID environment variable is not set")
            raise ValueError("ONEDRIVE_CLIENT_ID environment variable is not set")
            
        self.scope = ["Files.Read", "Files.Read.All"]
        logger.debug(f"Auth scopes: {self.scope}")
        
        # Set up token cache
        # Check environment variable for token path first, fall back to Docker volume path,
        # then use provided cache_file or default to home dir
        env_token_path = os.environ.get('ONEDRIVE_TOKEN_PATH')
        docker_token_path = '/app/token_cache'
        
        if env_token_path and os.path.exists(env_token_path) and os.access(env_token_path, os.W_OK):
            default_cache_path = os.path.join(env_token_path, 'onedrive_token_cache.json')
            logger.debug(f"Using environment-specified token path: {env_token_path}")
        elif os.path.exists(docker_token_path) and os.access(docker_token_path, os.W_OK):
            default_cache_path = os.path.join(docker_token_path, 'onedrive_token_cache.json')
            logger.debug(f"Using Docker volume token path: {docker_token_path}")
        else:
            default_cache_path = os.path.join(str(Path.home()), '.onedrive_token_cache.json')
            logger.debug("Using home directory for token cache")
            
        self.cache_file = cache_file or default_cache_path
        logger.debug(f"Using token cache file: {self.cache_file}")
        self.token_cache = msal.SerializableTokenCache()
        
        # Load the token cache from file if it exists
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, 'r') as cache_file:
                    self.token_cache.deserialize(cache_file.read())
                logger.debug("Token cache loaded successfully")
            except Exception as e:
                logger.warning(f"Error loading token cache: {e}")
        else:
            logger.debug("No token cache file found, will create one when token is acquired")
        
    def _save_cache(self):
        """Save the token cache to file"""
        if self.token_cache.has_state_changed:
            try:
                # Ensure parent directory exists
                os.makedirs(os.path.dirname(self.cache_file), exist_ok=True)
                
                with open(self.cache_file, 'w') as cache_file:
                    cache_file.write(self.token_cache.serialize())
                logger.debug(f"Token cache saved successfully to {self.cache_file}")
            except Exception as e:
                logger.error(f"Error saving token cache: {e}")
    
    def get_token(self):
        """Get an access token for OneDrive API, using device code flow if needed"""
        app = msal.PublicClientApplication(
            client_id=self.client_id,
            authority=self.authority,
            token_cache=self.token_cache
        )
        
        # Try to get token from cache first
        accounts = app.get_accounts()
        if accounts:
            logger.debug(f"Found {len(accounts)} accounts in token cache")
            result = app.acquire_token_silent(self.scope, account=accounts[0])
            if result:
                logger.info("Using access token from cache")
                self._save_cache()
                return result['access_token']
            else:
                logger.debug("No valid token found in cache")
        else:
            logger.debug("No accounts found in token cache")
        
        # If no token in cache or token expired, use device code flow
        logger.info("No valid token in cache, initiating device code flow")
        flow = app.initiate_device_flow(scopes=self.scope)
        if 'user_code' not in flow:
            error_msg = f"Failed to create device flow: {flow.get('error_description', 'Unknown error')}"
            logger.error(error_msg)
            raise Exception(error_msg)
        
        # Print the device code flow message for the user
        print(flow['message'])
        
        result = app.acquire_token_by_device_flow(flow)
        if 'access_token' not in result:
            error_msg = f"Failed to acquire token: {result.get('error_description', 'Unknown error')}"
            logger.error(error_msg)
            raise Exception(error_msg)
        
        logger.info("Successfully acquired new access token")
        self._save_cache()
        return result['access_token']