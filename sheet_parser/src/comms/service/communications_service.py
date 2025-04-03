"""Communications service for handling owner notifications."""
import uuid
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional, Any, Tuple
from collections import defaultdict
import os
import jinja2
from sqlalchemy import text

from src.logger import get_logger
from src.comms.infrastructure.db_repository import CommunicationsRepository, Communication
from src.comms.infrastructure.email_sender import EmailSender

logger = get_logger(__name__)

class CommunicationsService:
    """Service for managing owner communications."""
    
    def __init__(self, repository: CommunicationsRepository, email_sender: EmailSender):
        """Initialize with repository and email sender."""
        self.repository = repository
        self.email_sender = email_sender
        
        # Set up Jinja2 environment for templates
        template_dir = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), 
            'templates'
        )
        self.jinja_env = jinja2.Environment(
            loader=jinja2.FileSystemLoader(template_dir),
            autoescape=jinja2.select_autoescape(['html', 'xml'])
        )
        
        # Add date filter
        self.jinja_env.filters['date'] = self._format_date
        self.jinja_env.filters['floatformat'] = self._format_float
    
    def _format_date(self, value):
        """Format a date for display in templates."""
        if isinstance(value, (datetime, date)):
            return value.strftime('%d/%m/%Y')
        return value
    
    def _format_float(self, value, precision=2):
        """Format a float with specified precision."""
        try:
            return f"{float(value):.{precision}f}"
        except (ValueError, TypeError):
            return value
    
    def find_new_bookings(self, last_run_date: datetime) -> List[Dict]:
        """Find bookings created since the last run date with buffer."""
        logger.info(f"Finding new bookings since {last_run_date}")
        return self.repository.get_new_bookings(last_run_date)
    
    def group_bookings_by_owner(self, bookings: List[Dict]) -> Dict[uuid.UUID, List[Dict]]:
        """Group bookings by owner ID."""
        grouped = defaultdict(list)
        
        for booking in bookings:
            owner_id = booking['owner_id']
            grouped[owner_id].append(booking)
        
        return dict(grouped)
    
    def create_communication_for_owner(self, 
                                      owner_id: uuid.UUID, 
                                      owner_email: str, 
                                      owner_name: str,
                                      bookings: List[Dict]) -> uuid.UUID:
        """Create a new booking communication for an owner."""
        if not bookings:
            logger.warning(f"No bookings provided for owner {owner_id}")
            return None
        
        # Find earliest and latest dates for reporting period
        check_in_dates = [b['check_in'] for b in bookings]
        check_out_dates = [b['check_out'] for b in bookings]
        
        report_start = min(check_in_dates)
        report_end = max(check_out_dates)
        
        subject = f"Nuevas reservas en su propiedad ({self._format_date(report_start)} - {self._format_date(report_end)})"
        
        logger.info(f"Creating communication for owner {owner_id} with {len(bookings)} bookings")
        
        # Start a transaction
        session = self.repository.session
        
        try:
            # Begin transaction explicitly
            session.begin_nested()
            
            # Create the communication record
            communication = self.repository.create_communication(
                owner_id=owner_id,
                recipient_email=owner_email,
                subject=subject,
                comm_type='new_booking',
                report_period_start=report_start,
                report_period_end=report_end
            )
            
            # Link bookings to the communication
            booking_ids = [b['id'] for b in bookings]
            self.repository.link_bookings_to_communication(communication.id, booking_ids)
            
            # Commit the nested transaction
            session.commit()
            
            return communication.id
            
        except Exception as e:
            # Roll back on error
            session.rollback()
            logger.error(f"Failed to create communication for owner {owner_id}: {str(e)}")
            raise
    
    def process_new_bookings(self) -> int:
        """Process new bookings and create communications."""
        # Get last run time
        last_run = self.repository.get_last_run_time('queue_communications')
        logger.info(f"Last run time: {last_run}")
        
        # Find new bookings
        new_bookings = self.find_new_bookings(last_run)
        logger.info(f"Found {len(new_bookings)} new bookings")
        
        if not new_bookings:
            logger.info("No new bookings to process")
            # Update last run time regardless
            self.repository.update_last_run_time('queue_communications')
            return 0
        
        # Group by owner
        grouped_bookings = self.group_bookings_by_owner(new_bookings)
        logger.info(f"Grouped into {len(grouped_bookings)} owners")
        
        # Create communications for each owner
        communication_count = 0
        for owner_id, bookings in grouped_bookings.items():
            # All bookings for same owner will have same email
            owner_email = bookings[0]['owner_email']
            owner_name = bookings[0]['owner_name']
            
            self.create_communication_for_owner(
                owner_id, 
                owner_email, 
                owner_name, 
                bookings
            )
            communication_count += 1
        
        # Update last run time
        self.repository.update_last_run_time('queue_communications')
        
        return communication_count
    
    def calculate_admin_fees(self, bookings: List[Dict]) -> List[Dict]:
        """Calculate admin fees for each booking and add to booking dict."""
        for booking in bookings:
            total_amount = float(booking['total_amount'])
            admin_fee_pct = float(booking['admin_fee_percentage'])
            
            admin_fee = total_amount * (admin_fee_pct / 100)
            owner_amount = total_amount - admin_fee
            
            booking['admin_fee'] = admin_fee
            booking['owner_amount'] = owner_amount
        
        return bookings
    
    def calculate_financial_totals(self, bookings: List[Dict]) -> Dict[str, float]:
        """Calculate financial totals for a list of bookings."""
        totals = {
            'total_amount': sum(float(b['total_amount']) for b in bookings),
            'total_admin_fee': sum(float(b['admin_fee']) for b in bookings),
            'total_owner_amount': sum(float(b['owner_amount']) for b in bookings)
        }
        
        return totals
    
    def generate_email_content(self, 
                              communication_id: uuid.UUID, 
                              template_name: str = 'emails/new_booking_es.html') -> Optional[str]:
        """Generate email content from template."""
        # Get the communication record
        communication = self.repository.session.query(Communication).get(communication_id)
        if not communication:
            logger.error(f"Communication {communication_id} not found")
            return None

        # Get bookings (non-excluded only)
        bookings = self.repository.get_communication_bookings(communication_id, excluded=False)
        if not bookings:
            logger.warning(f"No non-excluded bookings found for communication {communication_id}")
            return None
        
        # Get owner data - using direct SQL query
        owner_name = self.repository.session.execute(
            text("""
            SELECT o.name 
            FROM owners o
            JOIN communications c ON c.owner_id = o.id
            WHERE c.id = :comm_id
            """),
            {"comm_id": communication_id}
        ).scalar_one_or_none()
        
        # Calculate admin fees
        bookings = self.calculate_admin_fees(bookings)
        
        # Calculate totals
        totals = self.calculate_financial_totals(bookings)
        
        # Get admin fee percentage from first booking (should be consistent)
        admin_fee_percentage = bookings[0]['admin_fee_percentage']
        
        # Prepare template context
        context = {
            'owner_name': owner_name,
            'bookings': bookings,
            'report_period_start': communication.report_period_start,
            'report_period_end': communication.report_period_end,
            'custom_message': communication.custom_message,
            'admin_fee_percentage': admin_fee_percentage,
            **totals
        }
        
        # Load and render template
        template = self.jinja_env.get_template(template_name)
        html_content = template.render(**context)
        
        # Update communication content
        self.repository.update_communication_content(communication_id, html_content)
        
        return html_content
    
    def send_communication(self, communication_id: uuid.UUID) -> Tuple[bool, Optional[str]]:
        """Send a communication to its recipient."""
        # Get the communication record
        communication = self.repository.session.query(Communication).get(communication_id)
        if not communication:
            logger.error(f"Communication {communication_id} not found")
            return False, "Communication not found"
        
        if communication.status != 'approved':
            logger.warning(f"Cannot send communication {communication_id} with status {communication.status}")
            return False, f"Communication is not approved (status: {communication.status})"
        
        # Generate content if not already set
        html_content = communication.content
        if not html_content:
            html_content = self.generate_email_content(communication_id)
            if not html_content:
                return False, "Failed to generate email content"
        
        # Send email
        success, message_id, error = self.email_sender.send_email(
            from_email="notificaciones@rlhabitt.com",
            to_email=communication.recipient_email,
            subject=communication.subject,
            html_content=html_content
        )
        
        # Update communication status
        if success:
            self.repository.mark_communication_sent(communication_id)
            logger.info(f"Successfully sent communication {communication_id}, message ID: {message_id}")
            return True, message_id
        else:
            self.repository.mark_communication_failed(communication_id)
            logger.error(f"Failed to send communication {communication_id}: {error}")
            return False, error
    
    def process_approved_communications(self) -> Tuple[int, int]:
        """Process all approved communications and send them."""
        # Get approved communications
        communications = self.repository.get_approved_communications()
        logger.info(f"Found {len(communications)} approved communications to send")
        
        success_count = 0
        failure_count = 0
        
        for comm in communications:
            success, _ = self.send_communication(comm.id)
            if success:
                success_count += 1
            else:
                failure_count += 1
        
        return success_count, failure_count