# Bank Parser Registry & Authentication Architecture

Establishes a pluggable strategy registry for bank parsers, strict pre-configured account resolution, and API-key-based security for single-user deployment with a clear pathway to multi-user capabilities.

## Context & Problem
Different financial institutions format email/SMS alerts with distinct schemas (plain text UPI, HTML card statements, etc.). Ingestion must be extensible across banks without modifying core transaction logic. In addition, authentication should remain frictionless for a self-hosted single-user environment while maintaining a clean boundary for future multi-user extensions.

## Decision
1. **Bank Parser Strategy Registry**: Bank parsers implement a standardized `BankParser` protocol (`can_handle(raw_message) -> bool`, `parse(raw_message) -> list[DraftTransaction]`). Adding support for new banks or statement formats requires only implementing this interface and registering the class.
2. **Pre-Configured Account Resolution**: Ingestion strictly maps incoming account identifiers (e.g. `account_last4` + bank institution) to existing configured `Account` records, avoiding schema clutter.
3. **Single-User API Key Authentication with Tailscale**: The backend secures endpoints via a header-based `X-API-Key` configured in the server environment, stored securely in the mobile client's encrypted storage (Expo SecureStore). Multi-user authentication is deferred to future milestones.
4. **React Native (Expo) Mobile Client**: The user interface is developed as a cross-platform mobile application using React Native, TypeScript, and Expo, connecting directly to the containerized FastAPI backend.
