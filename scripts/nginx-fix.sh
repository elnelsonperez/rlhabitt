#!/bin/bash
# Script to fix NGINX 301 redirect issues
# Usage: ./nginx-fix.sh [server-name]

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored message
function echo_color() {
  echo -e "${2}${1}${NC}"
}

# Check arguments
if [ $# -lt 1 ]; then
  echo_color "Usage: $0 [server-name]" "$RED"
  echo_color "Example: $0 example.com" "$YELLOW"
  exit 1
fi

SERVER_NAME=$1

# Check if NGINX is installed
if ! command -v nginx &> /dev/null; then
  echo_color "NGINX is not installed. Please install it first." "$RED"
  exit 1
fi

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo_color "This script must be run as root or with sudo privileges." "$RED"
  exit 1
fi

echo_color "Checking NGINX configuration for $SERVER_NAME..." "$BLUE"

# Verify the site configuration exists
if [ ! -f "/etc/nginx/sites-available/rlhabitt" ]; then
  echo_color "NGINX configuration for rlhabitt not found!" "$RED"
  exit 1
fi

# Backup the original config
BACKUP_FILE="/etc/nginx/sites-available/rlhabitt.backup-$(date +%Y%m%d%H%M%S)"
echo_color "Creating backup at $BACKUP_FILE..." "$BLUE"
cp /etc/nginx/sites-available/rlhabitt "$BACKUP_FILE"

# Create new configuration file that handles both HTTP and HTTPS without forced redirect
echo_color "Creating new NGINX configuration for $SERVER_NAME..." "$BLUE"

cat > /etc/nginx/sites-available/rlhabitt << EOF
server {
    listen 80;
    listen [::]:80;
    server_name $SERVER_NAME;

    # API endpoint - don't redirect to HTTPS
    location /api/ {
        proxy_pass http://localhost:5052;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # For all other paths, redirect to HTTPS
    location / {
        # Optional: remove this if you don't want any redirects
        return 301 https://\$server_name\$request_uri;
    }
}

# HTTPS server block (this might already exist from Certbot)
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name $SERVER_NAME;

    # SSL configuration (these paths may vary depending on your setup)
    ssl_certificate /etc/letsencrypt/live/$SERVER_NAME/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$SERVER_NAME/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://localhost:5052;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Test the NGINX configuration
echo_color "Testing NGINX configuration..." "$BLUE"
nginx -t

if [ $? -eq 0 ]; then
  echo_color "NGINX configuration is valid. Reloading NGINX..." "$GREEN"
  systemctl reload nginx
  echo_color "NGINX configuration updated successfully!" "$GREEN"
  echo_color "HTTP API traffic will now be served directly without redirecting to HTTPS." "$GREEN"
else
  echo_color "NGINX configuration test failed. Restoring backup..." "$RED"
  cp "$BACKUP_FILE" /etc/nginx/sites-available/rlhabitt
  nginx -t && systemctl reload nginx
  echo_color "Original configuration restored." "$YELLOW"
  echo_color "Please check your SSL certificate paths and other settings." "$YELLOW"
  exit 1
fi

# If we want to check if the redirect is gone
echo_color "Testing HTTP API access..." "$BLUE"
echo_color "You can test with: curl -I -H 'Host: $SERVER_NAME' http://localhost/api/" "$YELLOW"
echo_color "The response should NOT include 'Location:' header with a redirect to HTTPS." "$YELLOW"