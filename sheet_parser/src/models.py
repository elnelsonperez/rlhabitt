"""SQLAlchemy models for the database tables."""
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, Boolean, Float,
    ForeignKey, DateTime, Date, MetaData
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ENUM
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()
metadata = MetaData()

# Define enum types
communication_status = ENUM(
    'pending', 'approved', 'sent', 'failed',
    name='communication_status'
)

communication_type = ENUM(
    'new_booking', 'monthly_report',
    name='communication_type'
)

communication_channel = ENUM(
    'email',
    name='communication_channel'
)

# Building and property management models
class Building(Base):
    __tablename__ = 'buildings'
    __table_args__ = {'extend_existing': True}
    
    id = Column(UUID(as_uuid=True), primary_key=True)
    name = Column(String)
    # Add minimal fields needed

class Owner(Base):
    __tablename__ = 'owners'
    __table_args__ = {'extend_existing': True}
    
    id = Column(UUID(as_uuid=True), primary_key=True)
    name = Column(String)
    email = Column(String)
    # We don't need to define all columns, just the ones we reference
    
    # Relationships
    apartments = relationship("Apartment", back_populates="owner")

class Apartment(Base):
    __tablename__ = 'apartments'
    __table_args__ = {'extend_existing': True}
    
    id = Column(UUID(as_uuid=True), primary_key=True)
    building_id = Column(UUID(as_uuid=True), ForeignKey('buildings.id'))
    owner_id = Column(UUID(as_uuid=True), ForeignKey('owners.id'))
    code = Column(String)
    admin_fee_percentage = Column(Float, nullable=False, default=25.0)
    
    # Relationships
    owner = relationship("Owner", back_populates="apartments")
    bookings = relationship("Booking", back_populates="apartment")

# Booking models
class Guest(Base):
    __tablename__ = 'guests'
    __table_args__ = {'extend_existing': True}
    
    id = Column(UUID(as_uuid=True), primary_key=True)
    name = Column(String)

class Booking(Base):
    __tablename__ = 'bookings'
    __table_args__ = {'extend_existing': True}
    
    id = Column(UUID(as_uuid=True), primary_key=True)
    check_in = Column(Date, nullable=False)
    check_out = Column(Date, nullable=False)
    apartment_id = Column(UUID(as_uuid=True), ForeignKey('apartments.id'))
    guest_id = Column(UUID(as_uuid=True), ForeignKey('guests.id'))
    total_amount = Column(Float)
    created_at = Column(DateTime(timezone=True))
    
    # Relationships
    apartment = relationship("Apartment", back_populates="bookings")
    guest = relationship("Guest")
    booking_communications = relationship("BookingCommunication", back_populates="booking")

# Auth model - public mirror of auth.users
class PublicUser(Base):
    __tablename__ = 'public_users'
    __table_args__ = {'extend_existing': True}
    
    id = Column(UUID(as_uuid=True), primary_key=True)
    email = Column(String, nullable=False)
    # We don't need to define other fields for this reference model

# Communications models
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
    approved_by = Column(UUID(as_uuid=True), ForeignKey('public_users.id'))
    subject = Column(String, nullable=False)
    content = Column(String)
    custom_message = Column(String)
    report_period_start = Column(Date)
    report_period_end = Column(Date)
    comm_metadata = Column(JSONB, default={})
    
    # Relationships
    owner = relationship("Owner", foreign_keys=[owner_id])
    approver = relationship("PublicUser", foreign_keys=[approved_by])
    booking_communications = relationship("BookingCommunication", back_populates="communication")

class BookingCommunication(Base):
    __tablename__ = 'booking_communications'
    
    communication_id = Column(UUID(as_uuid=True), ForeignKey('communications.id', ondelete='CASCADE'), primary_key=True)
    booking_id = Column(UUID(as_uuid=True), ForeignKey('bookings.id', ondelete='CASCADE'), primary_key=True)
    excluded = Column(Boolean, nullable=False, default=False)
    
    # Relationships
    communication = relationship("Communication", back_populates="booking_communications")
    booking = relationship("Booking", back_populates="booking_communications")

class ScriptRun(Base):
    __tablename__ = 'script_runs'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    script_name = Column(String, unique=True, nullable=False)
    last_run_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    run_metadata = Column(JSONB, default={})