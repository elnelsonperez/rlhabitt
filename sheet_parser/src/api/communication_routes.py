"""Communication API routes for RL HABITT Backend."""
import uuid
from flask import Blueprint, jsonify, request
from flask_cors import cross_origin
from sqlalchemy import func, select, desc

from .auth import requires_auth
from ..db import get_db_session
from ..logger import get_logger
from ..comms.service.communications_service import CommunicationsService
from ..comms.infrastructure.db_repository import CommunicationsRepository
from ..comms.infrastructure.email_sender import EmailSender
from ..models import Communication, BookingCommunication, Reservation, Owner, PublicUser

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
        
@communication_bp.route('/communications-with-totals', methods=['GET'])
@cross_origin()
@requires_auth
def get_communications_with_totals():
    """
    Fetch communications with calculated total amounts.
    
    Query Parameters:
        status (str): Filter by communication status (pending, approved, sent, failed)
        page (int): Page number (starting from 1)
        limit (int): Number of results per page
        sortBy (str): Field to sort by
        sortOrder (str): 'asc' or 'desc'
        
    Returns:
        JSON with communications data including total amounts
    """
    try:
        # Parse query parameters with defaults
        status = request.args.get('status')
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        sort_by = request.args.get('sortBy', 'created_at')
        sort_order = request.args.get('sortOrder', 'desc')
        
        # Validate pagination parameters
        if page < 1:
            page = 1
            
        if limit < 1 or limit > 100:
            limit = 10
            
        # Calculate offset
        offset = (page - 1) * limit
        
        # Create database session
        with get_db_session() as session:
            # Create subquery for booking counts and total amounts
            # This subquery gets the count and sum for each communication in one go
            subq = (
                select(
                    BookingCommunication.communication_id.label('comm_id'),
                    func.count(BookingCommunication.booking_id).label('booking_count'),
                    func.coalesce(
                        func.sum(
                            select(func.coalesce(func.sum(Reservation.rate), 0))
                            .where(Reservation.booking_id == BookingCommunication.booking_id)
                            .scalar_subquery()
                        ),
                        0
                    ).label('total_amount')
                )
                .where(BookingCommunication.excluded == False)
                .group_by(BookingCommunication.communication_id)
                .subquery()
            )
            
            # Main query for communications with joined data
            query = (
                select(
                    Communication,
                    Owner.name.label('owner_name'),
                    PublicUser.email.label('approver_email'),
                    func.coalesce(subq.c.booking_count, 0).label('booking_count'),
                    func.coalesce(subq.c.total_amount, 0).label('total_amount')
                )
                .join(Owner, Communication.owner_id == Owner.id)
                .outerjoin(PublicUser, Communication.approved_by == PublicUser.id)
                .outerjoin(subq, Communication.id == subq.c.comm_id)
            )
            
            # Apply status filter if provided
            if status:
                query = query.where(Communication.status == status)
            
            # Count total for pagination (separate query, but more efficient)
            count_query = select(func.count()).select_from(Communication)
            if status:
                count_query = count_query.where(Communication.status == status)
            total_count = session.execute(count_query).scalar() or 0
            
            # Apply sorting
            sort_column = getattr(Communication, sort_by, Communication.created_at)
            if sort_order.lower() == 'desc':
                query = query.order_by(desc(sort_column))
            else:
                query = query.order_by(sort_column)
            
            # Apply pagination
            query = query.limit(limit).offset(offset)
            
            # Execute the query and process results
            result = session.execute(query).all()
            
            # Format results for JSON response
            result_data = []
            for row in result:
                comm = row[0]  # The Communication object
                owner_name = row[1]
                approver_email = row[2]
                booking_count = row[3]
                total_amount = float(row[4]) if row[4] is not None else 0
                
                comm_data = {
                    "id": str(comm.id),
                    "created_at": comm.created_at.isoformat() if comm.created_at else None,
                    "status": comm.status,
                    "comm_type": comm.comm_type,
                    "channel": comm.channel,
                    "owner_id": str(comm.owner_id),
                    "owner_name": owner_name,
                    "recipient_email": comm.recipient_email,
                    "subject": comm.subject,
                    "custom_message": comm.custom_message,
                    "booking_count": booking_count,
                    "total_amount": total_amount,
                    "report_period_start": comm.report_period_start.isoformat() if comm.report_period_start else None,
                    "report_period_end": comm.report_period_end.isoformat() if comm.report_period_end else None,
                    "approved_at": comm.approved_at.isoformat() if comm.approved_at else None,
                    "approved_by": str(comm.approved_by) if comm.approved_by else None,
                    "approver_email": approver_email,
                    "retry_count": comm.retry_count
                }
                
                result_data.append(comm_data)
            
            # Return the response
            return jsonify({
                "data": result_data,
                "pagination": {
                    "total": total_count,
                    "page": page,
                    "limit": limit,
                    "pages": (total_count + limit - 1) // limit
                }
            })
            
    except ValueError as e:
        logger.error(f"Validation error in communications-with-totals: {str(e)}")
        return jsonify({
            "error": str(e)
        }), 400
    except Exception as e:
        logger.exception(f"Error fetching communications with totals: {str(e)}")
        return jsonify({
            "error": f"Error fetching communications: {str(e)}"
        }), 500