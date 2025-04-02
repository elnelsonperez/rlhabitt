"""Authentication for the API using Supabase."""
import os
import functools
import logging
from flask import request, Response, jsonify
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)

# Get Supabase credentials from environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")  # Service role key for admin operations

# Fallback to basic auth if Supabase settings are not available
USE_BASIC_AUTH = not (SUPABASE_URL and SUPABASE_KEY)
API_USERNAME = os.getenv("API_USERNAME", "admin")
API_PASSWORD = os.getenv("API_PASSWORD", "password")

# Initialize Supabase client if settings are available
supabase: Client = None
if not USE_BASIC_AUTH:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("Supabase client initialized for authentication")
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        USE_BASIC_AUTH = True

if USE_BASIC_AUTH:
    logger.warning("Supabase authentication is disabled. Using basic auth instead.")

def get_token_auth_header():
    """Get the access token from the Authorization header."""
    auth = request.headers.get("Authorization", None)
    if not auth:
        raise Exception("Authorization header is missing")
    
    parts = auth.split()
    
    if parts[0].lower() != "bearer":
        raise Exception("Authorization header must start with Bearer")
    
    if len(parts) == 1:
        raise Exception("Token not found")
    
    if len(parts) > 2:
        raise Exception("Authorization header must be Bearer token")
    
    token = parts[1]
    return token

def verify_supabase_token(token):
    """Verify a Supabase JWT token using the Supabase client."""
    try:
        # Verify token by getting user information
        response = supabase.auth.get_user(token)
        return response.user
    except Exception as e:
        logger.error(f"Failed to verify token: {e}")
        raise Exception(f"Invalid token: {str(e)}")

def check_basic_auth(username, password):
    """Check if the username and password are correct for basic auth."""
    return username == API_USERNAME and password == API_PASSWORD

def authenticate():
    """Send a 401 response that enables auth."""
    # Always include Basic auth header for fallback authentication
    response = Response(
        '{"error": "Authentication required", "message": "Valid Supabase token or basic auth credentials required"}',
        401,
        {'WWW-Authenticate': 'Basic realm="Login Required"',
         'Content-Type': 'application/json'}
    )
    return response

def requires_auth(f):
    """Decorator to require authentication.
    
    Will try Supabase authentication first (if configured),
    then fallback to basic auth if Supabase auth fails.
    """
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        # Skip authentication for OPTIONS requests for CORS
        if request.method == 'OPTIONS':
            return f(*args, **kwargs)
            
        # Try Supabase authentication if configured
        if not USE_BASIC_AUTH:
            try:
                token = get_token_auth_header()
                user = verify_supabase_token(token)
                
                # Add user info to request context
                request.user = user
                return f(*args, **kwargs)
            except Exception as e:
                logger.warning(f"Supabase authentication failed, trying basic auth: {str(e)}")
                # Fall through to basic auth
        
        # Try basic auth as fallback
        auth = request.authorization
        if auth and check_basic_auth(auth.username, auth.password):
            # Basic auth succeeded
            logger.info(f"Authenticated with basic auth: {auth.username}")
            return f(*args, **kwargs)
        
        # All authentication methods failed
        logger.error("All authentication methods failed")
        return authenticate()
    
    return decorated