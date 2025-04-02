"""OneDrive authentication route for RL HABITT backend."""
import logging
from flask import Blueprint, render_template_string, url_for

from .auth import requires_auth
from ..auth import OneDriveAuth

# Configure logging
logger = logging.getLogger(__name__)

# Create blueprint for OneDrive authentication with a different prefix than /api
onedrive_auth_bp = Blueprint('onedrive_auth', __name__, url_prefix='/setup/onedrive')

# Global variable to store the device flow message
device_flow_message = None

@onedrive_auth_bp.route('/', methods=['GET'])
@requires_auth
def start_auth():
    """Start the OneDrive authentication flow"""
    # Simple HTML page with instructions and a button to start auth
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>OneDrive Authentication Setup</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
                line-height: 1.6;
            }
            .container {
                background-color: #f8f9fa;
                border-radius: 5px;
                padding: 20px;
                margin-top: 20px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .button {
                display: inline-block;
                background-color: #007bff;
                color: white;
                padding: 10px 20px;
                text-decoration: none;
                border-radius: 4px;
                font-weight: bold;
                margin-top: 20px;
                border: none;
                cursor: pointer;
            }
            .button:hover {
                background-color: #0069d9;
            }
            h1, h2 {
                color: #333;
            }
        </style>
    </head>
    <body>
        <h1>OneDrive Authentication Setup</h1>
        <div class="container">
            <h2>Device Authentication</h2>
            <p>This process will allow the application to access OneDrive files for importing reservation data.</p>
            <p>Click the button below to generate a device code. You'll need to enter this code on Microsoft's website to authenticate.</p>
            <a href="{{ url_for('onedrive_auth.auth_device') }}" class="button">Start Device Authentication</a>
        </div>
    </body>
    </html>
    """
    return render_template_string(html, url_for=url_for)

@onedrive_auth_bp.route('/auth-device', methods=['GET'])
@requires_auth
def auth_device():
    """Start the device authentication flow and show the code to the user"""
    global device_flow_message
    
    try:
        # Override print function to capture the device flow message
        import builtins
        original_print = builtins.print
        
        captured_message = []
        def capture_print(*args, **kwargs):
            message = " ".join(str(arg) for arg in args)
            captured_message.append(message)
            original_print(*args, **kwargs)
        
        builtins.print = capture_print
        
        # Start the auth flow
        auth = OneDriveAuth()
        token = auth.get_token()
        
        # Restore print function
        builtins.print = original_print
        
        # Get the captured message
        device_flow_message = "\\n".join(captured_message)
        
        if token:
            # Authentication was successful
            html = """
            <!DOCTYPE html>
            <html>
            <head>
                <title>OneDrive Authentication Successful</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 20px;
                        line-height: 1.6;
                    }
                    .container {
                        background-color: #d4edda;
                        border-radius: 5px;
                        padding: 20px;
                        margin-top: 20px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        border-left: 5px solid #28a745;
                    }
                    .button {
                        display: inline-block;
                        background-color: #28a745;
                        color: white;
                        padding: 10px 20px;
                        text-decoration: none;
                        border-radius: 4px;
                        font-weight: bold;
                        margin-top: 20px;
                    }
                    h1, h2 {
                        color: #333;
                    }
                </style>
            </head>
            <body>
                <h1>OneDrive Authentication</h1>
                <div class="container">
                    <h2>Authentication Successful!</h2>
                    <p>Your OneDrive authentication was successful. The token has been saved and will be used for importing reservation data.</p>
                    <p>You can now close this window and use the application.</p>
                </div>
            </body>
            </html>
            """
            return render_template_string(html)
    except Exception as e:
        logger.error(f"Error during authentication: {str(e)}")
        device_flow_message = f"Error during authentication: {str(e)}"
    
    # Show device code to user (or error message)
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>OneDrive Device Authentication</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
                line-height: 1.6;
            }
            .container {
                background-color: #f8f9fa;
                border-radius: 5px;
                padding: 20px;
                margin-top: 20px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .code-box {
                background-color: #e9ecef;
                padding: 20px;
                border-radius: 5px;
                font-family: monospace;
                margin: 20px 0;
                white-space: pre-wrap;
                word-break: break-word;
            }
            h1, h2 {
                color: #333;
            }
        </style>
    </head>
    <body>
        <h1>OneDrive Device Authentication</h1>
        <div class="container">
            <h2>Device Code Instructions</h2>
            <p>Please follow the instructions below to authenticate with OneDrive:</p>
            <div class="code-box">{{ message }}</div>
            <p>After you complete the authentication process, the token will be saved automatically and the application will use it for future operations.</p>
        </div>
    </body>
    </html>
    """
    return render_template_string(html, message=device_flow_message)