# Mobile Client (React Native)

## Overview

Cross-platform mobile application for iOS and Android using React Native with Expo.

## Features

- ✅ User authentication
- ✅ Device registration
- ✅ Clipboard monitoring (foreground only due to OS limitations)
- ✅ Real-time sync via WebSocket
- ✅ Client-side encryption (AES-GCM)
- ✅ Clipboard history
- ✅ Background sync (limited by OS)
- ✅ Push notifications fallback

## Setup

```bash
cd mobile-client

# Install dependencies
npm install

# Start development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android
```

## Configuration

Create `.env` file:
```
API_URL=http://your-backend:8000
WS_URL=ws://your-backend:8000
```

## Platform-Specific Notes

### iOS
- Clipboard monitoring works in foreground
- Background clipboard access requires special entitlements
- WebSocket automatically reconnects when app returns to foreground

### Android
- Clipboard monitoring works in foreground
- Background service limited by Doze mode
- Need `FOREGROUND_SERVICE` permission for background monitoring

## Build for Production

```bash
# iOS
expo build:ios

# Android
expo build:android
```

## Mobile-Specific Challenges

1. **Background Execution**: Mobile OSes limit background tasks
   - Solution: Foreground service + push notifications

2. **Battery Optimization**: Continuous clipboard monitoring drains battery
   - Solution: Configurable polling interval

3. **Clipboard Permissions**: iOS requires specific permissions
   - Solution: Request permissions on first use

## Testing

```bash
# Run tests
npm test

# E2E tests
npm run test:e2e
```

## Architecture

```
src/
├── components/       # Reusable UI components
├── screens/         # App screens
├── services/        # Business logic
│   ├── api.ts      # API client
│   ├── ClipboardMonitor.ts
│   ├── EncryptionService.ts
│   └── WebSocketService.ts
├── navigation/      # React Navigation setup
└── utils/          # Helpers
```

For full implementation, refer to the web client as a reference and adapt for React Native APIs.
