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
        
        # Add date formatting functions for templates
        self.jinja_env.filters['format_date'] = self._format_date
        self.jinja_env.filters['format_month_es'] = self._format_month_spanish
    
    def _format_date(self, value):
        """Format a date for display in templates."""
        if isinstance(value, (datetime, date)):
            if isinstance(value, datetime):
                # Format with 12-hour time
                return value.strftime('%d/%m/%Y %I:%M %p')
            else:
                # Format date only
                return value.strftime('%d/%m/%Y')
        return value
        
    def _format_month_spanish(self, value):
        """Format a date to show month name in Spanish."""
        if not isinstance(value, (datetime, date)):
            if isinstance(value, str):
                try:
                    value = datetime.fromisoformat(value)
                except ValueError:
                    return value
            else:
                return value
                
        # Dictionary of Spanish month names
        spanish_months = {
            1: 'Enero',
            2: 'Febrero',
            3: 'Marzo',
            4: 'Abril',
            5: 'Mayo',
            6: 'Junio',
            7: 'Julio',
            8: 'Agosto',
            9: 'Septiembre',
            10: 'Octubre',
            11: 'Noviembre',
            12: 'Diciembre'
        }
        
        # Use our dictionary instead of relying on locale
        month_name = spanish_months.get(value.month, '')
        return f"{month_name.capitalize()} {value.year}"
    
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
    
    def _get_current_month_range(self) -> Tuple[date, date]:
        """
        Helper method to get the first and last day of the current month.
        
        Returns:
            Tuple of (first_day_of_month, last_day_of_month)
        """
        today = datetime.now().date()
        first_day_of_month = today.replace(day=1)
        
        if today.month == 12:
            next_month = today.replace(year=today.year + 1, month=1, day=1)
        else:
            next_month = today.replace(month=today.month + 1, day=1)
            
        last_day_of_month = next_month - timedelta(days=1)
        
        return first_day_of_month, last_day_of_month
        
    def _get_date_range_from_period(self, report_period: Optional[Dict[str, Any]] = None) -> Tuple[date, date]:
        """
        Helper method to get date range from report period or default to current month.
        
        Args:
            report_period: Optional dictionary with 'start' and 'end' dates
            
        Returns:
            Tuple of (start_date, end_date)
        """
        if report_period and 'start' in report_period and 'end' in report_period:
            start_date = report_period['start'].date() if isinstance(report_period['start'], datetime) else report_period['start']
            end_date = report_period['end'].date() if isinstance(report_period['end'], datetime) else report_period['end']
            
            # Handle string dates
            if isinstance(start_date, str):
                start_date = datetime.fromisoformat(start_date).date()
            if isinstance(end_date, str):
                end_date = datetime.fromisoformat(end_date).date()
                
            return start_date, end_date
        else:
            # Default to current month
            return self._get_current_month_range()
        
    def calculate_booking_financials(self, booking: Dict, 
                                  first_day_of_month: date, 
                                  last_day_of_month: date) -> Dict:
        """
        Calculate financial details for a single booking, including monthly breakdowns.
        
        Args:
            booking: The booking dictionary with booking details
            first_day_of_month: First day of the current month
            last_day_of_month: Last day of the current month
            
        Returns:
            The updated booking dictionary with calculated financial values
        """
        admin_fee_pct = float(booking['admin_fee_percentage'])
        check_in = booking['check_in'].date() if isinstance(booking['check_in'], datetime) else booking['check_in']
        check_out = booking['check_out'].date() if isinstance(booking['check_out'], datetime) else booking['check_out']
        
        # Calculate total nights
        total_nights = (check_out - check_in).days
        
        # Get precise nightly rates from actual reservations
        reservations = self.repository.get_booking_reservations(booking['id'])
        
        # Throw error if no reservations found - we must use actual rates
        if not reservations:
            raise ValueError(f"No reservations found for booking {booking['id']}. Cannot calculate accurate rates.")
        
        # Calculate total based on actual reservation rates
        total_calculated_amount = sum(float(res.rate) for res in reservations)
        
        # Calculate the average nightly rate for reference
        avg_nightly_rate = total_calculated_amount / total_nights if total_nights > 0 else 0
        
        # Determine month boundaries for this booking
        current_month_start = max(check_in, first_day_of_month)
        current_month_end = min(check_out, last_day_of_month)
        
        # Initialize counters
        current_month_amount = 0.0
        previous_month_amount = 0.0
        future_month_amount = 0.0
        current_month_nights = 0
        previous_month_nights = 0
        future_month_nights = 0
        
        # Categorize each reservation by month and sum rates accordingly
        for res in reservations:
            res_date = res.date.date() if isinstance(res.date, datetime) else res.date
            rate = float(res.rate)
            
            if first_day_of_month <= res_date <= last_day_of_month:
                # Current month
                current_month_amount += rate
                current_month_nights += 1
            elif res_date < first_day_of_month:
                # Previous month
                previous_month_amount += rate
                previous_month_nights += 1
            else:
                # Future month
                future_month_amount += rate
                future_month_nights += 1
        
        # Calculate admin fees
        admin_fee = current_month_amount * (admin_fee_pct / 100)
        owner_amount = current_month_amount - admin_fee
        
        # Update booking with calculated values
        booking.update({
            'admin_fee': admin_fee,
            'owner_amount': owner_amount,
            'total_nights': total_nights,
            'nightly_rate': avg_nightly_rate,
            'calculated_total_amount': total_calculated_amount,
            'current_month_nights': current_month_nights,
            'current_month_amount': current_month_amount,
            'previous_month_nights': previous_month_nights,
            'previous_month_amount': previous_month_amount,
            'future_month_nights': future_month_nights,
            'future_month_amount': future_month_amount,
            'current_month_start': current_month_start,
            'current_month_end': current_month_end
        })
        
        return booking
    
    def calculate_admin_fees(self, bookings: List[Dict], report_period: Optional[Dict[str, Any]] = None) -> List[Dict]:
        """
        Calculate admin fees for each booking and add to booking dict.
        Uses the provided report period or defaults to current month.
        
        Args:
            bookings: List of booking dictionaries
            report_period: Optional dictionary with 'start' and 'end' dates
            
        Returns:
            List of bookings with calculated financial details
        """
        # Get the date range from report period or default to current month
        start_date, end_date = self._get_date_range_from_period(report_period)
        
        logger.info(f"Calculating fees for period: {start_date} to {end_date}")
        
        # Process each booking
        for i, booking in enumerate(bookings):
            bookings[i] = self.calculate_booking_financials(
                booking, 
                start_date, 
                end_date
            )
        
        return bookings
    
    def calculate_financial_totals(self, bookings: List[Dict]) -> Dict[str, float]:
        """Calculate financial totals for a list of bookings."""
        # Calculate if any bookings span multiple months
        has_split_bookings = any(
            b.get('previous_month_nights', 0) > 0 or b.get('future_month_nights', 0) > 0 
            for b in bookings
        )
        
        totals = {
            # Total booking amounts - using calculated amount instead of booking's total_amount
            'total_amount': sum(float(b.get('calculated_total_amount', 0)) for b in bookings),
            
            # Current month totals (what will be paid this month)
            'current_month_amount': sum(float(b.get('current_month_amount', 0)) for b in bookings),
            'total_admin_fee': sum(float(b.get('admin_fee', 0)) for b in bookings),
            'total_owner_amount': sum(float(b.get('owner_amount', 0)) for b in bookings),
            
            # Previous month totals (already paid or pending from previous month)
            'previous_month_amount': sum(float(b.get('previous_month_amount', 0)) for b in bookings),
            
            # Future month totals (will be paid in future months)
            'future_month_amount': sum(float(b.get('future_month_amount', 0)) for b in bookings),
            
            # Count totals
            'total_bookings': len(bookings),
            'total_nights': sum(int(b.get('total_nights', 0)) for b in bookings),
            'current_month_nights': sum(int(b.get('current_month_nights', 0)) for b in bookings),
            
            # Flag for template to know if any bookings span multiple months
            'has_split_bookings': has_split_bookings
        }
        
        return totals
    
    def generate_email_content(self, 
                              communication_id: uuid.UUID,
                              template_name: Optional[str] = None) -> Optional[str]:
        """
        Generate email content from template.
        
        Args:
            communication_id: UUID of the communication
            template_name: Optional template name override
            
        Returns:
            HTML content of the rendered email template
        """
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
        
        # Define report period for financial calculations
        report_period = {
            'start': communication.report_period_start,
            'end': communication.report_period_end
        } if communication.report_period_start and communication.report_period_end else None
        
        # Calculate admin fees based on report period
        bookings = self.calculate_admin_fees(bookings, report_period)
        
        # Sort bookings first by apartment code and then by check-in date
        bookings = sorted(bookings, key=lambda b: (
            b.get('apartment_name', '').lower(), 
            b.get('check_in', '') if isinstance(b.get('check_in', ''), str) 
            else b.get('check_in', '').isoformat() if hasattr(b.get('check_in', ''), 'isoformat') 
            else ''
        ))
        
        # Calculate totals 
        totals = self.calculate_financial_totals(bookings)
        
        # Get admin fee percentage from first booking (should be consistent)
        admin_fee_percentage = bookings[0].get('admin_fee_percentage', 0)
        
        # Select template based on communication type if not explicitly provided
        if not template_name:
            if communication.comm_type == 'monthly_report':
                template_name = 'emails/monthly_report_es.html'
            else:
                template_name = 'emails/new_booking_es.html'
        
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
        
    def create_monthly_breakdown(self,
                               owner_id: uuid.UUID,
                               booking_ids: List[uuid.UUID],
                               custom_message: Optional[str] = None,
                               report_period: Optional[Dict[str, str]] = None) -> uuid.UUID:
        """
        Create a monthly breakdown communication for an owner.
        
        Args:
            owner_id: UUID of the owner
            booking_ids: List of booking UUIDs to include in the communication
            custom_message: Optional custom message to include in the communication
            report_period: Optional dictionary with 'start' and 'end' date strings
                          for the reporting period
        
        Returns:
            UUID of the created communication
        """
        # Get owner details
        stmt = text("""
            SELECT id, name, email
            FROM owners
            WHERE id = :owner_id
        """)
        owner = self.repository.session.execute(stmt, {"owner_id": owner_id}).mappings().one_or_none()
        
        if not owner:
            raise ValueError(f"Owner {owner_id} not found")
            
        if not owner['email']:
            raise ValueError(f"Owner {owner_id} has no email configured")
            
        # Format report period
        if not report_period:
            # Default to current month
            today = datetime.now().date()
            first_day = today.replace(day=1)
            if today.month == 12:
                next_month = today.replace(year=today.year + 1, month=1, day=1)
            else:
                next_month = today.replace(month=today.month + 1, day=1)
            last_day = next_month - timedelta(days=1)
            
            report_period = {
                'start': first_day.isoformat(),
                'end': last_day.isoformat()
            }
        
        report_start = datetime.fromisoformat(report_period['start'])
        report_end = datetime.fromisoformat(report_period['end'])
        
        # Create a subject line showing the month and year in Spanish
        # Use our custom formatter for consistent output regardless of system locale
        subject = f"Resumen mensual: {self._format_month_spanish(report_start)}"
        
        logger.info(f"Creating monthly breakdown for owner {owner_id} with {len(booking_ids)} bookings")
        
        # Start a transaction
        session = self.repository.session
        
        try:
            # Begin transaction explicitly
            session.begin_nested()
            
            # Create the communication record
            communication = self.repository.create_communication(
                owner_id=owner_id,
                recipient_email=owner['email'],
                subject=subject,
                comm_type='monthly_report',  # Specific type for monthly reports
                report_period_start=report_start,
                report_period_end=report_end,
                custom_message=custom_message
            )
            
            # Link bookings to the communication
            self.repository.link_bookings_to_communication(communication.id, booking_ids)
            
            # Generate the email content
            self.generate_email_content(communication.id)
            
            # Commit the nested transaction
            session.commit()
            
            return communication.id
            
        except Exception as e:
            # Roll back on error
            session.rollback()
            logger.exception(f"Failed to create monthly breakdown for owner {owner_id}: {str(e)}")
            raise