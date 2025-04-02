# Docker Deployment Guide

This guide describes how to deploy the sheet_parser application using Docker on a DigitalOcean droplet.

## Prerequisites

- A DigitalOcean account
- Basic familiarity with Docker and Linux commands

## Deployment Steps

### 1. Create a DigitalOcean Droplet

- Use Ubuntu 20.04 or newer
- Choose a size with at least 1GB RAM
- Enable SSH key authentication

### 2. Install Docker and Docker Compose

SSH into your droplet and run the following commands:

```bash
# Update package lists
sudo apt-get update

# Install prerequisites
sudo apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Set up the stable repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.12.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add your user to the docker group to run docker without sudo
sudo usermod -aG docker ${USER}
```

### 3. Clone the Repository

```bash
# Create a directory for the application
mkdir -p /opt/rlhabitt
cd /opt/rlhabitt

# Clone the repository
git clone <your-repository-url> .
```

### 4. Configure Environment Variables

Create a `.env` file in the root directory with the required configuration:

```bash
cd /opt/rlhabitt
touch .env
nano .env
```

Add the following variables (replace with your actual values):

```
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_KEY=your-supabase-service-role-key
API_USERNAME=your-api-username
API_PASSWORD=your-api-password
ONEDRIVE_FILE_ID=your-onedrive-file-id
TENANT_ID=your-azure-tenant-id
CLIENT_ID=your-azure-client-id
CLIENT_SECRET=your-azure-client-secret
```

### 5. Build and Start the Services

```bash
cd /opt/rlhabitt
docker-compose build
docker-compose up -d
```

### 6. Verify the Deployment

Check if the containers are running:

```bash
docker-compose ps
```

View the logs:

```bash
# API service logs
docker-compose logs api

# Scheduler service logs
docker-compose logs scheduler

# View scheduled import logs
docker exec -it rlhabitt_scheduler_1 cat /var/log/sheet_parser/scheduled_import.log
```

## Maintenance

### Restarting the Services

```bash
docker-compose restart
```

### Updating the Application

```bash
cd /opt/rlhabitt
git pull
docker-compose down
docker-compose build
docker-compose up -d
```

### Running Manual Imports

If you need to run an import manually outside the scheduled time:

```bash
docker exec rlhabitt_scheduler_1 python -m src.scheduled_import
```

## Troubleshooting

### Check Logs

```bash
# View combined logs
docker-compose logs

# View service-specific logs
docker-compose logs api
docker-compose logs scheduler
```

### Check Cron Status

```bash
docker exec rlhabitt_scheduler_1 crontab -l
```