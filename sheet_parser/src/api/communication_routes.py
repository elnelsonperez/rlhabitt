"""Communication API routes for RL HABITT Backend."""
import uuid
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
        
@communication_bp.route('/monthly-breakdown', methods=['POST'])
@cross_origin()
@requires_auth
def create_monthly_breakdown():
    """
    Create a monthly breakdown communication for an owner.
    
    Request Body:
        {
            "owner_id": "uuid",
            "booking_ids": ["uuid1", "uuid2", ...],
            "custom_message": "Optional custom message",
            "report_period": {
                "start": "YYYY-MM-DD",
                "end": "YYYY-MM-DD"
            }
        }
        
    Returns:
        JSON response with communication ID
    """
    try:
        # Parse request data
        data = request.json
        if not data:
            return jsonify({"error": "Request body must be JSON"}), 400
        
        # Required parameters
        owner_id = data.get('owner_id')
        booking_ids = data.get('booking_ids', [])
        
        # Optional parameters
        custom_message = data.get('custom_message')
        report_period = data.get('report_period')
        
        # Validate required parameters
        if not owner_id:
            return jsonify({"error": "owner_id is required"}), 400
        
        if not booking_ids:
            return jsonify({"error": "booking_ids is required and must not be empty"}), 400
            
        # Convert IDs to UUID objects
        try:
            owner_id = uuid.UUID(owner_id)
            booking_ids = [uuid.UUID(id) for id in booking_ids]
        except ValueError:
            return jsonify({"error": "Invalid UUID format"}), 400
        
        # Create database session
        with get_db_session() as session:
            # Initialize services
            repository = CommunicationsRepository(session)
            email_sender = EmailSender()
            service = CommunicationsService(repository, email_sender)
            
            # Create monthly breakdown
            communication_id = service.create_monthly_breakdown(
                owner_id=owner_id,
                booking_ids=booking_ids,
                custom_message=custom_message,
                report_period=report_period
            )
        
        return jsonify({
            "communication_id": str(communication_id),
            "status": "success"
        })
    
    except ValueError as e:
        logger.error(f"Validation error creating monthly breakdown: {str(e)}")
        return jsonify({
            "error": str(e)
        }), 400
    except Exception as e:
        logger.exception(f"Error creating monthly breakdown: {str(e)}")
        return jsonify({
            "error": f"Error creating monthly breakdown: {str(e)}"
        }), 500