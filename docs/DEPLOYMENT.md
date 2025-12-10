# Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Docker Deployment](#docker-deployment)
4. [SSL Configuration](#ssl-configuration)
5. [Database Setup](#database-setup)
6. [Scaling](#scaling)
7. [Monitoring](#monitoring)
8. [Backup & Recovery](#backup--recovery)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements
- **OS**: Ubuntu 22.04 LTS (recommended) or any Linux distribution
- **RAM**: Minimum 2GB, Recommended 4GB+
- **CPU**: 2 cores minimum
- **Disk**: 20GB minimum (SSD recommended)
- **Network**: Static IP or domain name

### Software Requirements
- Docker 24.0+
- Docker Compose 2.20+
- (Optional) Certbot for SSL certificates

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/clipboard-sync.git
cd clipboard-sync
```

### 2. Configure Environment Variables

```bash
# Copy example environment file
cp backend/.env.example backend/.env

# Edit with production values
nano backend/.env
```

**Production .env:**
```bash
# Database
DATABASE_URL=postgresql://clipuser:STRONG_PASSWORD@db:5432/clipboard_sync

# JWT (Generate secure key)
JWT_SECRET_KEY=$(openssl rand -hex 32)
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=10080

# API
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=False

# CORS (Your frontend domains)
CORS_ORIGINS=https://app.yourdomain.com,https://www.yourdomain.com

# Redis
REDIS_URL=redis://redis:6379/0

# Security
BCRYPT_ROUNDS=12

# Clipboard
MAX_CLIPBOARD_ITEMS_PER_USER=20
MAX_CLIPBOARD_CONTENT_SIZE=10485760
```

### 3. Generate Secrets

```bash
# Generate JWT secret
openssl rand -hex 32

# Generate database password
openssl rand -base64 24
```

## Docker Deployment

### Development Deployment

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

### Production Deployment

```bash
# Use production compose file
docker-compose -f docker-compose.prod.yml up -d

# Verify services
docker-compose -f docker-compose.prod.yml ps

# Check health
curl http://localhost/health
```

### Service Management

```bash
# Stop services
docker-compose down

# Restart specific service
docker-compose restart backend

# View service logs
docker-compose logs -f backend

# Execute command in container
docker-compose exec backend bash
```

## SSL Configuration

### Using Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt update
sudo apt install certbot

# Stop Nginx temporarily
docker-compose stop nginx

# Obtain certificate
sudo certbot certonly --standalone \
  -d yourdomain.com \
  -d www.yourdomain.com \
  --email your@email.com \
  --agree-tos

# Copy certificates to nginx directory
sudo mkdir -p nginx/ssl
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/

# Update permissions
sudo chmod 644 nginx/ssl/*.pem

# Update nginx.conf (uncomment HTTPS server block)
# Restart Nginx
docker-compose up -d nginx
```

### Certificate Renewal

```bash
# Add to crontab
sudo crontab -e

# Add this line (runs daily at 2 AM)
0 2 * * * certbot renew --quiet && cp /etc/letsencrypt/live/yourdomain.com/*.pem /path/to/nginx/ssl/ && docker-compose restart nginx
```

### Manual SSL Setup

```bash
# Create SSL directory
mkdir -p nginx/ssl

# Copy your certificates
cp fullchain.pem nginx/ssl/
cp privkey.pem nginx/ssl/

# Update nginx.conf with SSL configuration
```

## Database Setup

### Initial Setup

```bash
# Database is auto-initialized via Docker Compose
# To manually initialize:
docker-compose exec db psql -U clipuser -d clipboard_sync -f /docker-entrypoint-initdb.d/init.sql
```

### Backup Database

```bash
# Create backup
docker-compose exec -T db pg_dump -U clipuser clipboard_sync > backup_$(date +%Y%m%d_%H%M%S).sql

# Automated backups (add to crontab)
0 3 * * * /path/to/backup-script.sh
```

**backup-script.sh:**
```bash
#!/bin/bash
BACKUP_DIR="/backups/clipboard-sync"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
docker-compose exec -T db pg_dump -U clipuser clipboard_sync | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete
```

### Restore Database

```bash
# Restore from backup
gunzip -c backup_20251125_120000.sql.gz | docker-compose exec -T db psql -U clipuser clipboard_sync
```

## Scaling

### Horizontal Scaling (Multiple Backend Instances)

```bash
# Scale backend to 3 instances
docker-compose up -d --scale backend=3

# Nginx will automatically load balance
```

### Database Scaling

For production, consider:
- **Primary-Replica**: PostgreSQL streaming replication
- **Connection Pooling**: PgBouncer
- **Managed Database**: AWS RDS, Google Cloud SQL, Azure Database

### Redis Scaling

```bash
# Redis Cluster for high availability
# Update docker-compose with Redis Cluster configuration
```

## Monitoring

### Health Checks

```bash
# Application health
curl http://localhost/health

# Database health
docker-compose exec db pg_isready

# Redis health
docker-compose exec redis redis-cli ping
```

### Logging

```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f backend

# Follow last 100 lines
docker-compose logs --tail=100 -f backend

# Export logs
docker-compose logs > logs_$(date +%Y%m%d).txt
```

### Monitoring Tools (Optional)

```bash
# Prometheus + Grafana
docker-compose -f docker-compose.monitoring.yml up -d

# Access Grafana
http://localhost:3001
```

## Backup & Recovery

### Full System Backup

```bash
#!/bin/bash
# backup-full.sh
BACKUP_ROOT="/backups/clipboard-sync"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup database
docker-compose exec -T db pg_dump -U clipuser clipboard_sync | gzip > $BACKUP_ROOT/db_$DATE.sql.gz

# Backup Redis
docker-compose exec -T redis redis-cli SAVE
docker cp clipboard-sync-redis:/data/dump.rdb $BACKUP_ROOT/redis_$DATE.rdb

# Backup environment files
tar -czf $BACKUP_ROOT/config_$DATE.tar.gz backend/.env nginx/nginx.conf
```

### Disaster Recovery

```bash
# 1. Restore database
gunzip -c db_backup.sql.gz | docker-compose exec -T db psql -U clipuser clipboard_sync

# 2. Restore Redis
docker cp redis_backup.rdb clipboard-sync-redis:/data/dump.rdb
docker-compose restart redis

# 3. Restore configuration
tar -xzf config_backup.tar.gz

# 4. Restart all services
docker-compose down
docker-compose up -d
```

## Troubleshooting

### Common Issues

**1. Database Connection Failed**
```bash
# Check database logs
docker-compose logs db

# Verify connection string
docker-compose exec backend env | grep DATABASE_URL

# Test connection
docker-compose exec backend python -c "from app.core.database import engine; engine.connect()"
```

**2. WebSocket Not Connecting**
```bash
# Check Nginx WebSocket configuration
docker-compose exec nginx cat /etc/nginx/nginx.conf | grep -A 10 "location /ws"

# Test WebSocket endpoint
wscat -c ws://localhost/ws/clipboard?token=YOUR_TOKEN
```

**3. High Memory Usage**
```bash
# Check container stats
docker stats

# Limit container memory
docker-compose down
# Edit docker-compose.yml to add memory limits
docker-compose up -d
```

**4. SSL Certificate Issues**
```bash
# Verify certificate
openssl x509 -in nginx/ssl/fullchain.pem -text -noout

# Check Nginx SSL configuration
docker-compose exec nginx nginx -t
```

### Performance Tuning

**PostgreSQL:**
```sql
-- Increase connections
ALTER SYSTEM SET max_connections = 200;

-- Optimize shared buffers
ALTER SYSTEM SET shared_buffers = '256MB';

-- Restart
docker-compose restart db
```

**Backend:**
```yaml
# In docker-compose.yml
backend:
  command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## Security Checklist

- [ ] Change all default passwords
- [ ] Generate strong JWT secret
- [ ] Enable SSL/TLS
- [ ] Configure firewall (allow only 80, 443)
- [ ] Enable rate limiting
- [ ] Regular security updates
- [ ] Implement backup strategy
- [ ] Monitor logs for suspicious activity
- [ ] Use secrets management (Docker Secrets, Vault)

## Next Steps

1. Set up monitoring and alerts
2. Configure automated backups
3. Implement log aggregation (ELK, Loki)
4. Set up CDN for static assets (CloudFlare)
5. Configure auto-scaling (Kubernetes, Docker Swarm)
6. Implement disaster recovery plan

---

For more help, see the [main README](../README.md) or [API documentation](API.md).
