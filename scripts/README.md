# Deployment Scripts

This directory contains a collection of scripts for deploying, updating, and managing the RL HABITT Backend application.

## Scripts

### `deploy.sh`

Setup and deploy the application on a new Ubuntu server.

```bash
sudo ./deploy.sh
```

**Requirements:**
- Environment variables for credentials (see script for details)
- Root or sudo privileges

### `update-remote.sh`

Update a remote server with the latest code changes.

```bash
./update-remote.sh user@your-server-ip [optional-ssh-key]
```

**Features:**
- Pushes local Git changes
- Pulls changes on the remote server
- Rebuilds and restarts Docker containers

### `nginx-fix.sh`

Fix NGINX configuration to prevent unwanted 301 redirects.

```bash
sudo ./nginx-fix.sh yourdomain.com
```

**Features:**
- Creates a backup of the current configuration
- Configures HTTP access for the API without redirects
- Maintains HTTPS for other paths

## Usage Tips

1. Make scripts executable before running:
   ```bash
   chmod +x scripts/*.sh
   ```

2. When running deployment scripts, always ensure your environment variables are set:
   ```bash
   export SUPABASE_URL=your-url
   export SUPABASE_KEY=your-key
   # etc.
   ```

3. For the update script, ensure you have SSH access to your remote server.

4. All scripts provide colored output and detailed error messages for troubleshooting.