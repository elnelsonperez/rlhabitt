# RL HABITT Monorepo

This monorepo contains all components of the RL HABITT system, organized into separate modules.

## Project Structure

- `sheet_parser/` - Backend service that handles downloading and parsing Excel files
  - Python-based API and CLI for processing reservation sheets
  - Download files from OneDrive
  - Parse data into JSON format
  - Provide REST API endpoints

- `app/` - Frontend web application (React)
  - User interface for viewing and managing reservations
  - Connect to the sheet_parser API

## Getting Started

### Setting up the Sheet Parser

```bash
# Navigate to the sheet_parser directory
cd sheet_parser

# Install dependencies
poetry install

# Run the API
poetry run python -m src.main api
```

### Using the API

The sheet_parser provides a REST API for accessing reservation data:

```bash
# Get reservations for the current month
curl -u username:password "http://localhost:5000/api/reservations?file_id=YOUR_FILE_ID"

# Get reservations for the last 3 months
curl -u username:password "http://localhost:5000/api/reservations?file_id=YOUR_FILE_ID&months=3"
```

See the sheet_parser README for complete documentation of all available options.

## Development

Each component has its own development workflow and requirements. Refer to the README in each directory for specific instructions.