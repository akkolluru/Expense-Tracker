# Deploying Expense Tracker v2.0 (PaisaIQ) on an Old Laptop

This guide explains how to convert an old laptop running Linux (Ubuntu, Debian, Fedora, or Mint) into an autonomous, 24/7 personal finance server running PaisaIQ.

---

## 1. Laptop Server Preparation

### 1.1 Prevent Sleeping When the Laptop Lid is Closed

By default, Linux laptops enter sleep/suspend when the lid is closed. To run headless with the lid closed:

1. Edit the systemd login configuration:
   ```bash
   sudo nano /etc/systemd/logind.conf
   ```
2. Set or add the following directives:
   ```ini
   [Login]
   HandleLidSwitch=ignore
   HandleLidSwitchExternalPower=ignore
   HandleLidSwitchDocked=ignore
   ```
3. Restart the systemd logind service:
   ```bash
   sudo systemctl restart systemd-logind
   ```

### 1.2 Disable System Sleep and Hibernation (Optional but Recommended)

To ensure the laptop never sleeps even when idle or on AC power fluctuations:
```bash
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

---

## 2. Remote Access via Tailscale (Zero Port Forwarding)

Tailscale provides an encrypted WireGuard mesh network connecting your phone and the old laptop without exposing any open ports to the public internet.

1. **Install Tailscale on the laptop**:
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up
   ```
   Follow the authenticated URL in your browser to link the laptop to your Tailscale network.
2. **Note the Laptop's Tailscale IP**:
   ```bash
   tailscale ip -4
   # Example output: 100.85.120.45
   ```
3. **Install Tailscale on your Phone**:
   - Install the Tailscale app from Google Play or Apple App Store.
   - Sign in with the exact same account.
   - Verify you can ping or reach the laptop's Tailscale IP.

---

## 3. Deployment via Docker Compose

### 3.1 Install Docker & Docker Compose
On Ubuntu / Debian:
```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER
newgrp docker
```

### 3.2 Clone Repository & Configure Environment
```bash
git clone https://github.com/akkolluru/Expense-Tracker.git
cd Expense-Tracker

# Generate a strong server API key
python3 -c "import secrets; print(secrets.token_hex(24))"

# Copy and edit the environment template
cp .env.example .env
nano .env
```

Ensure `.env` contains:
```env
SERVER_API_KEY="<your-generated-hex-key>"
GEMINI_API_KEY="<your-google-ai-studio-api-key>"
NTFY_TOPIC="paisaiq-alerts-<your-unique-suffix>"
NTFY_SERVER_URL="https://ntfy.sh"
```

### 3.3 Set Up Gmail OAuth Credentials (Optional for Automated Email Sync)
If you wish to enable the 15-minute background Gmail poller:
1. Create a Google Cloud project with the **Gmail API** enabled and add your email to **Test Users**.
2. Download OAuth 2.0 Client credentials to `./credentials/credentials.json`.
3. Generate the token on your primary machine or run the auth flow:
   ```bash
   mkdir -p credentials
   # Place token.json into ./credentials/token.json
   ```
*(Note: If credentials are not yet present, the system will log an informative warning and safely continue operating in manual SMS/text ingestion mode without crashing).*

### 3.4 Launch the Service
```bash
docker compose up -d --build
```

Verify service status:
```bash
docker compose ps
docker compose logs -f
```

Test the health probe:
```bash
curl http://localhost:8000/api/v1/system/health -H "X-API-Key: <your-server-api-key>"
```

---

## 4. Install PaisaIQ PWA on Your Phone

1. On your phone (connected to Tailscale), open your mobile browser (Safari on iOS, Chrome on Android).
2. Navigate to:
   ```
   http://<your-laptop-tailscale-ip>:8000
   ```
3. **Install as Progressive Web App (PWA)**:
   - **iOS (Safari)**: Tap the **Share** button (`⎙` / `↑`) → tap **Add to Home Screen** (`+`).
   - **Android (Chrome)**: Tap the three dots menu (`⋮`) → tap **Add to Home screen** / **Install app**.
4. The PaisaIQ icon appears on your home screen and launches full-screen without browser URL bars, complete with offline transaction caching.

---

## 5. Mobile Push Notifications via ntfy

1. Install the free, open-source **ntfy** app from Google Play or Apple App Store.
2. Tap `+` (Subscribe to topic).
3. Enter the topic configured in your `.env` (e.g. `paisaiq-alerts-xyz`).
4. You will now receive:
   - Instant push alerts whenever a transaction requires category review.
   - Daily spending summaries at 9:00 PM.
   - Immediate alerts if an automated 2:00 AM backup encounters an issue.

---

## 6. Maintenance & Backups

### 6.1 Automated Zero-Downtime Backups
- The backend runs a scheduled SQLite `VACUUM INTO` snapshot every night at **2:00 AM**.
- Snapshots are written to the Docker volume `expense-tracker-backups` (`/backups/expense_tracker_YYYYMMDD_HHMMSS.db`).
- Backups are automatically rotated, retaining the last 30 daily snapshots.

### 6.2 Manual On-Demand Backup Trigger
You can trigger an immediate backup snapshot at any time:
```bash
curl -X POST http://localhost:8000/api/v1/system/backup \
  -H "X-API-Key: <your-server-api-key>"
```

### 6.3 Restoring from a Backup
If you ever need to restore from a backup:
```bash
# 1. Stop container
docker compose stop

# 2. Inspect Docker volume location
docker volume inspect expense-tracker-data

# 3. Copy snapshot into the database volume path
docker run --rm -v expense-tracker-data:/data -v expense-tracker-backups:/backups alpine \
  cp /backups/expense_tracker_YYYYMMDD_HHMMSS.db /data/expense_tracker.db

# 4. Restart container
docker compose up -d
```
