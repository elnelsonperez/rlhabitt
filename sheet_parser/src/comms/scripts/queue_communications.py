"""Script to queue communications for new bookings."""
import sys
import os
import argparse
from datetime import datetime, timedelta

import sqlalchemy

from src.logger import get_logger
from src.comms.infrastructure.db_repository import CommunicationsRepository
from src.comms.infrastructure.email_sender import EmailSender
from src.comms.infrastructure.db_connection import get_db_session
from src.comms.service.communications_service import CommunicationsService

logger = get_logger(__name__)

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Queue communications for new bookings")
    parser.add_argument("--dry-run", action="store_true", help="Don't save changes to database")
    return parser.parse_args()

def main():
    """Main entry point for the script."""
    args = parse_args()
    
    session = None
    try:
        # Connect to database
        logger.info("Connecting to database")
        session = get_db_session()
        
        # Initialize repository and service
        repository = CommunicationsRepository(session)
        email_sender = EmailSender()  # Not needed for queueing but required by service
        service = CommunicationsService(repository, email_sender)
        
        if args.dry_run:
            logger.info("DRY RUN: No changes will be saved to the database")
            # Start a transaction that we'll roll back at the end
            session.begin()
        
        # Process new bookings
        logger.info("Processing new bookings")
        comm_count = service.process_new_bookings()
        
        logger.info(f"Created {comm_count} new communications")
        
        if args.dry_run:
            logger.info("DRY RUN: Rolling back all changes")
            session.rollback()
        else:
            logger.info("Committing changes to database")
            session.commit()
        
        logger.info("Finished processing new bookings")
        
    except sqlalchemy.exc.SQLAlchemyError as e:
        logger.error(f"Database error: {str(e)}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Error processing communications: {str(e)}")
        sys.exit(1)
    finally:
        if session:
            session.close()

if __name__ == "__main__":
    main()