#!/bin/bash
# Script to update and restart the RL HABITT Backend on a remote server
# Usage: ./update-remote.sh [remote-host] [ssh-key]

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
  echo_color "Usage: $0 [remote-host] [ssh-key]" "$RED"
  echo_color "Example: $0 user@123.456.789.0 ~/.ssh/id_rsa" "$YELLOW"
  exit 1
fi

REMOTE_HOST=$1
SSH_KEY=${2:-""}

# SSH command construction
if [ -n "$SSH_KEY" ]; then
  SSH_CMD="ssh -i $SSH_KEY $REMOTE_HOST"
else
  SSH_CMD="ssh $REMOTE_HOST"
fi

echo_color "Testing SSH connection to $REMOTE_HOST..." "$BLUE"
$SSH_CMD "echo 'SSH connection successful'" || { echo_color "SSH connection failed. Check your credentials and try again." "$RED"; exit 1; }

echo_color "Updating RL HABITT Backend on $REMOTE_HOST..." "$GREEN"

# Check if Git is installed on local machine
if ! command -v git &> /dev/null; then
  echo_color "Git is not installed on your local machine. Please install Git first." "$RED"
  exit 1
fi

# Check if we're in a git repository
if ! git rev-parse --is-inside-work-tree &> /dev/null; then
  echo_color "You must run this script from within a Git repository." "$RED"
  exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null)
if [ -z "$CURRENT_BRANCH" ]; then
  echo_color "Unable to determine current Git branch. Make sure you're not in a detached HEAD state." "$RED"
  exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
  echo_color "Warning: You have uncommitted changes in your repository." "$YELLOW"
  read -p "Do you want to commit these changes before deploying? (y/n): " -n 1 -r
  echo
  
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter commit message: " COMMIT_MSG
    git add .
    git commit -m "$COMMIT_MSG"
    echo_color "Changes committed successfully." "$GREEN"
  else
    echo_color "Continuing without committing changes..." "$YELLOW"
  fi
fi

# Push changes to remote repository
echo_color "Pushing local changes to Git repository..." "$BLUE"
git push origin $CURRENT_BRANCH || { echo_color "Failed to push changes. Please resolve any conflicts and try again." "$RED"; exit 1; }

# Deploy to server
echo_color "Deploying to $REMOTE_HOST..." "$BLUE"

# Update commands to run on the server
REMOTE_COMMANDS="
cd /opt/rlhabitt && \
echo 'Pulling latest changes...' && \
git pull && \
echo 'Rebuilding Docker containers...' && \
docker-compose down && \
docker-compose build && \
echo 'Starting services...' && \
docker-compose up -d && \
echo 'Checking service status...' && \
docker-compose ps
"

# Execute commands on the remote server
$SSH_CMD "$REMOTE_COMMANDS"

# Check the result
if [ $? -eq 0 ]; then
  echo_color "✅ Deployment completed successfully!" "$GREEN"
  echo_color "The services have been updated and restarted on $REMOTE_HOST." "$GREEN"
else
  echo_color "❌ Deployment failed. Please check the logs on the remote server." "$RED"
  echo_color "You can connect to the server with: $SSH_CMD" "$YELLOW"
  echo_color "Then check the logs with: cd /opt/rlhabitt && docker-compose logs" "$YELLOW"
  exit 1
fi

# Print helpful information
echo 
echo_color "Useful commands:" "$BLUE"
echo_color "- View logs: $SSH_CMD \"cd /opt/rlhabitt && docker-compose logs\"" "$YELLOW"
echo_color "- Restart services: $SSH_CMD \"cd /opt/rlhabitt && docker-compose restart\"" "$YELLOW"
echo_color "- Stop services: $SSH_CMD \"cd /opt/rlhabitt && docker-compose down\"" "$YELLOW"