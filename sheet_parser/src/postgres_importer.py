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
    
    def create_import_log(self, month: int, year: int) -> str:
        """
        Create an import log entry.
        
        Args:
            month: Month number (1-12)
            year: Year (e.g., 2023)
            
        Returns:
            str: The UUID of the created import log
        """
        import_id = str(uuid.uuid4())
        
        with self.engine.begin() as conn:
            conn.execute(
                insert(self.import_logs).values(
                    id=import_id,
                    month=month,
                    year=year,
                    status='in_progress'
                )
            )
        
        return import_id
    
    def update_import_log(self, import_id: str, status: str, error_message: Optional[str] = None):
        """
        Update an import log status.
        
        Args:
            import_id: The UUID of the import log
            status: New status ('completed' or 'failed')
            error_message: Optional error message if status is 'failed'
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
    
    def get_existing_booking(self, conn, apartment_id: str, date_str: str) -> Optional[str]:
        """
        Check if there's an existing booking for a specific apartment and date.
        
        Args:
            conn: Database connection
            apartment_id: Apartment UUID
            date_str: Date string in ISO format
            
        Returns:
            str: Booking UUID or None if not found
        """
        # Execute a join query to find the booking ID
        query = text("""
            SELECT r.booking_id
            FROM reservations r
            WHERE r.apartment_id = :apartment_id 
            AND r.date = :date
            LIMIT 1
        """)
        
        result = conn.execute(query, {"apartment_id": apartment_id, "date": date_str}).first()
        
        if result:
            return str(result[0])
        
        return None
    
    def create_booking(self, conn, apartment_id: str, guest_id: Optional[str], 
                      reservation_date: str, rate: float,
                      payment_source_id: Optional[str]) -> str:
        """
        Create a new booking.
        
        Args:
            conn: Database connection
            apartment_id: Apartment UUID
            guest_id: Guest UUID (may be None)
            reservation_date: Reservation date in ISO format
            rate: Nightly rate
            payment_source_id: Payment source UUID (may be None)
            
        Returns:
            str: Created booking UUID
        """

        # Only set check_in date, the rest will be NULL
        # In the future, we'll parse check_out and nights from comments
        booking_id = str(uuid.uuid4())
        values = {
            'id': booking_id,
            'apartment_id': apartment_id,
            'check_in': reservation_date
        }
        
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
        Create or update a reservation using the upsert_reservation function.
        
        Args:
            conn: Database connection
            booking_id: Booking UUID
            apartment_id: Apartment UUID
            date_str: Date string in ISO format
            rate: Nightly rate
            color_hex: Color hex code (may be None)
            comment: Reservation comment (may be None)
        """
        # Execute the upsert_reservation function
        query = text("""
            SELECT upsert_reservation(
                :booking_id, 
                :apartment_id, 
                :date, 
                :rate, 
                :color_hex, 
                :comment
            )
        """)
        
        conn.execute(query, {
            "booking_id": booking_id,
            "apartment_id": apartment_id,
            "date": date_str,
            "rate": rate,
            "color_hex": color_hex,
            "comment": comment
        })
    
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
            self.process_apartment(conn, building_id, apartment_data)
            
    def process_apartment(self, conn, building_id: str, apartment_data: Dict):
        """
        Process an apartment's data.
        
        Args:
            conn: Database connection
            building_id: Building UUID
            apartment_data: Apartment data dictionary
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
        
        # Process each reservation
        reservation_count = len(apartment_data.get("reservations", []))
        logger.debug(f"Apartment '{raw_text}' has {reservation_count} reservations")
        
        for res_idx, reservation_data in enumerate(apartment_data.get("reservations", []), 1):
            res_date = reservation_data.get("date", "unknown date")
            logger.debug(f"Processing reservation {res_idx}/{reservation_count}: {res_date}")
            self.process_reservation(conn, apartment_id, reservation_data)
    
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
        
        # Check for existing booking
        existing_booking_id = self.get_existing_booking(conn, apartment_id, date_str)
        
        if existing_booking_id:
            booking_id = existing_booking_id
        else:
            # Create a new booking (default 1-day stay)
            booking_id = self.create_booking(
                conn=conn,
                apartment_id=apartment_id,
                guest_id=guest_id,
                reservation_date=date_str,
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
    
    def import_sheet_data(self, sheet_data: Dict) -> str:
        """
        Import data for a single month sheet.
        
        Args:
            sheet_data: Sheet data dictionary with buildings, apartments, reservations
            
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
            
        # Create import log
        import_id = self.create_import_log(month, year)
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
            
            # Use a single transaction for the entire import process
            with self.engine.begin() as conn:
                # Process each building
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
            raise
    
    def import_multi_sheet_data(self, json_data: Dict) -> str:
        """
        Import data from multiple sheets.
        
        Args:
            json_data: JSON data with multiple sheets
            
        Returns:
            str: Import log UUID
        """
        sheets = json_data.get("sheets", [])
        
        if not sheets:
            raise ValueError("No sheets found in JSON data")
            
        # Use the last sheet's month/year for the import log
        last_sheet_data = sheets[-1].get("data", {})
        month = last_sheet_data.get("month", datetime.now().month)
        year = last_sheet_data.get("year", datetime.now().year)
        
        logger.info(f"Starting multi-sheet import with {len(sheets)} sheets")
        
        # Create import log
        import_id = self.create_import_log(month, year)
        
        try:
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
            
            # Use a single transaction for all sheets
            with self.engine.begin() as conn:
                # Process each sheet
                for sheet_idx, sheet in enumerate(sheets, 1):
                    sheet_data = sheet.get("data", {})
                    sheet_name = sheet.get("name", f"Sheet #{sheet_idx}")
                    sheet_month = sheet_data.get("month")
                    sheet_year = sheet_data.get("year")
                    
                    if sheet_month and sheet_year:
                        month_name = {
                            1: "January", 2: "February", 3: "March", 4: "April",
                            5: "May", 6: "June", 7: "July", 8: "August",
                            9: "September", 10: "October", 11: "November", 12: "December"
                        }.get(sheet_month, "Unknown")
                        logger.info(f"Processing sheet {sheet_idx}/{len(sheets)}: {month_name} {sheet_year}")
                    else:
                        logger.info(f"Processing sheet {sheet_idx}/{len(sheets)}: {sheet_name}")
                    
                    # Process each building in the sheet
                    building_count = len(sheet_data.get("buildings", []))
                    logger.info(f"Sheet contains {building_count} buildings")
                    
                    for b_idx, building_data in enumerate(sheet_data.get("buildings", []), 1):
                        building_name = building_data.get("name", f"Building #{b_idx}")
                        logger.info(f"Processing building {b_idx}/{building_count}: {building_name}")
                        self.process_building(conn, building_data)
            
            # Update import log to completed
            self.update_import_log(import_id, "completed")
            logger.info(f"Successfully completed import of {len(sheets)} sheets")
            
            return import_id
        except Exception as e:
            logger.error(f"Error importing multiple sheets: {e}")
            self.update_import_log(import_id, "failed", str(e))
            raise
    
    def import_json(self, json_data: Union[Dict, str]) -> str:
        """
        Import data from JSON.
        
        Args:
            json_data: JSON data as dictionary or string
            
        Returns:
            str: Import log UUID
        """
        # Parse JSON if it's a string
        if isinstance(json_data, str):
            json_data = json.loads(json_data)
            
        # Determine if it's single sheet or multi-sheet
        if "sheets" in json_data:
            return self.import_multi_sheet_data(json_data)
        else:
            return self.import_sheet_data(json_data)