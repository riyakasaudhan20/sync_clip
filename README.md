# Multi-Device Clipboard Sync System

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Python](https://img.shields.io/badge/python-3.11+-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109-green)
![Next.js](https://img.shields.io/badge/Next.js-14.1-black)

> **Seamlessly sync your clipboard across all your devices with end-to-end encryption and real-time updates.**

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Security](#security)
- [Development](#development)
- [Deployment](#deployment)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

Multi-Device Clipboard Sync is a production-ready system that allows users to copy text on one device and instantly access it on all their other devices. Built with enterprise-grade security and performance in mind.

### Key Capabilities

- **Real-time Synchronization**: Sub-2-second sync across devices using WebSocket
- **End-to-End Encryption**: AES-GCM-256 encryption ensures your data is always secure
- **Multi-Platform**: Web, Android, and iOS support
- **History Management**: Access your last 20 clipboard entries
- **Offline Support**: Automatic reconnection and sync when back online

## ✨ Features

### Core Features
- ✅ User authentication with JWT
- ✅ Multi-device registration and management
- ✅ Real-time clipboard synchronization via WebSocket
- ✅ End-to-end encryption (AES-GCM-256)
- ✅ Clipboard history (last 20 items per user)
- ✅ Automatic cleanup of old entries
- ✅ Device-specific encryption keys
- ✅ Content deduplication

### Security Features
- 🔒 HTTPS/WSS for all communications
- 🔒 JWT-based session authentication
- 🔒 Bcrypt password hashing
- 🔒 No plaintext storage in database
- 🔒 Per-device encryption keys
- 🔒 Rate limiting on API endpoints
- 🔒 Content hash verification

### Performance Features
- ⚡ Sub-2-second sync latency
- ⚡ WebSocket connection pooling
- ⚡ Database query optimization with indexes
- ⚡ Automatic reconnection with exponential backoff
- ⚡ Efficient binary data encoding

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Web Client  │  │Mobile Client │  │Desktop Client│      │
│  │  (Next.js)   │  │(React Native)│  │  (Electron)  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                  │               │
│         └─────────────────┴──────────────────┘               │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │ HTTPS/WSS
┌───────────────────────────┼──────────────────────────────────┐
│                           │                                  │
│                 ┌─────────▼─────────┐                        │
│                 │  Nginx (Reverse   │                        │
│                 │  Proxy + SSL)     │                        │
│                 └─────────┬─────────┘                        │
│                           │                                  │
│                 ┌─────────▼─────────┐                        │
│                 │   FastAPI Backend │                        │
│                 │   - REST API      │                        │
│                 │   - WebSocket     │                        │
│                 └─────────┬─────────┘                        │
│                           │                                  │
│         ┌─────────────────┴─────────────────┐               │
│         │                                    │               │
│  ┌──────▼──────┐                    ┌───────▼──────┐        │
│  │ PostgreSQL  │                    │    Redis     │        │
│  │  Database   │                    │   (Cache +   │        │
│  │             │                    │Rate Limiting)│        │
│  └─────────────┘                    └──────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User copies text** → Client detects clipboard change
2. **Client encrypts** → AES-GCM with device key
3. **Client uploads** → POST /clipboard/update with encrypted payload
4. **Server stores** → Encrypted content saved to PostgreSQL
5. **Server broadcasts** → WebSocket message to all user's devices
6. **Clients receive** → Decrypt and update local clipboard
7. **Total latency** → < 2 seconds

## 🛠️ Tech Stack

### Backend
- **Framework**: FastAPI 0.109
- **Language**: Python 3.11+
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **WebSocket**: uvicorn with websockets
- **Authentication**: JWT (python-jose)
- **Encryption**: cryptography, PyCryptodome

### Web Client
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **HTTP Client**: Axios
- **Encryption**: Web Crypto API
- **WebSocket**: Native WebSocket API

### Mobile Client
- **Framework**: React Native
- **Language**: TypeScript
- **Navigation**: React Navigation
- **State**: React Context
- **Encryption**: react-native-aes-crypto

### DevOps
- **Containerization**: Docker
- **Orchestration**: Docker Compose
- **Reverse Proxy**: Nginx
- **CI/CD**: GitHub Actions
- **SSL**: Let's Encrypt

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- (For development) Python 3.11+, Node.js 18+, PostgreSQL 16+

### Using Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/clipboard-sync.git
cd clipboard-sync

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f backend
```

The services will be available at:
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Database**: localhost:5432
- **Web Client**: http://localhost:3000 (separate setup required)

## 📦 Installation

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Setup environment variables
cp .env.example .env
# Edit .env with your configuration

# Initialize database
python -c "from app.core.database import init_db; init_db()"

# Run server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Web Client Setup

```bash
cd web-client

# Install dependencies
npm install

# Setup environment
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
echo "NEXT_PUBLIC_WS_URL=ws://localhost:8000" >> .env.local

# Run development server
npm run dev
```

Access the web client at http://localhost:3000

### Database Setup

```bash
# Using Docker
docker run -d \
  --name clipboard-postgres \
  -e POSTGRES_DB=clipboard_sync \
  -e POSTGRES_USER=clipuser \
  -e POSTGRES_PASSWORD=clippass \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:16-alpine

# Initialize schema
docker exec -i clipboard-postgres psql -U clipuser -d clipboard_sync < database/init.sql
```

## ⚙️ Configuration

### Environment Variables

**Backend (.env)**
```bash
# Database
DATABASE_URL=postgresql://clipuser:clippass@localhost:5432/clipboard_sync

# JWT
JWT_SECRET_KEY=your-256-bit-secret-key-change-this
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=10080  # 7 days

# API
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=False

# CORS
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com

# Redis
REDIS_URL=redis://localhost:6379/0

# Security
BCRYPT_ROUNDS=12

# Clipboard
MAX_CLIPBOARD_ITEMS_PER_USER=20
MAX_CLIPBOARD_CONTENT_SIZE=10485760  # 10MB
```

**Web Client (.env.local)**
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

## 📚 API Documentation

### Authentication Endpoints

#### POST /api/v1/auth/register
Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "user_id": "uuid-here"
}
```

#### POST /api/v1/auth/login
Login with credentials.

#### GET /api/v1/auth/me
Get current user information (requires auth).

### Device Endpoints

#### POST /api/v1/device/register
Register a new device for the current user.

**Request:**
```json
{
  "device_name": "John's iPhone",
  "device_type": "ios",
  "device_info": {
    "user_agent": "...",
    "platform": "iOS 17"
  }
}
```

#### GET /api/v1/device/list
List all registered devices.

### Clipboard Endpoints

#### POST /api/v1/clipboard/update
Create a new clipboard item (encrypted).

**Request:**
```json
{
  "encrypted_content": "base64-encoded-ciphertext",
  "iv": "base64-encoded-iv",
  "content_hash": "sha256-hash",
  "content_type": "text",
  "content_size": 1024
}
```

#### GET /api/v1/clipboard/history?page=1&page_size=20
Get clipboard history with pagination.

#### GET /api/v1/clipboard/latest
Get the most recent clipboard item.

#### DELETE /api/v1/clipboard/{item_id}
Delete a specific clipboard item.

#### DELETE /api/v1/clipboard/clear
Clear all clipboard history.

### WebSocket Endpoint

#### WS /ws/clipboard?token={jwt_token}
Real-time clipboard synchronization.

**Messages:**
- `clipboard_update`: New clipboard item synced
- `ping/pong`: Heartbeat
- `connected`: Connection confirmed

Full API documentation available at: http://localhost:8000/docs

## 🔐 Security

### Encryption Architecture

1. **Client-Side Encryption**: All content is encrypted on the client using AES-GCM-256
2. **Key Management**: Each device generates a unique encryption key stored in secure storage
3. **Server Storage**: Server only stores encrypted ciphertext + IV
4. **Transport Security**: All communications over HTTPS/WSS

### Encryption Flow

```python
# Client-side encryption
plaintext = "Hello World"
key = generate_key()  # 256-bit AES key
iv = random_bytes(12)  # 96-bit IV for GCM
ciphertext = AES_GCM_encrypt(plaintext, key, iv)

# Send to server
POST /clipboard/update
{
  "encrypted_content": base64(ciphertext),
  "iv": base64(iv),
  "content_hash": sha256(plaintext)
}

# Server broadcasts to other devices
# Other devices decrypt
decrypted = AES_GCM_decrypt(ciphertext, key, iv)
```

### Threat Model

- ✅ **Protects against**: Server compromise, MITM attacks, database leaks
- ⚠️ **Does not protect against**: Client-side malware, physical device access
- 🔒 **Best practices**: Use strong passwords, keep devices secure, enable 2FA (future)

## 💻 Development

### Running Tests

```bash
# Backend tests
cd backend
pytest tests/ -v --cov=app --cov-report=html

# Web client tests
cd web-client
npm test
npm run type-check
```

### Code Quality

```bash
# Python linting
cd backend
black app/ tests/
flake8 app/

# TypeScript linting
cd web-client
npm run lint
```

### Database Migrations

```bash
# Create migration
alembic revision --autogenerate -m "Description"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

## 🚢 Deployment

### Production Deployment with Docker

```bash
# Build and start
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose logs -f

# Scale backend
docker-compose up -d --scale backend=3
```

### SSL Certificate Setup

```bash
# Using Let's Encrypt with Certbot
certbot certonly --standalone -d yourdomain.com

# Copy certificates
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/

# Restart Nginx
docker-compose restart nginx
```

### Environment-Specific Configuration

| Environment | Debug | Database | CORS | SSL |
|------------|-------|----------|------|-----|
| Development | True | SQLite/Postgres local | localhost:3000 | Optional |
| Staging | False | Postgres (cloud) | staging.domain.com | Required |
| Production | False | Postgres (HA) | app.domain.com | Required |

## 🧪 Testing

### Test Coverage

```bash
# Run all tests with coverage
pytest --cov=app --cov-report=term-missing

# Load testing with Locust
locust -f tests/load_test.py --host=http://localhost:8000
```

### Manual Testing Checklist

- [ ] User registration and login
- [ ] Device registration
- [ ] Clipboard copy on Device A
- [ ] Clipboard appears on Device B within 2 seconds
- [ ] Encryption/decryption works correctly
- [ ] WebSocket reconnection after disconnect
- [ ] History pagination
- [ ] Delete clipboard items
- [ ] Clear all history
- [ ] Logout clears local encryption key

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📧 Contact

- **Project Maintainer**: Your Name
- **Email**: your.email@example.com
- **Project Link**: https://github.com/yourusername/clipboard-sync

---

**Built with ❤️ for seamless cross-device clipboard synchronization**
