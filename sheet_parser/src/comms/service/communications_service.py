"""Communications service for handling owner notifications."""
import uuid
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional, Any, Tuple
from collections import defaultdict
import os
import jinja2
from sqlalchemy import text

from src.logger import get_logger
from src.models import Communication
from src.comms.infrastructure.db_repository import CommunicationsRepository
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
        
        # Add date formatting function for templates
        self.jinja_env.filters['format_date'] = self._format_date
    
    def _format_date(self, value):
        """Format a date for display in templates."""
        if isinstance(value, (datetime, date)):
            return value.strftime('%d/%m/%Y')
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
                                      owner_email: Optional[str], 
                                      owner_name: str,
                                      bookings: List[Dict]) -> Optional[uuid.UUID]:
        """
        Create a new booking communication for an owner.
        
        Args:
            owner_id: UUID of the owner
            owner_email: Email address of the owner (may be None)
            owner_name: Name of the owner (for logging)
            bookings: List of booking dictionaries for this owner
            
        Returns:
            UUID of the created communication or None if skipped
        """
        # Skip if no bookings or no email
        if not bookings:
            logger.warning(f"No bookings provided for owner {owner_id} ({owner_name})")
            return None
            
        if not owner_email:
            logger.warning(f"Owner {owner_id} ({owner_name}) has no email configured. Skipping communication.")
            return None
        
        # Find earliest and latest dates for reporting period
        check_in_dates = [b['check_in'] for b in bookings]
        check_out_dates = [b['check_out'] for b in bookings]
        
        report_start = min(check_in_dates)
        report_end = max(check_out_dates)
        
        subject = f"Nuevas reservas en su propiedad ({self._format_date(report_start)} - {self._format_date(report_end)})"
        
        logger.info(f"Creating communication for owner {owner_id} ({owner_name}) with {len(bookings)} bookings")
        
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
            logger.exception(f"Failed to create communication for owner {owner_id}: {str(e)}")
            raise
    
    def process_new_bookings(self, custom_since: Optional[datetime] = None) -> int:
        """
        Process new bookings and create communications.
        
        Args:
            custom_since: Optional custom datetime to use instead of the last run time
        """
        # Get time threshold for finding new bookings
        if custom_since:
            since_time = custom_since
            logger.info(f"Using custom since time: {since_time}")
        else:
            since_time = self.repository.get_last_run_time('queue_communications')
            logger.info(f"Last run time: {since_time}")
        
        # Find new bookings
        new_bookings = self.find_new_bookings(since_time)
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
            owner_email = bookings[0].get('owner_email')
            owner_name = bookings[0].get('owner_name', 'Unknown')
            
            comm_id = self.create_communication_for_owner(
                owner_id, 
                owner_email, 
                owner_name, 
                bookings
            )
            
            # Only increment count if communication was created
            if comm_id:
                communication_count += 1
        
        # Update last run time
        self.repository.update_last_run_time('queue_communications')
        
        return communication_count
    
    def calculate_admin_fees(self, bookings: List[Dict]) -> List[Dict]:
        """
        Calculate admin fees for each booking and add to booking dict.
        Also calculates the portion of the booking that falls within the current month,
        separating nights that have already been paid out or will be paid in future months.
        """
        # Get the current month's date range
        today = datetime.now().date()
        first_day_of_month = today.replace(day=1)
        if today.month == 12:
            next_month = today.replace(year=today.year + 1, month=1, day=1)
        else:
            next_month = today.replace(month=today.month + 1, day=1)
        last_day_of_month = next_month - timedelta(days=1)
        
        logger.info(f"Calculating fees for current month: {first_day_of_month} to {last_day_of_month}")
        
        for booking in bookings:
            total_amount = float(booking['total_amount'])
            admin_fee_pct = float(booking['admin_fee_percentage'])
            check_in = booking['check_in'].date() if isinstance(booking['check_in'], datetime) else booking['check_in']
            check_out = booking['check_out'].date() if isinstance(booking['check_out'], datetime) else booking['check_out']
            
            # Calculate total nights and nightly rate
            total_nights = (check_out - check_in).days
            nightly_rate = total_amount / total_nights if total_nights > 0 else 0
            
            # Determine month boundaries for this booking
            current_month_start = max(check_in, first_day_of_month)
            current_month_end = min(check_out, last_day_of_month)
            
            # Calculate nights in current month
            current_month_nights = max(0, (current_month_end - current_month_start).days)
            previous_month_nights = max(0, (current_month_start - check_in).days) if check_in < first_day_of_month else 0
            future_month_nights = max(0, (check_out - current_month_end).days) if check_out > last_day_of_month else 0
            
            # Calculate amounts for current month
            current_month_amount = current_month_nights * nightly_rate
            previous_month_amount = previous_month_nights * nightly_rate
            future_month_amount = future_month_nights * nightly_rate
            
            # Calculate admin fees
            admin_fee = current_month_amount * (admin_fee_pct / 100)
            owner_amount = current_month_amount - admin_fee
            
            # Add calculated values to booking dict
            booking['admin_fee'] = admin_fee
            booking['owner_amount'] = owner_amount
            booking['total_nights'] = total_nights
            booking['nightly_rate'] = nightly_rate
            booking['current_month_nights'] = current_month_nights
            booking['current_month_amount'] = current_month_amount
            booking['previous_month_nights'] = previous_month_nights
            booking['previous_month_amount'] = previous_month_amount
            booking['future_month_nights'] = future_month_nights
            booking['future_month_amount'] = future_month_amount
            booking['current_month_start'] = current_month_start
            booking['current_month_end'] = current_month_end
        
        return bookings
    
    def calculate_financial_totals(self, bookings: List[Dict]) -> Dict[str, float]:
        """Calculate financial totals for a list of bookings."""
        # Calculate if any bookings span multiple months
        has_split_bookings = any(
            b['previous_month_nights'] > 0 or b['future_month_nights'] > 0 
            for b in bookings
        )
        
        totals = {
            # Total booking amounts
            'total_amount': sum(float(b['total_amount']) for b in bookings),
            
            # Current month totals (what will be paid this month)
            'current_month_amount': sum(float(b['current_month_amount']) for b in bookings),
            'total_admin_fee': sum(float(b['admin_fee']) for b in bookings),
            'total_owner_amount': sum(float(b['owner_amount']) for b in bookings),
            
            # Previous month totals (already paid or pending from previous month)
            'previous_month_amount': sum(float(b['previous_month_amount']) for b in bookings),
            
            # Future month totals (will be paid in future months)
            'future_month_amount': sum(float(b['future_month_amount']) for b in bookings),
            
            # Count totals
            'total_bookings': len(bookings),
            'total_nights': sum(int(b['total_nights']) for b in bookings),
            'current_month_nights': sum(int(b['current_month_nights']) for b in bookings),
            
            # Flag for template to know if any bookings span multiple months
            'has_split_bookings': has_split_bookings
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
        
        # Get current month range for the template
        today = datetime.now().date()
        first_day_of_month = today.replace(day=1)
        if today.month == 12:
            next_month = today.replace(year=today.year + 1, month=1, day=1)
        else:
            next_month = today.replace(month=today.month + 1, day=1)
        last_day_of_month = next_month - timedelta(days=1)
        
        # Prepare template context
        context = {
            'owner_name': owner_name,
            'bookings': bookings,
            'report_period_start': communication.report_period_start,
            'report_period_end': communication.report_period_end,
            'custom_message': communication.custom_message,
            'admin_fee_percentage': admin_fee_percentage,
            'first_day_of_month': first_day_of_month,
            'last_day_of_month': last_day_of_month,
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