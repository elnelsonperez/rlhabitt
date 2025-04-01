"""Basic authentication for the API."""
import os
import functools
from flask import request, Response, current_app
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def check_auth(username, password):
    """Check if the username and password are correct."""
    api_username = os.getenv("API_USERNAME", "admin")
    api_password = os.getenv("API_PASSWORD", "password")
    return username == api_username and password == api_password

def authenticate():
    """Send a 401 response that enables basic auth."""
    return Response(
        'Authentication required',
        401,
        {'WWW-Authenticate': 'Basic realm="Login Required"'}
    )

def requires_auth(f):
    """Decorator to require HTTP Basic Authentication."""
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        auth = request.authorization
        if not auth or not check_auth(auth.username, auth.password):
            return authenticate()
        return f(*args, **kwargs)
    return decorated