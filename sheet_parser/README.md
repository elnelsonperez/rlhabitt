# Sheet Parser

A Python utility package that integrates:
1. OneDrive downloader for shared files using device-based authentication
2. Parser for condo rental Excel sheets that extracts reservation information to JSON

## Installation

```bash
# Navigate to the sheet_parser directory
cd sheet_parser

# Install using Poetry
poetry install

# Activate the virtual environment
poetry shell
```

## Configuration

Create a `.env` file in the sheet_parser directory:

```bash
# Copy the example file
cp .env.example .env

# Edit with your actual client ID
nano .env  # or your favorite editor
```

Or set the environment variable directly:

```bash
export ONEDRIVE_CLIENT_ID="your-client-id-here"
```

## Usage

The tool can be run in two modes:
1. CLI mode - as a command-line utility
2. API mode - as a REST API server

### Command Line (CLI Mode)

The package provides a CLI tool that can download an Excel file from OneDrive and parse it into JSON:

```bash
# Download file from OneDrive and parse it (full workflow)
# (Automatically finds the sheet for the current month)
python -m sheet_parser.src.__main__ "2124047165A6F26!493036" -o reservations.json --pretty

# Specify a specific sheet to parse
python -m sheet_parser.src.__main__ "2124047165A6F26!493036" -s "Feb. 2025" -o reservations.json

# Process all sheets with valid month names
python -m sheet_parser.src.__main__ "2124047165A6F26!493036" --all -o all_months.json --pretty

# Process sheets for the last N months (including current month)
python -m sheet_parser.src.__main__ "2124047165A6F26!493036" --months 3 -o recent_months.json --pretty

# Save the Excel file and parse it
python -m sheet_parser.src.__main__ "2124047165A6F26!493036" --excel-output data/rental_data.xlsx -o reservations.json

# Download only (don't parse)
python -m sheet_parser.src.__main__ "2124047165A6F26!493036" --excel-output data/rental_data.xlsx --download-only

# Parse only (use existing Excel file)
python -m sheet_parser.src.__main__ "anything" --parse-only --excel-output data/rental_data.xlsx -o reservations.json

# Enable verbose output for debugging
python -m sheet_parser.src.__main__ "2124047165A6F26!493036" -v
```

### As a Library

#### Download a File from OneDrive

```python
from sheet_parser.src.downloader import OneDriveDownloader

# Download a file using its OneDrive ID
downloader = OneDriveDownloader()
file_path = downloader.download_file("2124047165A6F26!493036")

# Download a file and specify the output path
file_path = downloader.download_file("2124047165A6F26!493036", "data/file.xlsx")

# Enable verbose output for debugging
downloader = OneDriveDownloader(verbose=True)
file_path = downloader.download_file("2124047165A6F26!493036")
```

#### Parse an Excel File

```python
from sheet_parser.src.xlsx_parser import CondoRentalParser

# Initialize the parser
parser = CondoRentalParser("data/spreadsheet.xlsx")
parser.load_workbook()

# Get available sheets
sheets = parser.get_sheet_names()
print(f"Available sheets: {sheets}")

# Parse a sheet
data = parser.parse_sheet(sheets[0])

# Process the parsed data
for building in data["buildings"]:
    print(f"Building: {building['name']}")
    for apartment in building["apartments"]:
        print(f"  Apartment: {apartment['code']} - Owner: {apartment['owner']}")
        for reservation in apartment["reservations"]:
            print(f"    Reservation on {reservation['date']}: Rate = {reservation['rate']}")
```

## Authentication

The OneDrive downloader uses MSAL (Microsoft Authentication Library) for device-based authentication. It will:

1. Try to retrieve a cached token from `~/.onedrive_token_cache.json`
2. If no valid token is found, initiate device code flow authentication
3. Display instructions for authenticating in your browser
4. Cache the obtained token for future use

## Excel Parser

The Excel parser can extract rental data from condo management spreadsheets with the following structure:

- Sheet names follow the format "[Month]. [Year]" (e.g., "Abr. 2025")
- The tool automatically finds the sheet for the current month if none is specified
- With the `--all` option, it processes all sheets with valid month names at once
- With the `--months` option, it processes sheets for the specified number of months
- Calendar headers in rows 4-5, with Spanish weekday abbreviations and dates
- Multiple building tables with apartment information and reservation data
- Each cell can contain rental rates and comments with additional metadata

The parser identifies specific buildings for special handling:
- "LIMPIEZAS EXTERNAS" buildings are excluded entirely
- In "OTROS APARTAMENTOS" buildings, the apartment code is None and owner is the full cell text

### REST API Mode

The tool can also be run as a REST API server.

### Development Mode

Use these commands during development:

```bash
# Start the API server with default settings
python -m sheet_parser.src.api_server

# Specify host and port
python -m sheet_parser.src.api_server --host 127.0.0.1 --port 8080

# Run in debug mode
python -m sheet_parser.src.api_server --debug
```

### Production Mode

For production deployment (e.g., on DigitalOcean App Platform):

```bash
# Install gunicorn if not already installed
poetry add gunicorn

# Run using gunicorn
gunicorn wsgi:app

# With specific host and port
gunicorn wsgi:app --bind 0.0.0.0:8080

# With multiple workers (a good rule is 2-4 workers per CPU core)
gunicorn wsgi:app --workers 4
```

The project includes a `Procfile` for platforms like DigitalOcean App Platform or Heroku:
```
web: gunicorn wsgi:app
```

#### API Authentication

The API uses HTTP Basic Authentication. Set the following environment variables in your `.env` file:

```
API_USERNAME=your_username
API_PASSWORD=your_password
API_HOST=0.0.0.0
API_PORT=5000
API_CACHE_DIR=/path/to/cache  # Optional
API_CACHE_EXPIRE_TIME=3600    # Cache expiration in seconds, default is 1 hour
```

#### API Endpoints

##### GET /health
Health check endpoint that returns the server status.

No authentication required.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-04-01T12:34:56.789012"
}
```

##### GET /api/reservations
Get reservation data from a OneDrive Excel file.

Requires Basic Authentication.

**Query Parameters:**
- `file_id` (required): OneDrive file ID in the format 'driveId!itemId'
- `months` (optional): Number of months to look back (including current month)
- `refresh` (optional): If set to 'true', forces a fresh download of the file
- `pretty` (optional): If set to 'true', formats the JSON response

**Example Requests:**
```bash
# Get reservations for current month
curl -u username:password "http://localhost:5000/api/reservations?file_id=2124047165A6F26!493036"

# Get reservations for the last 3 months
curl -u username:password "http://localhost:5000/api/reservations?file_id=2124047165A6F26!493036&months=3"

# Force refresh and format the response
curl -u username:password "http://localhost:5000/api/reservations?file_id=2124047165A6F26!493036&refresh=true&pretty=true"
```

**Response:**
The response format matches the JSON output from the CLI version, containing all reservation data.

## Features

- Downloads shared OneDrive files using the Microsoft Graph API
- Parses file IDs to extract drive ID and item ID
- Caches authentication tokens to avoid repeated logins
- Parses condo rental Excel sheets with reservation information into JSON
- Integrates downloading and parsing in a unified workflow
- Handles special building types with custom parsing rules
- Preserves raw cell text alongside parsed values
- Includes standard and verbose logging modes for debugging
- REST API mode with caching for efficient operation
- Support for looking back a specific number of months
- Automatically selects the current month's sheet by default