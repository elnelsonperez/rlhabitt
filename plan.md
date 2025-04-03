# Implementation Plan: Owner Communications System

## Database Changes

### New Table: `communications`
- `id`: UUID, primary key
- `created_at`: Timestamp, when the communication was created
- `status`: Enum (pending/approved/sent/failed)
- `comm_type`: Enum (initially 'new_booking')
- `channel`: Enum (initially 'email')
- `owner_id`: FK to owners table
- `recipient_email`: String, recipient's email
- `retry_count`: Integer, number of retries (default 0, max 2)
- `last_retry_at`: Timestamp, last retry attempt
- `approved_at`: Timestamp, when approved
- `approved_by`: ID of approving user
- `subject`: String, email subject
- `content`: Text, email content
- `custom_message`: Text, additional personalized message
- `report_period_start`: Date, start of reporting period
- `report_period_end`: Date, end of reporting period
- `metadata`: JSONB, for additional information

### New Junction Table: `booking_communications`
- `communication_id`: FK to communications
- `booking_id`: FK to bookings
- `excluded`: Boolean, if booking was excluded
- Composite primary key: (communication_id, booking_id)

### Modification to `apartments` Table
- Add `admin_fee_percentage`: Decimal, administrative fee percentage (default 25%)

## Software Architecture

### Layers
1. **Domain Layer** (Business Logic)
   - `communications_service.py`: Communication logic
   - `booking_service.py`: Booking-related logic
   - `templates_service.py`: Email template handling

2. **Infrastructure Layer**
   - `db_repository.py`: Database access with SQLAlchemy
   - `email_sender.py`: Integration with Resend.com API
   - `get_logger.py`: Existing function for logging

3. **Entry Scripts**
   - `queue_communications.py`: Script to queue communications
   - `send_communications.py`: Script to send communications

### Email Templates
- Location: `/templates/emails/`
- Files:
  - `new_booking_es.html`: Template for new bookings (Spanish)
  - `header.html`, `footer.html`: Reusable components

## Detailed Specifications

### Communications Service (`communications_service.py`)
- `find_new_bookings(last_run_date)`: Finds new bookings with 1-day buffer
- `group_bookings_by_owner(bookings)`: Groups bookings by owner
- `create_communication(owner, bookings, comm_type)`: Creates pending communication
- `calculate_admin_fees(bookings)`: Calculates admin fees
- `get_approved_communications()`: Gets approved communications
- `mark_as_sent(communication_id)`: Marks as sent
- `increment_retry(communication_id)`: Increments retry counter

### Queue Script (`queue_communications.py`)
1. Logs execution time
2. Gets last execution date
3. Finds new bookings (with 1-day buffer)
4. Groups by owner
5. For each owner:
   - Creates pending communication
   - Associates bookings with communication
6. Saves new last execution date

### Sending Script (`send_communications.py`)
1. Finds approved communications
2. For each communication:
   - Gets non-excluded bookings
   - Calculates financial breakdown (gross, admin fee, net)
   - Generates email content using template
   - Sends via Resend API
   - If fails and retry_count < 2:
     - Increments retry_count
     - Updates last_retry_at
   - If success:
     - Marks as sent

### Email Format for New Bookings
- Subject: "New bookings for your property" (in Spanish)
- Personalized greeting to owner
- Introductory message indicating the reporting period
- Custom message (if exists)
- Bookings table with:
  - Check-in date
  - Check-out date
  - Total amount (gross)
  - Administrative fee (percentage and amount)
  - Net amount for owner
- Total financial summary
- Footer with contact information

## Technical Details

### Resend.com Integration
- Use resend-python library
- Configure API key in environment variables
- Implement error handling and retries

### SQLAlchemy
- Define models for new tables
- Use sessions for transactions
- Implement efficient queries

### Logging
- Use existing get_logger function
- Log key events:
  - Communication creation
  - Approvals
  - Sends (successes and failures)
  - Retries

## User Workflow

1. Queue script runs periodically (e.g., every 6 hours)
2. Admins view pending communications in interface (future)
3. Admins approve and possibly exclude some bookings
4. Sending script runs periodically (e.g., every hour)
5. Approved communications are sent to owners
6. If they fail, they will be retried up to 2 times