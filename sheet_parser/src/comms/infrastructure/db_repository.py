"""Database repository for communications module."""
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any

from sqlalchemy import (
    MetaData, Column, String, Integer, Boolean,
    ForeignKey, DateTime, Date, select,
    update, and_,  text
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ENUM
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, relationship

Base = declarative_base()
metadata = MetaData()

# Define enum types
communication_status = ENUM(
    'pending', 'approved', 'sent', 'failed',
    name='communication_status'
)

communication_type = ENUM(
    'new_booking',
    name='communication_type'
)

communication_channel = ENUM(
    'email',
    name='communication_channel'
)

# Define SQLAlchemy models
class Communication(Base):
    __tablename__ = 'communications'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    status = Column(communication_status, nullable=False, default='pending')
    comm_type = Column(communication_type, nullable=False)
    channel = Column(communication_channel, nullable=False, default='email')
    owner_id = Column(UUID(as_uuid=True), ForeignKey('owners.id'), nullable=False)
    recipient_email = Column(String, nullable=False)
    retry_count = Column(Integer, nullable=False, default=0)
    last_retry_at = Column(DateTime(timezone=True))
    approved_at = Column(DateTime(timezone=True))
    approved_by = Column(UUID(as_uuid=True), ForeignKey('auth.users.id'))
    subject = Column(String, nullable=False)
    content = Column(String)
    custom_message = Column(String)
    report_period_start = Column(Date)
    report_period_end = Column(Date)
    comm_metadata = Column(JSONB, default={})

    # Relationships
    booking_communications = relationship("BookingCommunication", back_populates="communication")


class BookingCommunication(Base):
    __tablename__ = 'booking_communications'

    communication_id = Column(UUID(as_uuid=True), ForeignKey('communications.id', ondelete='CASCADE'), primary_key=True)
    booking_id = Column(UUID(as_uuid=True), ForeignKey('bookings.id', ondelete='CASCADE'), primary_key=True)
    excluded = Column(Boolean, nullable=False, default=False)

    # Relationships
    communication = relationship("Communication", back_populates="booking_communications")


class ScriptRun(Base):
    __tablename__ = 'script_runs'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    script_name = Column(String, unique=True, nullable=False)
    last_run_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    run_metadata = Column(JSONB, default={})


class CommunicationsRepository:
    """Repository for communication-related database operations."""

    def __init__(self, db_session: Session):
        self.session = db_session

    def get_last_run_time(self, script_name: str) -> datetime:
        """Get the last time a script was run."""
        stmt = select(ScriptRun.last_run_at).where(ScriptRun.script_name == script_name)
        result = self.session.execute(stmt).scalar_one_or_none()
        
        if result is None:
            # Insert a new record if not found
            now = datetime.utcnow()
            script_run = ScriptRun(script_name=script_name, last_run_at=now)
            self.session.add(script_run)
            self.session.commit()
            return now
        
        return result

    def update_last_run_time(self, script_name: str, run_time: Optional[datetime] = None) -> None:
        """Update the last run time for a script."""
        run_time = run_time or datetime.utcnow()
        
        stmt = update(ScriptRun).where(ScriptRun.script_name == script_name).values(last_run_at=run_time)
        self.session.execute(stmt)
        self.session.commit()

    def get_new_bookings(self, since: datetime, buffer_days: int = 1) -> List[Dict]:
        """
        Get bookings created since the specified time with a buffer period.
        Buffer ensures we don't process very recent bookings immediately.
        """
        buffer_cutoff = datetime.utcnow() - timedelta(days=buffer_days)
        
        # Using text to allow for complex joins that might be easier to express in raw SQL
        stmt = text("""
            SELECT 
                b.id, b.check_in, b.check_out, b.total_amount, 
                a.id as apartment_id, a.code as apartment_name, a.admin_fee_percentage,
                o.id as owner_id, o.name as owner_name, o.email as owner_email,
                g.name as guest_name
            FROM bookings b
            JOIN apartments a ON b.apartment_id = a.id
            JOIN owners o ON a.owner_id = o.id
            LEFT JOIN guests g ON b.guest_id = g.id
            WHERE b.created_at > :since
            AND b.created_at < :buffer_cutoff
            AND NOT EXISTS (
                SELECT 1 FROM booking_communications bc
                WHERE bc.booking_id = b.id
            )
            ORDER BY o.id, b.check_in
        """)
        
        result = self.session.execute(stmt, {"since": since, "buffer_cutoff": buffer_cutoff})
        
        # Convert to dictionaries
        bookings = [dict(row._mapping) for row in result]
        return bookings

    def create_communication(self, 
                            owner_id: uuid.UUID, 
                            recipient_email: str, 
                            subject: str,
                            comm_type: str = 'new_booking',
                            report_period_start: Optional[datetime] = None,
                            report_period_end: Optional[datetime] = None,
                            custom_message: Optional[str] = None) -> Communication:
        """Create a new communication record."""
        communication = Communication(
            owner_id=owner_id,
            recipient_email=recipient_email,
            subject=subject,
            comm_type=comm_type,
            report_period_start=report_period_start,
            report_period_end=report_period_end,
            custom_message=custom_message
        )
        
        self.session.add(communication)
        self.session.flush()  # To get the ID while still in transaction
        
        return communication

    def link_bookings_to_communication(self, 
                                       communication_id: uuid.UUID, 
                                       booking_ids: List[uuid.UUID]) -> None:
        """
        Link bookings to a communication.
        
        Note: This method only adds objects to the session but doesn't commit.
        The transaction should be committed at the service level.
        """
        for booking_id in booking_ids:
            booking_comm = BookingCommunication(
                communication_id=communication_id,
                booking_id=booking_id,
                excluded=False
            )
            self.session.add(booking_comm)
        
        # No commit here - handled by calling code

    def get_approved_communications(self) -> List[Communication]:
        """Get all approved communications that haven't been sent."""
        stmt = select(Communication).where(
            and_(
                Communication.status == 'approved',
                Communication.retry_count < 3  # Max 2 retries (0, 1, 2)
            )
        )
        
        return list(self.session.execute(stmt).scalars().all())

    def get_communication_bookings(self, 
                                  communication_id: uuid.UUID, 
                                  excluded: bool = False) -> List[Dict]:
        """Get bookings for a communication, optionally filtering by excluded status."""
        stmt = text("""
            SELECT 
                b.id, b.check_in, b.check_out, b.total_amount, 
                a.id as apartment_id, a.code as apartment_name, a.admin_fee_percentage,
                g.name as guest_name,
                bc.excluded
            FROM booking_communications bc
            JOIN bookings b ON bc.booking_id = b.id
            JOIN apartments a ON b.apartment_id = a.id
            LEFT JOIN guests g ON b.guest_id = g.id
            WHERE bc.communication_id = :comm_id
            AND bc.excluded = :excluded
            ORDER BY b.check_in
        """)
        
        result = self.session.execute(stmt, {"comm_id": communication_id, "excluded": excluded})
        
        # Convert to dictionaries
        bookings = [dict(row._mapping) for row in result]
        return bookings

    def mark_communication_sent(self, communication_id: uuid.UUID) -> None:
        """Mark a communication as sent."""
        stmt = update(Communication).where(
            Communication.id == communication_id
        ).values(
            status='sent'
        )
        
        self.session.execute(stmt)
        self.session.commit()

    def mark_communication_failed(self, communication_id: uuid.UUID) -> None:
        """Mark a communication as failed and increment retry count."""
        stmt = update(Communication).where(
            Communication.id == communication_id
        ).values(
            status='failed',
            retry_count=Communication.retry_count + 1,
            last_retry_at=datetime.utcnow()
        )
        
        self.session.execute(stmt)
        self.session.commit()

    def reset_failed_communication(self, communication_id: uuid.UUID) -> None:
        """Reset a failed communication to approved status for retry."""
        stmt = update(Communication).where(
            Communication.id == communication_id
        ).values(
            status='approved'
        )
        
        self.session.execute(stmt)
        self.session.commit()

    def update_communication_content(self, 
                                    communication_id: uuid.UUID, 
                                    content: str) -> None:
        """Update the content of a communication."""
        stmt = update(Communication).where(
            Communication.id == communication_id
        ).values(
            content=content
        )
        
        self.session.execute(stmt)
        self.session.commit()