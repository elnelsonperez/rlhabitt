import os
import json
import uuid
import logging
from datetime import datetime
from typing import Dict, Optional, Union

# SQLAlchemy imports
from sqlalchemy import create_engine, MetaData, select, insert, update, text


logger = logging.getLogger(__name__)

class PostgresImporter:
    """
    Class to import reservation data from JSON into PostgreSQL database directly
    using SQLAlchemy for better performance than the Supabase API.
    """
    
    def __init__(self, postgres_url: Optional[str] = None):
        """
        Initialize the PostgreSQL importer.
        
        Args:
            postgres_url: PostgreSQL connection URL (optional, falls back to env var)
        """
        # Get database URL from params or environment variables
        self.postgres_url = postgres_url or os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
        
        if not self.postgres_url:
            raise ValueError("Missing PostgreSQL connection URL. Set DATABASE_URL or POSTGRES_URL environment variable.")
        
        # Initialize SQLAlchemy engine with a reasonable pool size for bulk operations
        self.engine = create_engine(
            self.postgres_url,
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True  # Check connection health
        )
        
        # Initialize metadata for reflection
        self.metadata = MetaData()
        
        # Initialize table objects
        self._init_tables()
    
    def _init_tables(self):
        """Initialize table objects by reflecting schema from the database."""
        self.metadata.reflect(bind=self.engine)
        
        # Access tables by name
        self.import_logs = self.metadata.tables['import_logs']
        self.buildings = self.metadata.tables['buildings']
        self.owners = self.metadata.tables['owners']
        self.apartments = self.metadata.tables['apartments']
        self.guests = self.metadata.tables['guests']
        self.payment_sources = self.metadata.tables['payment_sources']
        self.bookings = self.metadata.tables['bookings']
        self.reservations = self.metadata.tables['reservations']
    
    def create_import_log(self, month: int, year: int, correlation_id: Optional[str] = None) -> str:
        """
        Create an import log entry.
        
        Args:
            month: Month number (1-12)
            year: Year (e.g., 2023)
            correlation_id: Optional UUID to group related imports (default: None)
            
        Returns:
            str: The UUID of the created import log
        """
        import_id = str(uuid.uuid4())
        
        values = {
            'id': import_id,
            'month': month,
            'year': year,
            'status': 'in_progress'
        }
        
        if correlation_id:
            values['correlation_id'] = correlation_id
        
        with self.engine.begin() as conn:
            conn.execute(
                insert(self.import_logs).values(**values)
            )
        
        return import_id
    
    def update_import_log(self, import_id: str, status: str, error_message: Optional[str] = None):
        """
        Update an import log status.
        
        Args:
            import_id: The UUID of the import log
            status: New status ('completed', 'partial', or 'failed')
            error_message: Optional error message if status is 'failed' or 'partial'
        """
        values = {'status': status}
        if error_message:
            values['error_message'] = error_message
            
        with self.engine.begin() as conn:
            conn.execute(
                update(self.import_logs)
                .where(self.import_logs.c.id == import_id)
                .values(**values)
            )
    
    def get_or_create_building(self, conn, name: str) -> str:
        """
        Get a building by name or create it if it doesn't exist.
        
        Args:
            conn: Database connection
            name: Building name
            
        Returns:
            str: Building UUID
        """
        # Try to find existing building
        query = select(self.buildings.c.id).where(self.buildings.c.name == name)
        result = conn.execute(query).first()
        
        if result:
            return str(result[0])
        
        # Create new building
        building_id = str(uuid.uuid4())
        conn.execute(
            insert(self.buildings).values(
                id=building_id,
                name=name
            )
        )
        return building_id
    
    def get_or_create_owner(self, conn, name: Optional[str]) -> Optional[str]:
        """
        Get an owner by name or create it if it doesn't exist.
        
        Args:
            conn: Database connection
            name: Owner name
            
        Returns:
            str: Owner UUID or None if name is None/empty
        """
        if not name:
            return None
            
        # Try to find existing owner
        query = select(self.owners.c.id).where(self.owners.c.name == name)
        result = conn.execute(query).first()
        
        if result:
            return str(result[0])
        
        # Create new owner
        owner_id = str(uuid.uuid4())
        conn.execute(
            insert(self.owners).values(
                id=owner_id,
                name=name
            )
        )
        return owner_id
    
    def get_or_create_apartment(self, conn, building_id: str, code: Optional[str], 
                               raw_text: str, owner_id: Optional[str]) -> str:
        """
        Get an apartment by building and raw_text or create it if it doesn't exist.
        Only searches by raw_text, as that is the most reliable identifier.
        
        Args:
            conn: Database connection
            building_id: Building UUID
            code: Apartment code (may be None)
            raw_text: Apartment raw text
            owner_id: Owner UUID (may be None)
            
        Returns:
            str: Apartment UUID
        """
        # Try to find existing apartment by raw_text only (more reliable)
        query = select(self.apartments.c.id).where(
            (self.apartments.c.building_id == building_id) &
            (self.apartments.c.raw_text == raw_text)
        )
            
        result = conn.execute(query).first()
        
        if result:
            apartment_id = str(result[0])
            
            # Update owner if needed and provided
            if owner_id:
                conn.execute(
                    update(self.apartments)
                    .where(self.apartments.c.id == apartment_id)
                    .values(owner_id=owner_id)
                )
                
            return apartment_id
        
        # Create new apartment
        apartment_id = str(uuid.uuid4())
        values = {
            'id': apartment_id,
            'building_id': building_id,
            'raw_text': raw_text,
        }
        
        if code:
            values['code'] = code
            
        if owner_id:
            values['owner_id'] = owner_id
            
        conn.execute(
            insert(self.apartments).values(**values)
        )
        return apartment_id
    
    def get_or_create_guest(self, conn, name: Optional[str]) -> Optional[str]:
        """
        Get a guest by name or create it if it doesn't exist.
        
        Args:
            conn: Database connection
            name: Guest name
            
        Returns:
            str: Guest UUID or None if name is None/empty
        """
        if not name:
            return None
            
        # Try to find existing guest
        query = select(self.guests.c.id).where(self.guests.c.name == name)
        result = conn.execute(query).first()
        
        if result:
            return str(result[0])
        
        # Create new guest
        guest_id = str(uuid.uuid4())
        conn.execute(
            insert(self.guests).values(
                id=guest_id,
                name=name
            )
        )
        return guest_id
    
    def get_payment_source(self, conn, name: str) -> Optional[str]:
        """
        Get a payment source by name.
        
        Args:
            conn: Database connection
            name: Payment source name
            
        Returns:
            str: Payment source UUID or None if not found
        """
        query = select(self.payment_sources.c.id).where(self.payment_sources.c.name == name)
        result = conn.execute(query).first()
        
        if result:
            return str(result[0])
        
        return None
    
    def get_existing_booking_by_comment(self, conn, apartment_id: str, comment: Optional[str]) -> Optional[str]:
        """
        Check if there's an existing booking for a specific apartment and comment.
        Reservations with the same comment are considered part of the same booking.
        
        Args:
            conn: Database connection
            apartment_id: Apartment UUID
            comment: Reservation comment
            
        Returns:
            str: Booking UUID or None if not found
        """
        if not comment:
            return None
        
        # Execute a query to find a booking ID by comment
        query = select(self.reservations.c.booking_id).where(
            (self.reservations.c.apartment_id == apartment_id) &
            (self.reservations.c.comment == comment)
        ).limit(1)
        
        result = conn.execute(query).first()
        
        if result:
            return str(result[0])
        
        return None
    
    def create_booking(self, conn, apartment_id: str, guest_id: Optional[str] = None, 
                      check_in_date: str = None, check_out_date: Optional[str] = None,
                      rate: float = 0.0, payment_source_id: Optional[str] = None,
                      total_amount: Optional[float] = None) -> str:
        """
        Create a new booking with check_in and optional check_out dates.
        
        Args:
            conn: Database connection
            apartment_id: Apartment UUID
            guest_id: Guest UUID (may be None)
            check_in_date: Check-in date in ISO format
            check_out_date: Check-out date in ISO format (may be None)
            rate: Nightly rate (default 0.0)
            payment_source_id: Payment source UUID (may be None)
            total_amount: Total booking amount (may be None, parsed from comment)
            
        Returns:
            str: Created booking UUID
        """
        booking_id = str(uuid.uuid4())
        values = {
            'id': booking_id,
            'apartment_id': apartment_id
        }
        
        if check_in_date:
            values['check_in'] = check_in_date
        
        # If check_out date is provided, calculate nights and add to values
        if check_out_date and check_in_date:
            values['check_out'] = check_out_date
            
            # Try to calculate nights if dates are valid
            try:
                check_in = datetime.fromisoformat(check_in_date)
                check_out = datetime.fromisoformat(check_out_date)
                nights = (check_out - check_in).days
                
                if nights > 0:
                    values['nights'] = nights
                    
                    # Use provided total_amount if available, otherwise calculate from rate and nights
                    if total_amount is not None:
                        values['total_amount'] = total_amount
                    else:
                        values['total_amount'] = rate * nights
            except (ValueError, TypeError):
                # If date parsing fails but we have total_amount, still set it
                if total_amount is not None:
                    values['total_amount'] = total_amount
        elif total_amount is not None:
            # Even without check_out date, set total_amount if provided
            values['total_amount'] = total_amount
        
        if guest_id:
            values['guest_id'] = guest_id
            
        if payment_source_id:
            values['payment_source_id'] = payment_source_id
            
        conn.execute(
            insert(self.bookings).values(**values)
        )
        return booking_id
    
    def upsert_reservation(self, conn, booking_id: str, apartment_id: str, date_str: str,
                          rate: float, color_hex: Optional[str], comment: Optional[str]):
        """
        Create or update a reservation using SQLAlchemy with manual existence check.
        
        Args:
            conn: Database connection
            booking_id: Booking UUID
            apartment_id: Apartment UUID
            date_str: Date string in ISO format
            rate: Nightly rate
            color_hex: Color hex code (may be None)
            comment: Reservation comment (may be None)
        """
        # First, check if the reservation exists using SQLAlchemy's select
        query = select(self.reservations.c.id).where(
            (self.reservations.c.apartment_id == apartment_id) &
            (self.reservations.c.date == date_str)
        )
        
        existing_reservation = conn.execute(query).first()
        
        if existing_reservation:
            # If reservation exists, update it
            update_stmt = (
                update(self.reservations)
                .where(
                    (self.reservations.c.apartment_id == apartment_id) &
                    (self.reservations.c.date == date_str)
                )
                .values(
                    booking_id=booking_id,
                    rate=rate,
                    color_hex=color_hex,
                    comment=comment,
                    updated_at=text("NOW()")
                )
            )
            conn.execute(update_stmt)
        else:
            # If reservation doesn't exist, insert a new one
            values = {
                "booking_id": booking_id,
                "apartment_id": apartment_id,
                "date": date_str,
                "rate": rate,
                "color_hex": color_hex,
                "comment": comment
            }
            insert_stmt = insert(self.reservations).values(**values)
            conn.execute(insert_stmt)
    
    def process_building(self, conn, building_data: Dict):
        """
        Process a building's data.
        
        Args:
            conn: Database connection
            building_data: Building data dictionary
        """
        building_name = building_data.get("name")
        
        if not building_name:
            logger.warning("Building data missing name, skipping")
            return
        
        # Get or create the building
        building_id = self.get_or_create_building(conn, building_name)
        
        # Process each apartment
        apartment_count = len(building_data.get("apartments", []))
        logger.debug(f"Building '{building_name}' has {apartment_count} apartments")
        
        for apt_idx, apartment_data in enumerate(building_data.get("apartments", []), 1):
            apt_code = apartment_data.get("code")
            apt_raw = apartment_data.get("raw_text")
            logger.debug(f"Processing apartment {apt_idx}/{apartment_count}: {apt_code or apt_raw}")
            self.process_apartment(conn, building_id, apartment_data, building_data)
            
    def process_apartment(self, conn, building_id: str, apartment_data: Dict, building_data: Dict = None):
        """
        Process an apartment's data and group reservations into bookings based on comments.
        
        Args:
            conn: Database connection
            building_id: Building UUID
            apartment_data: Apartment data dictionary
            building_data: Building data dictionary (for collecting related reservations)
        """
        apt_code = apartment_data.get("code")
        raw_text = apartment_data.get("raw_text")
        owner_name = apartment_data.get("owner")
        
        if not raw_text:
            logger.warning("Apartment data missing raw_text, skipping")
            return
        
        # Get or create the owner
        owner_id = self.get_or_create_owner(conn, owner_name) if owner_name else None
        
        # Get or create the apartment
        apartment_id = self.get_or_create_apartment(conn, building_id, apt_code, raw_text, owner_id)
        
        # Group reservations by comment to identify multi-day bookings
        reservations_by_comment = {}
        for reservation in apartment_data.get("reservations", []):
            comment = reservation.get("comment")
            date_str = reservation.get("date")
            
            if not date_str:
                continue
                
            if comment not in reservations_by_comment:
                reservations_by_comment[comment] = []
                
            reservations_by_comment[comment].append({
                "date": date_str,
                "data": reservation
            })
        
        # Sort each group's reservations by date
        for comment, reservations in reservations_by_comment.items():
            sorted_reservations = sorted(reservations, key=lambda x: x["date"])
            
            # Only process if we have valid reservations
            if not sorted_reservations:
                continue
                
            # Get first and last reservation date for check-in and check-out
            first_reservation = sorted_reservations[0]
            last_reservation = sorted_reservations[-1]
            
            check_in_date = first_reservation["date"]
            check_out_date = None
            
            # For check-out, we use the day after the last reservation
            try:
                from datetime import timedelta
                last_date = datetime.fromisoformat(last_reservation["date"])
                check_out_date = (last_date + timedelta(days=1)).isoformat().split('T')[0]
            except (ValueError, TypeError, AttributeError):
                # If there's an error parsing the date, leave check_out_date as None
                pass
                
            # Process first reservation to create/get booking
            first_reservation_data = first_reservation["data"]
            rate_str = first_reservation_data.get("rate")
            
            # Handle rate parsing safely to avoid numeric conversion errors
            try:
                rate = float(rate_str) if rate_str and rate_str != "False" and rate_str.strip() else 0.0
            except (ValueError, TypeError):
                rate = 0.0
                
            # Parse guest name from comment
            guest_name = self.parse_guest_name(comment)
            guest_id = self.get_or_create_guest(conn, guest_name) if guest_name else None
            
            # Detect payment source
            payment_source_id = self.detect_payment_source(conn, comment)
            
            # Parse total amount from comment
            total_amount = self.parse_total_amount(comment)
            
            # Check for existing booking by comment
            existing_booking_id = self.get_existing_booking_by_comment(conn, apartment_id, comment)
            
            if existing_booking_id:
                booking_id = existing_booking_id
                
                # Calculate values for update
                update_values = {"check_in": check_in_date}
                
                if check_out_date:
                    update_values["check_out"] = check_out_date
                    
                    # Calculate nights if we have valid dates
                    try:
                        check_in = datetime.fromisoformat(check_in_date)
                        check_out = datetime.fromisoformat(check_out_date)
                        nights = (check_out - check_in).days
                        
                        if nights > 0:
                            update_values["nights"] = nights
                            
                            # Use parsed total amount if available, otherwise calculate from rate and nights
                            if total_amount is not None:
                                update_values["total_amount"] = total_amount
                            else:
                                update_values["total_amount"] = rate * nights
                    except (ValueError, TypeError):
                        pass
                elif total_amount is not None:
                    # If we only have total amount but not check_out, still update the total_amount
                    update_values["total_amount"] = total_amount
                
                # Execute the update with all collected values
                update_stmt = (
                    update(self.bookings)
                    .where(self.bookings.c.id == booking_id)
                    .values(**update_values)
                )
                
                conn.execute(update_stmt)
            else:
                # Create a new booking with correct parameters
                booking_id = self.create_booking(
                    conn=conn,
                    apartment_id=apartment_id,
                    guest_id=guest_id,
                    check_in_date=check_in_date,
                    check_out_date=check_out_date,
                    rate=rate,
                    payment_source_id=payment_source_id,
                    total_amount=total_amount
                )
            
            # Process all reservations in the group
            for reservation_info in sorted_reservations:
                reservation_data = reservation_info["data"]
                date_str = reservation_info["date"]
                
                rate_str = reservation_data.get("rate")
                try:
                    rate = float(rate_str) if rate_str and rate_str != "False" and rate_str.strip() else 0.0
                except (ValueError, TypeError):
                    rate = 0.0
                
                color_data = reservation_data.get("color")
                color_hex = None
                if color_data and isinstance(color_data, dict) and "value" in color_data:
                    color_hex = color_data["value"]
                
                # Create or update the individual reservation
                self.upsert_reservation(
                    conn=conn,
                    booking_id=booking_id,
                    apartment_id=apartment_id,
                    date_str=date_str,
                    rate=rate,
                    color_hex=color_hex,
                    comment=comment
                )
    
    def parse_guest_name(self, comment: Optional[str]) -> Optional[str]:
        """
        Parse guest name from comment.
        
        Args:
            comment: Reservation comment
            
        Returns:
            str: Guest name or None if can't be parsed
        """
        if not comment:
            return None
            
        # Simple parsing for guest name (first line usually contains the name)
        guest_name = comment.split('\n')[0] if '\n' in comment else comment
        
        # Remove any prefix markers like "~"
        guest_name = guest_name.lstrip('~')
        
        # If the name contains "//", take the first part
        if '//' in guest_name:
            guest_name = guest_name.split('//')[0]
        
        # Trim whitespace
        guest_name = guest_name.strip()
        
        return guest_name if guest_name else None
        
    def parse_total_amount(self, comment: Optional[str]) -> Optional[float]:
        """
        Parse total amount from comment text in various formats such as:
        - total US$: 555
        - total: 555
        - Total : 555
        - Total USD: $1971.42
        - Total: 1971.42
        - Total : 1459.94
        - Total USD: $1620.00
        - Total: 642
        - Total USD: $1,075.00
        
        Args:
            comment: Reservation comment
            
        Returns:
            float: Total amount or None if can't be parsed
        """
        if not comment:
            return None
            
        # Split by lines to find the total amount in any line
        lines = comment.split('\n')
        
        # Patterns to match:
        # 1. Case insensitive "total" followed by optional currency indicators
        # 2. Followed by a colon (with optional spaces)
        # 3. Followed by an optional dollar sign
        # 4. Followed by a number which may include commas and a decimal point
        import re
        
        total_patterns = [
            # Match "total" (case insensitive) followed by various optional text and then a number
            r'(?i)total(?:\s*(?:US)?(?:\$|USD)?)?(?:\s*:)\s*\$?\s*([\d,\.]+)',
            # Alternative format with dollar sign after "USD"
            r'(?i)total\s+USD\s*\$?\s*:?\s*([\d,\.]+)'
        ]
        
        # Try to match the patterns in each line
        for line in lines:
            line = line.strip()
            
            for pattern in total_patterns:
                match = re.search(pattern, line)
                if match:
                    # Extract the amount string and clean it
                    amount_str = match.group(1)
                    
                    # Remove commas (for numbers like 1,075.00)
                    amount_str = amount_str.replace(',', '')
                    
                    try:
                        # Convert to float
                        return float(amount_str)
                    except (ValueError, TypeError):
                        # If conversion fails, continue to the next match
                        continue
                        
        # If no valid total amount was found
        return None
    
    def detect_payment_source(self, conn, comment: Optional[str]) -> Optional[str]:
        """
        Detect payment source from comment.
        
        Args:
            conn: Database connection
            comment: Reservation comment
            
        Returns:
            str: Payment source UUID or None if not detected
        """
        if not comment:
            return None
            
        comment_upper = comment.upper()
        
        if "BOOKING.COM" in comment_upper:
            return self.get_payment_source(conn, "Booking.com")
        elif "AIRBNB" in comment_upper:
            return self.get_payment_source(conn, "Airbnb")
            
        return None
    
    
    def process_reservation(self, conn, apartment_id: str, reservation_data: Dict):
        """
        Process a reservation's data.
        
        Args:
            conn: Database connection
            apartment_id: Apartment UUID
            reservation_data: Reservation data dictionary
        """
        date_str = reservation_data.get("date")
        rate_str = reservation_data.get("rate")
        color_data = reservation_data.get("color")
        comment = reservation_data.get("comment")
        
        if not date_str:
            logger.warning("Reservation data missing date, skipping")
            return
            
        # Handle rate parsing safely to avoid numeric conversion errors
        try:
            rate = float(rate_str) if rate_str and rate_str != "False" and rate_str.strip() else 0.0
        except (ValueError, TypeError):
            rate = 0.0
            
        # Extract color hex if available
        color_hex = None
        if color_data and isinstance(color_data, dict) and "value" in color_data:
            color_hex = color_data["value"]
            
        # Parse guest name from comment
        guest_name = self.parse_guest_name(comment)
        guest_id = self.get_or_create_guest(conn, guest_name) if guest_name else None
        
        # Detect payment source
        payment_source_id = self.detect_payment_source(conn, comment)
        
        # Check for existing booking by comment
        existing_booking_id = self.get_existing_booking_by_comment(conn, apartment_id, comment)
        
        if existing_booking_id:
            booking_id = existing_booking_id
        else:
            # Create a new booking
            booking_id = self.create_booking(
                conn=conn,
                apartment_id=apartment_id,
                guest_id=guest_id,
                check_in_date=date_str,  # We'll update this later if needed
                rate=rate,
                payment_source_id=payment_source_id
            )
            
        # Create or update the reservation
        self.upsert_reservation(
            conn=conn,
            booking_id=booking_id,
            apartment_id=apartment_id,
            date_str=date_str,
            rate=rate,
            color_hex=color_hex,
            comment=comment
        )
    
    def import_sheet_data(self, sheet_data: Dict, correlation_id: Optional[str] = None) -> str:
        """
        Import data for a single month sheet.
        
        Args:
            sheet_data: Sheet data dictionary with buildings, apartments, reservations
            correlation_id: Optional UUID to group related imports (default: None)
            
        Returns:
            str: Import log UUID
        """
        month = sheet_data.get("month")
        year = sheet_data.get("year")
        
        if not month or not year:
            raise ValueError("Sheet data missing month or year")
            
        # Log the month and year being imported
        month_name = {
            1: "January", 2: "February", 3: "March", 4: "April",
            5: "May", 6: "June", 7: "July", 8: "August",
            9: "September", 10: "October", 11: "November", 12: "December"
        }.get(month, "Unknown")
        
        logger.info(f"Starting import for {month_name} {year}")
            
        # Create import log with correlation_id if provided
        import_id = self.create_import_log(month, year, correlation_id)
        building_count = len(sheet_data.get("buildings", []))
        logger.info(f"Found {building_count} buildings to process")
        
        try:
            # Count apartments and reservations for logging
            apartment_count = 0
            reservation_count = 0
            
            for building in sheet_data.get("buildings", []):
                apartment_count += len(building.get("apartments", []))
                for apartment in building.get("apartments", []):
                    reservation_count += len(apartment.get("reservations", []))
            
            logger.info(f"Found {apartment_count} apartments and {reservation_count} reservations")
            
            # Process each building in a single transaction
            with self.engine.begin() as conn:
                for i, building_data in enumerate(sheet_data.get("buildings", []), 1):
                    building_name = building_data.get("name", f"Building #{i}")
                    logger.info(f"Processing building {i}/{building_count}: {building_name}")
                    self.process_building(conn, building_data)
                
            # Update import log to completed
            self.update_import_log(import_id, "completed")
            logger.info(f"Successfully completed import for {month_name} {year}")
            
            return import_id
        except Exception as e:
            logger.error(f"Error importing {month_name} {year} sheet data: {e}")
            self.update_import_log(import_id, "failed", str(e))
            # Re-raising the exception allows the caller to handle it
            raise
    
    def import_multi_sheet_data(self, json_data: Dict, correlation_id: Optional[str] = None) -> list:
        """
        Import data from multiple sheets, each in its own transaction and with its own import log.
        
        Args:
            json_data: JSON data with multiple sheets
            correlation_id: Optional UUID to group related imports (default: None)
            
        Returns:
            list: List of import log UUIDs for each processed sheet
        """
        sheets = json_data.get("sheets", [])
        
        if not sheets:
            raise ValueError("No sheets found in JSON data")
            
        logger.info(f"Starting multi-sheet import with {len(sheets)} sheets")
        
        # Count total buildings, apartments, and reservations for logging
        total_buildings = 0
        total_apartments = 0
        total_reservations = 0
        
        for sheet in sheets:
            sheet_data = sheet.get("data", {})
            total_buildings += len(sheet_data.get("buildings", []))
            
            for building in sheet_data.get("buildings", []):
                total_apartments += len(building.get("apartments", []))
                for apartment in building.get("apartments", []):
                    total_reservations += len(apartment.get("reservations", []))
        
        logger.info(f"Found total: {total_buildings} buildings, {total_apartments} apartments, {total_reservations} reservations")
        
        # Track import logs and processing status
        import_logs = []
        successful_imports = 0
        failed_imports = 0
        
        # Process each sheet in its own transaction with its own import log
        for sheet_idx, sheet in enumerate(sheets, 1):
            sheet_data = sheet.get("data", {})
            sheet_name = sheet.get("name", f"Sheet #{sheet_idx}")
            sheet_month = sheet_data.get("month")
            sheet_year = sheet_data.get("year")
            
            # Default to current month/year if not specified
            if not sheet_month:
                sheet_month = datetime.now().month
            if not sheet_year:
                sheet_year = datetime.now().year
            
            month_name = {
                1: "January", 2: "February", 3: "March", 4: "April",
                5: "May", 6: "June", 7: "July", 8: "August",
                9: "September", 10: "October", 11: "November", 12: "December"
            }.get(sheet_month, "Unknown")
            
            logger.info(f"Processing sheet {sheet_idx}/{len(sheets)}: {month_name} {sheet_year} ({sheet_name})")
            
            # Create an import log for this specific sheet with the correlation_id
            import_id = self.create_import_log(sheet_month, sheet_year, correlation_id)
            import_logs.append(import_id)
            
            try:
                # Count buildings, apartments and reservations for this sheet
                building_count = len(sheet_data.get("buildings", []))
                apartment_count = 0
                reservation_count = 0
                
                for building in sheet_data.get("buildings", []):
                    apartment_count += len(building.get("apartments", []))
                    for apartment in building.get("apartments", []):
                        reservation_count += len(apartment.get("reservations", []))
                
                logger.info(f"Sheet contains {building_count} buildings, {apartment_count} apartments, {reservation_count} reservations")
                
                # Process the sheet in its own transaction
                with self.engine.begin() as conn:
                    for b_idx, building_data in enumerate(sheet_data.get("buildings", []), 1):
                        building_name = building_data.get("name", f"Building #{b_idx}")
                        logger.info(f"Processing building {b_idx}/{building_count}: {building_name}")
                        self.process_building(conn, building_data)
                        
                # Update import log to completed
                self.update_import_log(import_id, "completed")
                logger.info(f"Successfully processed sheet {sheet_idx}: {month_name} {sheet_year}")
                successful_imports += 1
                
            except Exception as e:
                # If a sheet fails, log the error and mark its import log as failed
                error_msg = f"Error processing sheet {sheet_idx} ({sheet_name}): {str(e)}"
                logger.error(error_msg)
                self.update_import_log(import_id, "failed", str(e))
                failed_imports += 1
        
        # Log the overall results of the multi-sheet import
        if failed_imports == 0:
            logger.info(f"Successfully completed import of all {len(sheets)} sheets")
        elif successful_imports > 0:
            logger.warning(f"Partially completed import: {successful_imports} sheets succeeded, {failed_imports} failed")
        else:
            logger.error(f"Import failed: all {len(sheets)} sheets failed to process")
        
        return import_logs
    
    def import_json(self, json_data: Union[Dict, str], correlation_id: Optional[str] = None) -> Union[str, list]:
        """
        Import data from JSON.
        
        Args:
            json_data: JSON data as dictionary or string
            correlation_id: Optional UUID to group related imports (default: None)
            
        Returns:
            Union[str, list]: Import log UUID for single sheet or list of import log UUIDs for multiple sheets
        """
        # Parse JSON if it's a string
        if isinstance(json_data, str):
            json_data = json.loads(json_data)
            
        # Generate a correlation ID if not provided
        if correlation_id is None:
            correlation_id = str(uuid.uuid4())
        
        # Determine if it's single sheet or multi-sheet
        if "sheets" in json_data:
            # Returns a list of import log UUIDs (one per sheet)
            return self.import_multi_sheet_data(json_data, correlation_id)
        else:
            # Returns a single import log UUID
            return self.import_sheet_data(json_data, correlation_id)