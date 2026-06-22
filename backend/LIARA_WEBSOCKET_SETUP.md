# Liara WebSocket Configuration Guide

## Problem
WebSocket connections are returning 404 errors because Liara is not configured to handle WebSocket upgrades.

## Solution

### Step 1: Ensure Daphne is used (not Gunicorn)

The `Procfile` in the backend directory should contain:
```
web: daphne -b 0.0.0.0 -p $PORT core.asgi:application
```

**In Liara Dashboard:**
1. Go to your app settings
2. Check the "Build & Deploy" section
3. Ensure the startup command uses Daphne, not Gunicorn
4. If it's using Gunicorn, change it to use the Procfile or set the command manually:
   ```
   daphne -b 0.0.0.0 -p $PORT core.asgi:application
   ```

### Step 2: Verify WebSocket Support

Liara should automatically handle WebSocket upgrades if:
- Daphne is being used (ASGI server)
- The reverse proxy is configured correctly

### Step 3: Test WebSocket Connection

After deployment, test the WebSocket endpoint:
```bash
# Test from command line (if you have wscat installed)
wscat -c wss://urtherapist.liara.run/ws/patient/notifications/?token=YOUR_TOKEN
```

### Step 4: Check Logs

Check Liara logs to see if:
- Daphne is starting correctly
- WebSocket connection attempts are being received
- Any errors during WebSocket handshake

### Alternative: If Liara Doesn't Support WebSockets

If Liara doesn't support WebSocket connections, consider:
1. Using a WebSocket service (Pusher, Ably, etc.)
2. Using Server-Sent Events (SSE) as a fallback
3. Using long polling
4. Switching to a platform that supports WebSockets (Railway, Render, etc.)

## Current Configuration

- **ASGI Application**: `core.asgi.application`
- **WebSocket Routes**: Defined in `authapp/routing.py`
- **WebSocket Paths**:
  - `/ws/patient/notifications/` - Patient notifications
  - `/ws/therapist/requests/` - Therapist requests
  - `/ws/chat/<session_id>/` - Chat messages

## Verification

After configuration, you should see in the mobile app logs:
```
Patient WebSocket connecting to: wss://urtherapist.liara.run/ws/patient/notifications/?token=...
Patient WebSocket connected
```

Instead of:
```
Patient WebSocket error: Expected HTTP 101 response but was '404 Not Found'
```

