# API Documentation

## Base URL

- Development: `http://localhost:8000/api/v1`
- Production: `https://api.yourdomain.com/api/v1`

## Authentication

All authenticated endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <access_token>
```

## Endpoints

### Authentication

#### POST /auth/register

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response (201 Created):**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "user_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Validation:**
- Password must be minimum 8 characters
- Password must contain at least one digit
- Password must contain at least one uppercase letter

---

#### POST /auth/login

Login with existing credentials.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "user_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

---

#### GET /auth/me

Get current authenticated user information.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "user@example.com",
  "created_at": "2025-11-25T10:00:00Z"
}
```

---

### Device Management

#### POST /device/register

Register a new device.

**Headers:**
```
Authorization: Bearer <user_token>
```

**Request Body:**
```json
{
  "device_name": "John's iPhone",
  "device_type": "ios",
  "device_info": {
    "user_agent": "Mozilla/5.0...",
    "platform": "iOS",
    "device_id": "unique-device-id"
  },
  "public_key": "optional-public-key"
}
```

**Response (201 Created):**
```json
{
  "access_token": "new-token-with-device-id",
  "token_type": "bearer",
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "device_id": "device-uuid"
}
```

---

#### GET /device/list

List all registered devices for the current user.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
[
  {
    "id": "device-uuid-1",
    "device_name": "MacBook Pro",
    "device_type": "web",
    "last_seen": "2025-11-25T10:30:00Z",
    "is_active": true,
    "created_at": "2025-11-20T08:00:00Z"
  },
  {
    "id": "device-uuid-2",
    "device_name": "iPhone 15",
    "device_type": "ios",
    "last_seen": "2025-11-25T09:15:00Z",
    "is_active": true,
    "created_at": "2025-11-21T12:00:00Z"
  }
]
```

---

#### DELETE /device/{device_id}

Unregister (deactivate) a device.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (204 No Content)**

---

### Clipboard Operations

#### POST /clipboard/update

Create a new clipboard item with encrypted content.

**Headers:**
```
Authorization: Bearer <device_token>
```

**Request Body:**
```json
{
  "encrypted_content": "base64-encoded-aes-gcm-ciphertext",
  "iv": "base64-encoded-initialization-vector",
  "content_hash": "sha256-hash-of-plaintext",
  "content_type": "text",
  "content_size": 1024
}
```

**Response (201 Created):**
```json
{
  "id": "clipboard-item-uuid",
  "encrypted_content": "base64-encoded-aes-gcm-ciphertext",
  "iv": "base64-encoded-initialization-vector",
  "content_hash": "sha256-hash",
  "content_type": "text",
  "content_size": 1024,
  "device_id": "device-uuid",
  "created_at": "2025-11-25T10:35:00Z"
}
```

**Notes:**
- Automatically broadcasts to all user's devices via WebSocket
- Deduplicates based on content_hash (within 1 minute window)
- Maximum content size: 10MB

---

#### GET /clipboard/latest

Get the most recent clipboard item.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "id": "clipboard-item-uuid",
  "encrypted_content": "...",
  "iv": "...",
  "content_hash": "...",
  "content_type": "text",
  "content_size": 512,
  "device_id": "device-uuid",
  "created_at": "2025-11-25T10:35:00Z"
}
```

---

#### GET /clipboard/history

Get clipboard history with pagination.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (integer, default: 1): Page number
- `page_size` (integer, default: 20, max: 100): Items per page

**Response (200 OK):**
```json
{
  "items": [
    {
      "id": "item-1",
      "encrypted_content": "...",
      "created_at": "2025-11-25T10:35:00Z"
    },
    {
      "id": "item-2",
      "encrypted_content": "...",
      "created_at": "2025-11-25T10:30:00Z"
    }
  ],
  "total": 15,
  "page": 1,
  "page_size": 20
}
```

---

#### DELETE /clipboard/{item_id}

Delete a specific clipboard item.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (204 No Content)**

---

#### DELETE /clipboard/clear

Clear all clipboard history for the current user.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (204 No Content)**

---

### WebSocket

#### WS /ws/clipboard

Real-time clipboard synchronization endpoint.

**Connection:**
```
ws://localhost:8000/ws/clipboard?token=<access_token>
```

**Message Types:**

**1. Connected (Server → Client)**
```json
{
  "type": "connected",
  "data": {
    "message": "WebSocket connection established",
    "device_id": "device-uuid"
  },
  "timestamp": "2025-11-25T10:00:00Z"
}
```

**2. Clipboard Update (Server → Client)**
```json
{
  "type": "clipboard_update",
  "data": {
    "item_id": "clipboard-item-uuid",
    "encrypted_content": "...",
    "iv": "...",
    "content_hash": "...",
    "content_type": "text",
    "device_id": "sender-device-uuid",
    "created_at": "2025-11-25T10:35:00Z"
  },
  "timestamp": "2025-11-25T10:35:00.123Z"
}
```

**3. Ping (Server → Client)**
```json
{
  "type": "ping",
  "timestamp": "2025-11-25T10:35:00Z"
}
```

**4. Pong (Client → Server)**
```json
{
  "type": "pong",
  "timestamp": "2025-11-25T10:35:00Z"
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "detail": "Error message description",
  "error_code": "OPTIONAL_ERROR_CODE",
  "timestamp": "2025-11-25T10:00:00Z"
}
```

### Common HTTP Status Codes

- `200 OK`: Successful request
- `201 Created`: Resource created successfully
- `204 No Content`: Successful deletion
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `413 Payload Too Large`: Content exceeds size limit
- `422 Unprocessable Entity`: Validation error
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

---

## Rate Limiting

- **API Endpoints**: 60 requests per minute
- **Auth Endpoints**: 10 requests per minute
- **WebSocket**: No rate limit (heartbeat managed by server)

**Rate Limit Headers:**
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1700000000
```

---

## Interactive API Documentation

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
