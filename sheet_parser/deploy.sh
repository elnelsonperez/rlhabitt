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
  "ONEDRIVE_CLIENT_ID"
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
  echo "ONEDRIVE_CLIENT_ID=your-onedrive-client-id"
  echo ""
  exit 1
fi

# Update system packages
echo_color "Updating system packages..." "$BLUE"
apt-get update && apt-get upgrade -y

# Install dependencies
echo_color "Checking and installing dependencies..." "$BLUE"

# Check if dependencies are already installed
MISSING_DEPS=()
for pkg in apt-transport-https ca-certificates curl gnupg lsb-release git ufw; do
  if ! dpkg -l | grep -q "^ii  $pkg "; then
    MISSING_DEPS+=($pkg)
  fi
done

# Install missing dependencies if any
if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
  echo_color "Installing missing dependencies: ${MISSING_DEPS[*]}" "$BLUE"
  apt-get install -y ${MISSING_DEPS[*]}
else
  echo_color "All dependencies are already installed." "$GREEN"
fi

# Check if Docker is already installed
if command -v docker &> /dev/null && systemctl is-active --quiet docker; then
  echo_color "Docker is already installed and running." "$GREEN"
else
  echo_color "Installing Docker..." "$BLUE"
  
  # Check if Docker repository is already configured
  if [ ! -f /etc/apt/sources.list.d/docker.list ]; then
    # Add Docker's official GPG key
    echo_color "Setting up Docker repository..." "$BLUE"
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Set up the stable repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Update package lists after adding new repository
    apt-get update
  fi
  
  # Install Docker Engine
  apt-get install -y docker-ce docker-ce-cli containerd.io
  systemctl enable docker
  systemctl start docker
fi

# Check if Docker Compose is already installed
if command -v docker-compose &> /dev/null; then
  CURRENT_VERSION=$(docker-compose --version | sed 's/.*version \([0-9.]*\).*/\1/' | grep -o '^[0-9.]*')
  REQUIRED_VERSION="2.12.2"
  
  if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$CURRENT_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
    echo_color "Docker Compose $CURRENT_VERSION is already installed." "$GREEN"
  else
    echo_color "Updating Docker Compose from $CURRENT_VERSION to $REQUIRED_VERSION..." "$BLUE"
    curl -L "https://github.com/docker/compose/releases/download/v$REQUIRED_VERSION/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
  fi
else
  echo_color "Installing Docker Compose..." "$BLUE"
  curl -L "https://github.com/docker/compose/releases/download/v2.12.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  chmod +x /usr/local/bin/docker-compose
fi

# Create deployment directory
DEPLOY_DIR="/opt/rlhabitt"
echo_color "Checking deployment directory at $DEPLOY_DIR..." "$BLUE"
if [ ! -d "$DEPLOY_DIR" ]; then
  echo_color "Creating deployment directory..." "$BLUE"
  mkdir -p $DEPLOY_DIR
else
  echo_color "Deployment directory already exists." "$GREEN"
fi

cd $DEPLOY_DIR

# Clone or pull from repository
if [ -d "sheet_parser" ]; then
  echo_color "Repository already exists, updating..." "$BLUE"
  cd sheet_parser
  git config --global --add safe.directory "$(pwd)"
  git pull
  cd ..
else
  echo_color "Cloning repository..." "$BLUE"
  # Clone the repository from your GitHub/GitLab
  git clone https://github.com/elnelsonperez/rlhabitt .
fi

# Create or update .env file
echo_color "Creating/updating .env file..." "$BLUE"
cat > .env << EOF
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_KEY=${SUPABASE_KEY}
API_USERNAME=${API_USERNAME}
API_PASSWORD=${API_PASSWORD}
ONEDRIVE_FILE_ID=${ONEDRIVE_FILE_ID}
ONEDRIVE_CLIENT_ID=${ONEDRIVE_CLIENT_ID}
EOF


# Configure firewall if UFW is active
echo_color "Configuring firewall..." "$BLUE"
if systemctl is-active --quiet ufw; then
  echo_color "UFW is active, checking rules..." "$BLUE"
  
  # Add rules only if they don't exist
  if ! ufw status | grep -q "22/tcp"; then
    echo_color "Adding SSH rule..." "$BLUE"
    ufw allow 22/tcp  # SSH
  fi
  
  if ! ufw status | grep -q "80/tcp"; then
    echo_color "Adding HTTP rule..." "$BLUE"
    ufw allow 80/tcp  # HTTP
  fi
  
  if ! ufw status | grep -q "443/tcp"; then
    echo_color "Adding HTTPS rule..." "$BLUE"
    ufw allow 443/tcp # HTTPS
  fi
  
  if ! ufw status | grep -q "5052/tcp"; then
    echo_color "Adding API port rule..." "$BLUE"
    ufw allow 5052/tcp # API port
  fi
  
  echo_color "Firewall rules updated." "$GREEN"
else
  echo_color "Enabling UFW with required rules..." "$BLUE"
  ufw allow 22/tcp  # SSH
  ufw allow 80/tcp  # HTTP
  ufw allow 443/tcp # HTTPS
  ufw allow 5052/tcp # API port
  ufw --force enable
fi

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
  # Check if NGINX is installed
  if ! command -v nginx &> /dev/null; then
    echo_color "Installing NGINX and Certbot..." "$BLUE"
    apt-get install -y nginx certbot python3-certbot-nginx
  else
    echo_color "NGINX is already installed." "$GREEN"
  fi
  
  # Check if the NGINX configuration already exists
  if [ ! -f "/etc/nginx/sites-available/rlhabitt" ] || [ "$FORCE_NGINX_CONFIG" = "true" ]; then
    echo_color "Creating NGINX configuration..." "$BLUE"
    
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

    # Enable the site if not already enabled
    if [ ! -f "/etc/nginx/sites-enabled/rlhabitt" ]; then
      echo_color "Enabling NGINX site..." "$BLUE"
      ln -sf /etc/nginx/sites-available/rlhabitt /etc/nginx/sites-enabled/
    fi
    
    # Test and reload NGINX
    if nginx -t; then
      echo_color "NGINX configuration is valid, reloading..." "$GREEN"
      systemctl reload nginx
    else
      echo_color "NGINX configuration test failed, please check the configuration." "$RED"
      exit 1
    fi
  else
    echo_color "NGINX configuration already exists." "$GREEN"
  fi
  
  # Set up SSL if domain is provided and not already configured
  if [ -n "$DOMAIN_NAME" ] && [ "$FORCE_SSL" = "true" ] || ! grep -q "ssl_certificate" "/etc/nginx/sites-available/rlhabitt"; then
    if [ -z "$EMAIL" ]; then
      echo_color "EMAIL environment variable is required for SSL setup." "$RED"
      echo_color "Please set the EMAIL variable and try again, or set FORCE_SSL=false." "$YELLOW"
      exit 1
    fi
    
    echo_color "Setting up SSL with Let's Encrypt for $DOMAIN_NAME..." "$BLUE"
    certbot --nginx -d $DOMAIN_NAME --non-interactive --agree-tos -m $EMAIL
    
    if [ $? -eq 0 ]; then
      echo_color "SSL setup successful." "$GREEN"
    else
      echo_color "SSL setup failed. Check the certbot logs for details." "$RED"
    fi
  elif [ -n "$DOMAIN_NAME" ]; then
    echo_color "SSL appears to be already configured. Set FORCE_SSL=true to force reconfiguration." "$GREEN"
  fi
fi

echo_color "Deployment completed!" "$GREEN"