#!/bin/bash
# Deployment script for RL HABITT Backend on Ubuntu droplet
# Usage: ./deploy.sh

# Exit on any command failure
set -e

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

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo_color "This script must be run as root or with sudo privileges." "$RED"
  exit 1
fi

echo_color "Starting RL HABITT Backend deployment..." "$GREEN"

# Check for required environment variables
echo_color "Checking environment variables..." "$BLUE"
REQUIRED_VARS=(
  "SUPABASE_URL"
  "SUPABASE_KEY"
  "API_USERNAME"
  "API_PASSWORD"
  "ONEDRIVE_FILE_ID"
  "TENANT_ID"
  "CLIENT_ID"
  "CLIENT_SECRET"
)

MISSING_VARS=0
for VAR in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!VAR}" ]; then
    echo_color "$VAR is not set!" "$RED"
    MISSING_VARS=1
  fi
done

if [ $MISSING_VARS -eq 1 ]; then
  echo_color "Please set all required environment variables before running this script." "$RED"
  echo_color "You can create a .env file with these variables and source it before running:" "$YELLOW"
  echo ""
  echo "SUPABASE_URL=your-supabase-url"
  echo "SUPABASE_KEY=your-supabase-key"
  echo "API_USERNAME=your-api-username"
  echo "API_PASSWORD=your-api-password"
  echo "ONEDRIVE_FILE_ID=your-onedrive-file-id"
  echo "TENANT_ID=your-azure-tenant-id"
  echo "CLIENT_ID=your-azure-client-id"
  echo "CLIENT_SECRET=your-azure-client-secret"
  echo ""
  exit 1
fi

# Update system packages
echo_color "Updating system packages..." "$BLUE"
apt-get update && apt-get upgrade -y

# Install dependencies
echo_color "Installing dependencies..." "$BLUE"
apt-get install -y \
  apt-transport-https \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  git \
  ufw

# Add Docker's official GPG key
echo_color "Setting up Docker repository..." "$BLUE"
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Set up the stable repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
echo_color "Installing Docker..." "$BLUE"
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io

# Install Docker Compose
echo_color "Installing Docker Compose..." "$BLUE"
curl -L "https://github.com/docker/compose/releases/download/v2.12.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create deployment directory
DEPLOY_DIR="/opt/rlhabitt"
echo_color "Creating deployment directory at $DEPLOY_DIR..." "$BLUE"
mkdir -p $DEPLOY_DIR
cd $DEPLOY_DIR

# Create .env file
echo_color "Creating .env file..." "$BLUE"
cat > .env << EOF
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_KEY=${SUPABASE_KEY}
API_USERNAME=${API_USERNAME}
API_PASSWORD=${API_PASSWORD}
ONEDRIVE_FILE_ID=${ONEDRIVE_FILE_ID}
TENANT_ID=${TENANT_ID}
CLIENT_ID=${CLIENT_ID}
CLIENT_SECRET=${CLIENT_SECRET}
EOF

# Clone repository
echo_color "Cloning repository..." "$BLUE"
if [ -d "sheet_parser" ]; then
  # If the directory exists, pull the latest changes
  cd sheet_parser
  git pull
  cd ..
else
  # Otherwise, clone the repository
  # Note: Replace with your actual repository URL
  git clone https://github.com/elnelsonperez/rlhabitt .
fi

# Configure firewall
echo_color "Configuring firewall..." "$BLUE"
ufw allow 22/tcp  # SSH
ufw allow 80/tcp  # HTTP
ufw allow 443/tcp # HTTPS
ufw allow 5052/tcp # API port
ufw --force enable

# Build and start the Docker containers
echo_color "Building and starting Docker containers..." "$BLUE"
docker-compose build
docker-compose up -d

# Check if services are running
echo_color "Checking service status..." "$BLUE"
if docker-compose ps | grep -q "Up"; then
  echo_color "Deployment successful! Services are running." "$GREEN"
  
  # Get the public IP
  PUBLIC_IP=$(curl -s https://api.ipify.org)
  
  echo_color "API is available at: http://$PUBLIC_IP:5052" "$GREEN"
  echo_color "Check the logs with: docker-compose logs" "$YELLOW"
  echo_color "The import job is scheduled to run daily at 2:00 AM UTC" "$YELLOW"
else
  echo_color "Deployment may have failed. Check the logs with: docker-compose logs" "$RED"
fi

# Add NGINX for production (optional)
if [ "$SETUP_NGINX" = "true" ]; then
  echo_color "Setting up NGINX as a reverse proxy..." "$BLUE"
  apt-get install -y nginx certbot python3-certbot-nginx
  
  # Configure NGINX
  cat > /etc/nginx/sites-available/rlhabitt << EOF
server {
    listen 80;
    server_name ${DOMAIN_NAME};

    location / {
        proxy_pass http://localhost:5052;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

  # Enable the site
  ln -sf /etc/nginx/sites-available/rlhabitt /etc/nginx/sites-enabled/
  
  # Test and reload NGINX
  nginx -t && systemctl reload nginx
  
  # Set up SSL if domain is provided
  if [ -n "$DOMAIN_NAME" ]; then
    echo_color "Setting up SSL with Let's Encrypt for $DOMAIN_NAME..." "$BLUE"
    certbot --nginx -d $DOMAIN_NAME --non-interactive --agree-tos -m $EMAIL
  fi
fi

echo_color "Deployment completed!" "$GREEN"