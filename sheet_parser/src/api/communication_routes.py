"""Communication API routes for RL HABITT Backend."""
from flask import Blueprint, jsonify, request
from flask_cors import cross_origin

from .auth import requires_auth
from ..db import get_db_session
from ..logger import get_logger
from ..comms.service.communications_service import CommunicationsService
from ..comms.infrastructure.db_repository import CommunicationsRepository
from ..comms.infrastructure.email_sender import EmailSender

# Configure logging
logger = get_logger(__name__)

# Create the blueprint
communication_bp = Blueprint('communications', __name__, url_prefix='/api/comms')

@communication_bp.route('/update-message/<string:communication_id>', methods=['POST'])
@cross_origin()
@requires_auth
def update_custom_message(communication_id):
    """
    Update custom message and regenerate email content for a communication.
    
    Args:
        communication_id: The ID of the communication to update
        
    Request Body:
        {
            "custom_message": "New custom message content"
        }
        
    Returns:
        JSON response with updated communication details
    """
    try:
        # Parse request data
        data = request.json
        if not data:
            return jsonify({"error": "Request body must be JSON"}), 400
        
        custom_message = data.get('custom_message', '')
        
        logger.info(f"Updating custom message for communication {communication_id}")
        
        # Create database session
        with get_db_session() as session:
            # Initialize services
            repository = CommunicationsRepository(session)
            email_sender = EmailSender()
            service = CommunicationsService(repository, email_sender)
            
            # Update custom message
            repository.update_communication_custom_message(communication_id, custom_message)
            
            # Generate new content
            html_content = service.generate_email_content(communication_id)
        
        if not html_content:
            return jsonify({
                "error": "Failed to generate email content"
            }), 500
        
        return jsonify({
            "communication_id": str(communication_id),
            "custom_message": custom_message,
            "content": html_content,
            "status": "success"
        })
    
    except Exception as e:
        logger.exception(f"Error updating custom message for communication {communication_id}: {str(e)}")
        return jsonify({
            "error": f"Error updating custom message: {str(e)}"
        }), 500