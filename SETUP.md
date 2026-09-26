# Setup Guide: Self-Hosted Expense Tracker

> [!NOTE]
> **Expense Tracker v2.0 Architecture Notice**:
> Version 2.0 adopts a headless **FastAPI + SQLite WAL** async backend paired with an offline-first **PaisaIQ React 19 PWA** (`frontend/`) and Tailscale mesh networking.
> See [plans/PLAN_VALIDATION.md](file:///Users/kaushik/Projects/Expense%20Tracker/plans/PLAN_VALIDATION.md) and [docs/ARCHITECTURE.md](file:///Users/kaushik/Projects/Expense%20Tracker/docs/ARCHITECTURE.md) for full deployment details. The instructions below contain legacy v1 setup commands.

### Step 1: Install Dependencies
```bash
# Clone the repository
git clone https://github.com/akkolluru/Expense-Tracker.git expense-tracker
cd expense-tracker

# Set up virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install requirements (compiles Rust for bcrypt/cryptography automatically on Mac/Linux)
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 2: Configure Environment
Create a `.env` file in the project root:
```env
# REQUIRED: Generate a random string: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY="your-random-64-char-hex-string-here"

# Email
HDFC_SENDER_EMAIL="alerts@hdfcbank.net"
EMAIL_POLL_INTERVAL_MINUTES=15

# LLM
LLM_SERVER_URL="http://127.0.0.1:8080/v1/chat/completions"

# Push Notifications
NTFY_SERVER_URL="https://ntfy.sh"
NTFY_TOPIC="your-unique-topic-name-2026"
```

### Step 3: Seed Database and Set Up OAuth
```bash
# Initialize DB with default categories and admin user
PYTHONPATH=. python scripts/seed_db.py

# Authorize Gmail API (make sure your email is added to Test Users in GCP!)
PYTHONPATH=. python scripts/gmail_auth.py
```

### Step 4: Run the LLM Server (llama.cpp)
On a Mac, you can easily install `llama.cpp` using Homebrew:
```bash
brew install llama.cpp

# Download the model
wget https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf

# Run it
llama-server -m qwen2.5-1.5b-instruct-q4_k_m.gguf --port 8080 -ngl 99
```

### Step 5: Start Backend and Frontend
In separate terminal tabs:
```bash
# Terminal 1: Backend
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Terminal 2: Frontend
source .venv/bin/activate
python -m ui.main
```
Open `http://127.0.0.1:8550` to log in (admin / changeme).

---

## Part 2: Running on Nothing Phone (Android / Termux)

## Prerequisites
- **Nothing Phone (1)** with 12GB RAM, 256GB storage
- **Termux** installed from F-Droid (NOT Play Store — the Play Store version is outdated)
- **ntfy** app installed from Play Store

## Step 1: Install Termux & System Dependencies

Open Termux and run:
```bash
pkg update -y && pkg upgrade -y
# Install basic dependencies and the Rust compiler (required for cryptography/bcrypt)
pkg install python git clang make cmake wget libcrypt openssl rust binutils
```

## Step 2: Clone the Project

```bash
cd ~
git clone https://github.com/akkolluru/Expense-Tracker.git expense-tracker
cd expense-tracker
```

## Step 3: Set Up Python Virtual Environment

```bash
# Export the Android API level for the Rust compiler to work properly (fixes maturin build errors)
export ANDROID_API_LEVEL=$(getprop ro.build.version.sdk)

python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

## Step 4: Configure Environment Variables

Create a `.env` file in the project root:
```bash
nano .env
```

Add the following (customize the values):
```env
# REQUIRED: Change this to a random string (use: python -c "import secrets; print(secrets.token_hex(32))")
SECRET_KEY="your-random-64-char-hex-string-here"

# Email
HDFC_SENDER_EMAIL="alerts@hdfcbank.net"
EMAIL_POLL_INTERVAL_MINUTES=15

# LLM
LLM_SERVER_URL="http://127.0.0.1:8080/v1/chat/completions"

# Push Notifications (change topic to something unique to you)
NTFY_SERVER_URL="https://ntfy.sh"
NTFY_TOPIC="your-unique-topic-name-2026"
```

## Step 5: Seed the Database

```bash
source .venv/bin/activate
# Use PYTHONPATH=. so Python can find the 'app' module
PYTHONPATH=. python scripts/seed_db.py
```

This creates the database, default categories, and the admin user (username: `admin`, password: `changeme`).

## Step 6: Set Up Gmail OAuth

> [!IMPORTANT]
> If your Google Cloud project is in "Testing" mode, you must add your Gmail address to the **Test Users** list in the Google Cloud Console (OAuth consent screen) before running this script, or you will get a 403 Access Denied error.

```bash
# You'll need to create a Google Cloud OAuth Client ID first
# Download the credentials.json and place it in credentials/
PYTHONPATH=. python scripts/gmail_auth.py
```

Follow the on-screen prompts to authorize Gmail read-only access. The token will be encrypted and saved.

## Step 7: Set Up the LLM Server

Download and run the quantized model:
```bash
# Download the model (one-time, ~1GB)
wget https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf

# Start llama-server (run in a separate tmux pane or Termux session)
./llama-server -m qwen2.5-1.5b-instruct-q4_k_m.gguf --port 8080 -ngl 0
```

> [!TIP]
> Use `tmux` to manage multiple sessions. Install it with `pkg install tmux`.

## Step 8: Start the Backend

In a Termux session (or tmux pane):
```bash
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

This starts:
- The FastAPI REST API on port 8000
- The APScheduler background jobs (email polling every 15 min, daily backup at 2 AM, daily summary at 9 PM)

## Step 9: Start the Flet Frontend

In another Termux session (or tmux pane):
```bash
source .venv/bin/activate
python -m ui.main
```

## Step 10: Access the App

Open your phone's web browser and navigate to:
```
http://127.0.0.1:8550
```

Login with:
- **Username:** `admin`
- **Password:** `changeme` (change this via the API after first login)

## Step 11: Subscribe to Push Notifications

1. Open the **ntfy** app on your phone
2. Tap `+` → Subscribe to topic
3. Enter your topic name (e.g., `your-unique-topic-name-2026`)
4. You'll now receive alerts when transactions need manual review and daily spending summaries at 9 PM

## Step 12 (Optional): Secure Remote Access via Tailscale

To access the dashboard from your laptop without exposing ports:
1. Install Tailscale on your phone (Play Store) and laptop
2. Log in with the same account on both devices
3. Access the app from your laptop at `http://<phone-tailscale-ip>:8550`

---

## Recommended tmux Layout

```bash
# Install tmux
pkg install tmux

# Start a new session
tmux new -s expense-tracker

# Pane 0: LLM Server
./llama-server -m qwen2.5-1.5b-instruct-q4_k_m.gguf --port 8080 -ngl 0

# Split pane (Ctrl+b, then %)
# Pane 1: FastAPI Backend
source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000

# Split pane (Ctrl+b, then ")
# Pane 2: Flet Frontend
source .venv/bin/activate && python -m ui.main
```

Detach with `Ctrl+b, d`. Reattach with `tmux attach -t expense-tracker`.

> [!IMPORTANT]
> If you restart your phone, you'll need to re-open Termux and re-run the 3 processes above. Consider using `termux-boot` for auto-start (install with `pkg install termux-boot`).
