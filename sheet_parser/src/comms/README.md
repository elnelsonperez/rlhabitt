# Owner Communications Module

This module handles automated communications to apartment owners when there are new bookings for their properties.

## Features

- Automatically tracks new bookings since the last run
- Groups bookings by owner
- Creates pending communications for each owner
- Supports approval workflow before sending
- Handles email sending with retry logic
- Calculates administrative fees and presents financial breakdowns
- Supports custom messages to be included in communications

## Structure

- **infrastructure/** - Database and email sending infrastructure
- **service/** - Business logic for communications
- **scripts/** - CLI entry points
- **templates/** - Email templates (HTML)

## Database Schema

The module uses the following tables:

- `communications` - Main communications table
- `booking_communications` - Junction table linking bookings to communications
- `script_runs` - Track when scripts were last run
- `apartments` - Added admin_fee_percentage field

## Usage

### Queue Communications Script

This script finds new bookings and creates pending communications for owners:

```bash
# Run in production mode
poetry run queue_comms

# Run in dry-run mode (no changes to database)
poetry run queue_comms --dry-run
```

### Send Communications Script

This script sends approved communications to owners:

```bash
# Send all approved communications
poetry run send_comms

# Send in dry-run mode (no actual emails sent)
poetry run send_comms --dry-run

# Send a specific communication by ID
poetry run send_comms --communication-id <UUID>
```

## Environment Variables

The module requires the following environment variables:

- `DATABASE_URL` - PostgreSQL connection string
- `RESEND_API_KEY` - API key for Resend.com email service

## Email Templates

Email templates are stored in the `templates/emails/` directory:

- `new_booking_es.html` - Template for new booking notifications (Spanish)

## Development

To add a new communication type:

1. Add a new entry to the `communication_type` enum in the database
2. Create a new template in `templates/emails/`
3. Extend the `CommunicationsService` with new logic for the communication type