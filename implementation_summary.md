# Owner Communications System Implementation

## Overview

The Owner Communications System is a feature that automatically notifies property owners when new bookings are made for their properties. The system follows a two-step workflow:

1. **Queue Communications**: Identifies new bookings and creates pending communications
2. **Send Communications**: Sends approved communications to owners

## What We've Implemented

### Database Changes

- Added `admin_fee_percentage` to apartments table (default 25%)
- Created new tables:
  - `communications` - Main table to track communications
  - `booking_communications` - Junction table for bookings in a communication
  - `script_runs` - Track when scripts were last run

### Backend Modules

#### Infrastructure Layer
- `db_repository.py` - SQLAlchemy models and database operations
- `email_sender.py` - Email sending using Resend API

#### Service Layer
- `communications_service.py` - Business logic for communications

#### Scripts
- `queue_communications.py` - Finds new bookings and creates communications
- `send_communications.py` - Sends approved communications

#### Templates
- `new_booking_es.html` - Spanish email template for new bookings

### Features Implemented

- **New Booking Detection**: Identifies bookings created since last run with 1-day buffer
- **Owner Grouping**: Groups bookings by owner for consolidated communications
- **Approval Workflow**: Communications are created in pending status requiring approval
- **Administration Fee Display**: Shows breakdown of fees and earnings for owners
- **Retry Logic**: Failed communications can be retried up to 2 times
- **CLI Tools**: Scripts that can be run manually or scheduled
- **Dry-Run Mode**: Test scripts without making permanent changes
- **Error Handling**: Comprehensive logging and error management

## How It Works

1. The queue script runs periodically (e.g., every 6 hours)
2. It finds new bookings since the last run (with 1-day buffer)
3. It groups bookings by owner and creates communications
4. An admin approves communications (future UI feature)
5. The send script runs periodically (e.g., every hour)
6. It sends emails for approved communications via Resend
7. Email shows booking details and financial breakdown

## Financial Calculations

For each booking:
- **Gross Amount**: The total booking amount
- **Admin Fee**: Calculated as a percentage of the gross amount
- **Owner Earnings**: Gross amount minus admin fee

## Next Steps

1. **Admin UI**: Create interface for approving communications
2. **Additional Templates**: Add more communication types
3. **Communication Analytics**: Track open rates and responses
4. **Additional Channels**: Support for SMS or other communication channels
5. **Localization**: Support for additional languages

## Usage

```bash
# Queue new communications
poetry run queue_comms

# Send approved communications
poetry run send_comms

# Run in dry-run mode (no changes)
poetry run queue_comms --dry-run
poetry run send_comms --dry-run
```