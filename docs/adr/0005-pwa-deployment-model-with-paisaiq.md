# PWA Deployment Model with PaisaIQ React 19

To deliver a friction-free, cross-device experience without mobile app store distribution delays, the system adopts PaisaIQ (React 19 + TypeScript + Tailwind CSS) as an offline-first Progressive Web Application (PWA) served alongside the headless FastAPI backend.

## Context & Problem
The initial v2.0 roadmap proposed a React Native (Expo) mobile client. However, building, compiling, and testing native binaries across iOS and Android introduces development overhead and requires native build tooling. The user created a complete, responsive mobile-first UI/UX package ("PaisaIQ") with dark forest-green styling, card drawers, and modal workflows in React 19 with Vite and Tailwind CSS.

## Decision
1. **Adoption of PaisaIQ PWA**: Adopt the PaisaIQ React 19 application as the official client. It features responsive viewport adaptation (`max-w-[430px]` mobile mode and expanded desktop mode), Recharts visualizations, and Lucide iconography.
2. **PWA Offline Installation**: Package the frontend with a web manifest and service worker caching (via TanStack Query and browser storage) so it installs directly to Android and iOS home screens as a native-feeling app.
3. **Decoupled API Consumption**: The frontend connects to the containerized FastAPI backend using a configured Tailscale host URL and `X-API-Key` headers, with zero server-side rendering coupling.
4. **Native App Pathway**: If hardware capabilities (e.g. background SMS daemon or biometrics) are required in future phases, the PWA can be wrapped in Capacitor with zero code rewrites.
