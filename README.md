# Self-Hosted Expense Tracker 💸

A fully private, self-hosted expense tracker designed to run continuously on an Android device (via Termux) or a Raspberry Pi. It automatically parses bank emails, categorizes transactions using a local LLM, and provides a sleek mobile-first UI.

## Architecture 🏛️
The project uses a 3-layer categorization pipeline:
1. **Rule Engine:** Exact matches for known VPAs or Merchants.
2. **LLM Inference:** Uses a local, quantized `llama.cpp` server (Qwen2.5-1.5B) to intelligently classify transactions without sending your data to the cloud.
3. **Human-in-the-loop:** Any low-confidence inferences fall through to an Inbox for manual review.

The tech stack includes:
- **Backend:** FastAPI, SQLAlchemy (Async), SQLite (WAL mode)
- **Frontend:** Flet (Flutter for Python) built for mobile-first web rendering.
- **Workers:** APScheduler for email polling and daily backups.
- **Notifications:** `ntfy.sh` for push alerts.

## 📱 Termux / Device Setup

This project is optimized for Termux on Android devices like the Nothing Phone (1).

1. **Install Termux & Dependencies:**
   ```bash
   pkg update -y
   pkg install python git clang make cmake wget libcrypt
   ```

2. **Clone the Repository:**
   ```bash
   git clone https://github.com/yourusername/expense-tracker.git
   cd expense-tracker
   ```

3. **Set up the Virtual Environment:**
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

## ⚙️ Configuration

1. Create a `.env` file in the root directory:
   ```env
   # Database & Secrets
   SECRET_KEY="generate-a-long-random-string-here"
   
   # Email Integration (Gmail)
   HDFC_SENDER_EMAIL="alerts@hdfcbank.net"
   EMAIL_POLL_INTERVAL_MINUTES=15
   
   # LLM
   LLM_SERVER_URL="http://127.0.0.1:8080/v1/chat/completions"
   
   # Push Notifications
   NTFY_SERVER_URL="https://ntfy.sh"
   NTFY_TOPIC="your-unique-topic-name-2026"
   ```

2. **Gmail API Setup:**
   Run the interactive script to generate your `token.json` for Gmail read-only access.
   ```bash
   python scripts/gmail_auth.py
   ```

3. **LLM Server Setup:**
   Download a quantized GGUF model and run `llama-server`.
   ```bash
   wget https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf
   # Run the server in a separate tmux/screen window:
   ./llama-server -m qwen2.5-1.5b-instruct-q4_k_m.gguf --port 8080
   ```

## 🚀 Running the App

The system is split into two processes. Run them in separate terminal sessions (or use `tmux`).

**1. Start the FastAPI Backend & Workers:**
```bash
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
*This handles the API, database migrations, email fetching jobs, and daily backups.*

**2. Start the Flet Frontend:**
```bash
source .venv/bin/activate
python -m ui.main
```
*Navigate to `http://127.0.0.1:8550` on your phone's browser to access the app.*

## 🔒 Security & Remote Access
Do **not** expose port `8550` or `8000` to the public internet. If you want to access the dashboard from your laptop, install **Tailscale** on both your phone and laptop to create a secure, encrypted peer-to-peer network.

---
Built with ❤️ for full data privacy and automation.
