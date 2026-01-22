# WebSocket Setup Guide

This guide explains how WebSockets are implemented in this application for real-time feed updates.

## Overview

The application uses WebSockets to automatically update the feed when new posts are submitted. When a user submits a form, all connected clients receive the new post in real-time without needing to refresh the page.

## Architecture

### Backend (Cloudflare Worker)

1. **WebSocket Handler** (`src/worker/websocket.ts`)
   - Manages WebSocket connections
   - Stores active connections in memory
   - Broadcasts new posts to all connected clients
   - Handles authentication via token

2. **WebSocket Endpoint** (`/ws`)
   - Accepts WebSocket upgrade requests
   - Creates WebSocket pairs for client-server communication
   - Authenticates clients using JWT tokens

3. **Broadcast Mechanism**
   - When a new post is submitted via `/api/submit`
   - The submission is saved to KV
   - All connected WebSocket clients receive the new post
   - Posts are appended at the bottom of the feed (oldest first)

### Frontend (React)

1. **WebSocket Connection**
   - Automatically connects when user is authenticated
   - Sends authentication token on connection
   - Listens for `new_post` messages
   - Appends new posts to the bottom of the feed

2. **Feed Sorting**
   - Posts are sorted oldest first (newest at bottom)
   - New posts automatically append at the end
   - No auto-scroll - user stays at their current position

## How It Works

### Connection Flow

1. User logs in and receives authentication token
2. React app connects to WebSocket at `/ws`
3. Client sends authentication token: `{ type: "auth", token: "..." }`
4. Server stores connection with user ID
5. Connection remains open for real-time updates

### Post Submission Flow

1. User submits a new post via the form
2. Backend validates and saves to KV
3. Backend broadcasts new post to all connected WebSocket clients
4. All connected clients receive the post instantly
5. Post appears at the bottom of each user's feed
6. No page refresh or scroll interruption

### Message Format

**Client to Server:**
```json
{
  "type": "auth",
  "token": "base64-encoded-token"
}
```

**Server to Client:**
```json
{
  "type": "new_post",
  "post": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "message": "Hello world!",
    "timestamp": "2025-01-15T10:30:00.000Z"
  }
}
```

## Features

### ✅ Real-time Updates
- New posts appear instantly for all connected users
- No polling or manual refresh needed

### ✅ Non-intrusive
- New posts append at the bottom
- User's scroll position is preserved
- No auto-scroll to top

### ✅ Authentication
- WebSocket connections are authenticated
- Only authenticated users can receive updates
- Token-based security

### ✅ Auto-reconnection
- WebSocket automatically reconnects on disconnect
- 3-second delay before reconnection attempt

## Configuration

### WebSocket URL

The WebSocket URL is automatically determined based on the current protocol:

```javascript
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = `${protocol}//${window.location.host}/ws`;
```

- **Development**: `ws://localhost:8787/ws`
- **Production**: `wss://your-worker.workers.dev/ws`

### Connection Management

Connections are stored in-memory in the worker. For production with multiple workers, consider using:

- **Durable Objects**: For stateful WebSocket connections across workers
- **Pub/Sub**: For broadcasting across multiple worker instances

## Testing

### Test WebSocket Connection

1. Open browser DevTools → Network tab
2. Filter by "WS" (WebSocket)
3. Log in to the application
4. You should see a WebSocket connection to `/ws`
5. Submit a new post
6. Check the WebSocket messages in DevTools

### Test Real-time Updates

1. Open the app in two browser windows/tabs
2. Log in to both
3. Submit a post from one window
4. The post should appear instantly in the other window
5. Verify the post appears at the bottom (not top)

## Troubleshooting

### WebSocket Not Connecting

**Issue**: WebSocket connection fails

**Solutions**:
- Check browser console for errors
- Verify the `/ws` endpoint is accessible
- Check CORS settings in `wrangler.json`
- Ensure WebSocket upgrade header is present

### Posts Not Appearing in Real-time

**Issue**: New posts don't appear automatically

**Solutions**:
- Check WebSocket connection status in DevTools
- Verify authentication token is valid
- Check server logs for broadcast errors
- Ensure WebSocket is connected (check Network tab)

### Duplicate Posts

**Issue**: Same post appears multiple times

**Solutions**:
- The code checks for duplicate IDs before appending
- If duplicates occur, check the ID generation logic
- Verify WebSocket message handling

### Connection Drops Frequently

**Issue**: WebSocket disconnects often

**Solutions**:
- Check network stability
- Verify Cloudflare Worker timeout settings
- Consider implementing heartbeat/ping-pong
- Check for proxy/firewall issues

## Production Considerations

### Scalability

For production with high traffic:

1. **Use Durable Objects**
   ```typescript
   // Store connections in Durable Object
   // Allows connections across multiple workers
   ```

2. **Implement Connection Limits**
   ```typescript
   // Limit connections per user
   // Prevent abuse
   ```

3. **Add Heartbeat**
   ```typescript
   // Ping clients periodically
   // Detect dead connections
   ```

### Security

1. **Rate Limiting**
   - Limit WebSocket connections per IP
   - Prevent connection spam

2. **Token Validation**
   - Verify tokens on connection
   - Expire old tokens

3. **Message Validation**
   - Validate all incoming messages
   - Sanitize broadcast data

## Code Structure

```
src/
├── worker/
│   ├── websocket.ts      # WebSocket connection manager
│   ├── index.ts          # WebSocket endpoint handler
│   └── handlers/
│       └── form.ts       # Form submission (triggers broadcast)
└── react-app/
    └── App.tsx           # WebSocket client connection
```

## API Reference

### WebSocket Endpoint

**URL**: `/ws`

**Method**: GET (with Upgrade header)

**Headers**:
```
Upgrade: websocket
Connection: Upgrade
```

**Response**: 101 Switching Protocols (WebSocket upgrade)

### Broadcast Function

```typescript
broadcastNewPost(submission: FormSubmission): void
```

Broadcasts a new post to all connected WebSocket clients.

**Parameters**:
- `submission`: The form submission object to broadcast

**Returns**: void

## Example Usage

### Connecting from Client

```javascript
const ws = new WebSocket('wss://your-worker.workers.dev/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'auth', token: 'your-token' }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'new_post') {
    console.log('New post received:', data.post);
  }
};
```

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review Cloudflare Workers WebSocket documentation
3. Check browser console and server logs
