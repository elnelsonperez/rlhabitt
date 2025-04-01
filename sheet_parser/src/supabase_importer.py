import os
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Union
from supabase import create_client, Client
import uuid

logger = logging.getLogger(__name__)

class SupabaseImporter:
    """
    Class to import reservation data from JSON into Supabase using the API
    instead of PL/pgSQL functions.
    """
    
    def __init__(self, supabase_url: Optional[str] = None, supabase_key: Optional[str] = None):
        """
        Initialize the Supabase importer.
        
        Args:
            supabase_url: Supabase URL (optional, falls back to env var)
            supabase_key: Supabase API Key (optional, falls back to env var)
        """
        # Get credentials from params or environment variables
        self.supabase_url = supabase_url or os.environ.get("SUPABASE_URL")
        self.supabase_key = supabase_key or os.environ.get("SUPABASE_KEY")
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_KEY environment variables.")
        
        # Initialize Supabase client
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        
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
        
        # Create the import log
        self.supabase.table("import_logs").insert({
            "id": import_id,
            "month": month,
            "year": year,
            "status": "in_progress"
        }).execute()
        
        return import_id
    
    def update_import_log(self, import_id: str, status: str, error_message: Optional[str] = None):
        """
        Update an import log status.
        
        Args:
            import_id: The UUID of the import log
            status: New status ('completed' or 'failed')
            error_message: Optional error message if status is 'failed'
        """
        data = {"status": status}
        if error_message:
            data["error_message"] = error_message
            
        self.supabase.table("import_logs").update(data).eq("id", import_id).execute()
    
    def get_or_create_building(self, name: str) -> str:
        """
        Get a building by name or create it if it doesn't exist.
        
        Args:
            name: Building name
            
        Returns:
            str: Building UUID
        """
        # Try to find existing building
        result = self.supabase.table("buildings").select("id").eq("name", name).execute()
        
        if result.data and len(result.data) > 0:
            return result.data[0]["id"]
        
        # Create new building
        response = self.supabase.table("buildings").insert({"name": name}).execute()
        return response.data[0]["id"]
    
    def get_or_create_owner(self, name: Optional[str]) -> Optional[str]:
        """
        Get an owner by name or create it if it doesn't exist.
        
        Args:
            name: Owner name
            
        Returns:
            str: Owner UUID or None if name is None/empty
        """
        if not name:
            return None
            
        # Try to find existing owner
        result = self.supabase.table("owners").select("id").eq("name", name).execute()
        
        if result.data and len(result.data) > 0:
            return result.data[0]["id"]
        
        # Create new owner
        response = self.supabase.table("owners").insert({"name": name}).execute()
        return response.data[0]["id"]
    
    def get_or_create_apartment(self, building_id: str, code: Optional[str], raw_text: str, owner_id: Optional[str]) -> str:
        """
        Get an apartment by building and code/raw_text or create it if it doesn't exist.
        
        Args:
            building_id: Building UUID
            code: Apartment code (may be None)
            raw_text: Apartment raw text
            owner_id: Owner UUID (may be None)
            
        Returns:
            str: Apartment UUID
        """
        # Try to find existing apartment
        query = self.supabase.table("apartments").select("id").eq("building_id", building_id)
        
        if code:
            query = query.eq("code", code)
        else:
            query = query.eq("raw_text", raw_text)
            
        result = query.execute()
        
        if result.data and len(result.data) > 0:
            apartment_id = result.data[0]["id"]
            
            # Update owner if needed
            if owner_id:
                self.supabase.table("apartments").update(
                    {"owner_id": owner_id}
                ).eq("id", apartment_id).execute()
                
            return apartment_id
        
        # Create new apartment
        data = {
            "building_id": building_id,
            "raw_text": raw_text,
            "owner_id": owner_id
        }
        
        if code:
            data["code"] = code
            
        response = self.supabase.table("apartments").insert(data).execute()
        return response.data[0]["id"]
    
    def get_or_create_guest(self, name: Optional[str]) -> Optional[str]:
        """
        Get a guest by name or create it if it doesn't exist.
        
        Args:
            name: Guest name
            
        Returns:
            str: Guest UUID or None if name is None/empty
        """
        if not name:
            return None
            
        # Try to find existing guest
        result = self.supabase.table("guests").select("id").eq("name", name).execute()
        
        if result.data and len(result.data) > 0:
            return result.data[0]["id"]
        
        # Create new guest
        response = self.supabase.table("guests").insert({"name": name}).execute()
        return response.data[0]["id"]
    
    def get_payment_source(self, name: str) -> Optional[str]:
        """
        Get a payment source by name.
        
        Args:
            name: Payment source name
            
        Returns:
            str: Payment source UUID or None if not found
        """
        result = self.supabase.table("payment_sources").select("id").eq("name", name).execute()
        
        if result.data and len(result.data) > 0:
            return result.data[0]["id"]
        
        return None
    
    def get_existing_booking(self, apartment_id: str, date_str: str) -> Optional[str]:
        """
        Check if there's an existing booking for a specific apartment and date.
        
        Args:
            apartment_id: Apartment UUID
            date_str: Date string in ISO format
            
        Returns:
            str: Booking UUID or None if not found
        """
        # Use a join query through reservations
        result = self.supabase.rpc(
            "get_booking_for_reservation",
            {"p_apartment_id": apartment_id, "p_date": date_str}
        ).execute()
        
        if result.data and len(result.data) > 0:
            return result.data[0]["booking_id"]
        
        return None
    
    def create_booking(self, apartment_id: str, guest_id: Optional[str], reservation_date: str,
                      rate: float, cleaning_fee: float, payment_source_id: Optional[str], comment: Optional[str]) -> str:
        """
        Create a new booking.
        
        Args:
            apartment_id: Apartment UUID
            guest_id: Guest UUID (may be None)
            reservation_date: Reservation date in ISO format
            rate: Nightly rate
            cleaning_fee: Cleaning fee
            payment_source_id: Payment source UUID (may be None)
            comment: Booking notes
            
        Returns:
            str: Created booking UUID
        """
        # Parse date
        date_obj = datetime.fromisoformat(reservation_date).date()
        check_out = date_obj.replace(day=date_obj.day + 1).isoformat()
        
        data = {
            "apartment_id": apartment_id,
            "check_in": reservation_date,
            "check_out": check_out,
            "nights": 1,
            "nightly_rate": rate,
            "cleaning_fee": cleaning_fee,
            "total_amount": rate + cleaning_fee,
            "notes": comment
        }
        
        if guest_id:
            data["guest_id"] = guest_id
            
        if payment_source_id:
            data["payment_source_id"] = payment_source_id
            
        response = self.supabase.table("bookings").insert(data).execute()
        return response.data[0]["id"]
    
    def create_or_update_reservation(self, booking_id: str, apartment_id: str, date_str: str,
                                    rate: float, color_hex: Optional[str], comment: Optional[str]):
        """
        Create or update a reservation.
        
        Args:
            booking_id: Booking UUID
            apartment_id: Apartment UUID
            date_str: Date string in ISO format
            rate: Nightly rate
            color_hex: Color hex code (may be None)
            comment: Reservation comment (may be None)
        """
        data = {
            "booking_id": booking_id,
            "apartment_id": apartment_id,
            "date": date_str,
            "rate": rate,
            "comment": comment
        }
        
        if color_hex:
            data["color_hex"] = color_hex
            
        # Use RPC to handle the upsert
        self.supabase.rpc(
            "upsert_reservation",
            {
                "p_booking_id": booking_id,
                "p_apartment_id": apartment_id,
                "p_date": date_str,
                "p_rate": rate,
                "p_color_hex": color_hex,
                "p_comment": comment
            }
        ).execute()
    
    def process_building(self, building_data: Dict):
        """
        Process a building's data.
        
        Args:
            building_data: Building data dictionary
        """
        building_name = building_data.get("name")
        
        if not building_name:
            logger.warning("Building data missing name, skipping")
            return
            
        logger.info(f"Processing building: {building_name}")
        
        # Get or create the building
        building_id = self.get_or_create_building(building_name)
        
        # Process each apartment
        for apartment_data in building_data.get("apartments", []):
            self.process_apartment(building_id, apartment_data)
            
    def process_apartment(self, building_id: str, apartment_data: Dict):
        """
        Process an apartment's data.
        
        Args:
            building_id: Building UUID
            apartment_data: Apartment data dictionary
        """
        apt_code = apartment_data.get("code")
        raw_text = apartment_data.get("raw_text")
        owner_name = apartment_data.get("owner")
        
        if not raw_text:
            logger.warning("Apartment data missing raw_text, skipping")
            return
            
        logger.info(f"Processing apartment: {raw_text}")
        
        # Get or create the owner
        owner_id = self.get_or_create_owner(owner_name) if owner_name else None
        
        # Get or create the apartment
        apartment_id = self.get_or_create_apartment(building_id, apt_code, raw_text, owner_id)
        
        # Process each reservation
        for reservation_data in apartment_data.get("reservations", []):
            self.process_reservation(apartment_id, reservation_data)
    
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
    
    def detect_payment_source(self, comment: Optional[str]) -> Optional[str]:
        """
        Detect payment source from comment.
        
        Args:
            comment: Reservation comment
            
        Returns:
            str: Payment source UUID or None if not detected
        """
        if not comment:
            return None
            
        comment_upper = comment.upper()
        
        if "BOOKING.COM" in comment_upper:
            return self.get_payment_source("Booking.com")
        elif "AIRBNB" in comment_upper:
            return self.get_payment_source("Airbnb")
            
        return None
    
    def process_reservation(self, apartment_id: str, reservation_data: Dict):
        """
        Process a reservation's data.
        
        Args:
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
        guest_id = self.get_or_create_guest(guest_name) if guest_name else None
        
        # Detect payment source
        payment_source_id = self.detect_payment_source(comment)
        
        # Check for existing booking
        existing_booking_id = self.get_existing_booking(apartment_id, date_str)
        
        if existing_booking_id:
            booking_id = existing_booking_id
        else:
            # Create a new booking (default 1-day stay)
            booking_id = self.create_booking(
                apartment_id=apartment_id,
                guest_id=guest_id,
                reservation_date=date_str,
                rate=rate,
                cleaning_fee=35.00,  # Default cleaning fee
                payment_source_id=payment_source_id,
                comment=comment
            )
            
        # Create or update the reservation
        self.create_or_update_reservation(
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
            
        # Create import log
        import_id = self.create_import_log(month, year)
        
        try:
            # Process each building
            for building_data in sheet_data.get("buildings", []):
                self.process_building(building_data)
                
            # Update import log to completed
            self.update_import_log(import_id, "completed")
            
            return import_id
        except Exception as e:
            logger.error(f"Error importing sheet data: {e}")
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
        
        # Create import log
        import_id = self.create_import_log(month, year)
        
        try:
            # Process each sheet
            for sheet in sheets:
                sheet_data = sheet.get("data", {})
                
                # Process each building in the sheet
                for building_data in sheet_data.get("buildings", []):
                    self.process_building(building_data)
            
            # Update import log to completed
            self.update_import_log(import_id, "completed")
            
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


