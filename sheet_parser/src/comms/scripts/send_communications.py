"""Script to send approved communications."""
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
    parser = argparse.ArgumentParser(description="Send approved communications")
    parser.add_argument("--dry-run", action="store_true", help="Don't actually send emails or update database")
    parser.add_argument("--communication-id", help="Send specific communication instead of all approved ones")
    return parser.parse_args()

def main():
    """Main entry point for the script."""
    args = parse_args()
    
    # Get Resend API key from environment
    resend_api_key = os.environ.get("RESEND_API_KEY")
    
    if not resend_api_key and not args.dry_run:
        logger.error("RESEND_API_KEY environment variable not set and not in dry-run mode")
        sys.exit(1)
    
    session = None
    try:
        # Connect to database
        logger.info("Connecting to database")
        session = get_db_session()
        
        # Initialize repository and service
        repository = CommunicationsRepository(session)
        email_sender = EmailSender(resend_api_key)
        service = CommunicationsService(repository, email_sender)
        
        if args.dry_run:
            logger.info("DRY RUN: No emails will be sent and no changes will be saved to the database")
            # Start a transaction that we'll roll back at the end
            session.begin()
        
        if args.communication_id:
            # Send a specific communication
            logger.info(f"Sending specific communication: {args.communication_id}")
            success, message = service.send_communication(args.communication_id)
            if success:
                logger.info(f"Successfully sent communication {args.communication_id}")
                if args.dry_run:
                    logger.info("DRY RUN: Would have marked communication as sent")
            else:
                logger.error(f"Failed to send communication {args.communication_id}: {message}")
        else:
            # Process all approved communications
            logger.info("Processing all approved communications")
            success_count, failure_count = service.process_approved_communications()
            
            logger.info(f"Processed {success_count + failure_count} communications")
            logger.info(f"Successfully sent: {success_count}")
            logger.info(f"Failed to send: {failure_count}")
        
        if args.dry_run:
            logger.info("DRY RUN: Rolling back all changes")
            session.rollback()
        else:
            logger.info("Committing changes to database")
            session.commit()
        
        logger.info("Finished processing communications")
        
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