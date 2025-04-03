"""Database connection management for communications module."""
import os
from typing import Optional

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from src.logger import get_logger

logger = get_logger(__name__)

def get_db_session(db_url: Optional[str] = None) -> Session:
    """
    Create and return a SQLAlchemy session.
    
    Args:
        db_url: Database connection URL. If not provided, uses DATABASE_URL environment variable.
        
    Returns:
        SQLAlchemy Session object
        
    Raises:
        ValueError: If no database URL is provided and DATABASE_URL environment variable is not set.
    """
    # Get database URL from environment if not provided
    db_url = db_url or os.environ.get("DATABASE_URL")
    if not db_url:
        logger.error("No database URL provided and DATABASE_URL environment variable not set")
        raise ValueError("Database URL is required. Set DATABASE_URL environment variable or provide db_url parameter.")
    
    # Create engine and session
    logger.debug("Creating database engine and session")
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    return session