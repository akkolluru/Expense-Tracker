# Mobile App & Headless Backend Architecture

To provide a native mobile experience, the system decouples a native mobile client (React Native / Expo) from a headless containerized backend (FastAPI + SQLite WAL), and establishes strict 1:1 Group assignment alongside orthogonal Category classification and periodic Financial Recaps.

## Context & Problem
The previous UI was built with Flet (Python Flutter wrapper), which lacked native mobile feel, advanced gesture interactions, and standard charting capabilities. Additionally, users required the ability to isolate trip/event expenses (e.g. "Goa Trip", "Night Out") without losing broad category classifications (e.g. Food vs Travel).

## Decision
1. **Decoupled Headless Backend & Native Mobile App**: The backend is a headless FastAPI REST service with OpenAPI generation, containerized with Docker. The mobile client is a standalone cross-platform native app communicating over HTTP/Tailscale.
2. **Orthogonal Category & 1:1 Group Association**: Each transaction is classified into a single mandatory Category tree (Parent + Subcategory) and optionally linked to at most one `Group` (`group_id`). Groups support date-range automation and manual tagging.
3. **Multi-Tier Classification Hierarchy**: Categorization strictly prioritizes: User Rules → Merchant Memory Cache → Structured JSON LLM → Inbox Review.
4. **Statistical Analytics & AI Financial Recaps**: Category drilldowns (top 5 spends), MoM variance, and pattern changes are computed on-demand via indexed SQL queries, while periodic AI recaps (1m, 3m, 6m, 12m) generate human-readable financial insights from aggregated statistics.
