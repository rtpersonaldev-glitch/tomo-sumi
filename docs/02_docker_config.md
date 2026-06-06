# Docker構成

## 構成概要

| サービス | コンテナ名 | ポート | 説明 |
|---------|----------|--------|------|
| frontend | tomo-frontend | 5173→5173（開発）/ 80（本番） | React + Vite |
| backend | tomo-backend | 8000→8000 | FastAPI + Uvicorn |
| worker | tomo-worker | - | Celery Worker |
| beat | tomo-beat | - | Celery Beat（定期タスク） |
| db | tomo-db | 5432→5432 | PostgreSQL 16 |
| redis | tomo-redis | 6379→6379 | Redis 7 |
| nginx | tomo-nginx | 80→80 / 443→443 | リバースプロキシ（本番のみ） |

---

## docker-compose.yml（本番用）

```yaml
services:
  frontend:
    build:
      context: ./frontend
      dockerfile: ../docker/frontend/Dockerfile
    container_name: tomo-frontend
    environment:
      - VITE_API_BASE_URL=${API_BASE_URL}
      - VITE_APP_NAME=${APP_NAME}
    depends_on:
      - backend

  backend:
    build:
      context: ./backend
      dockerfile: ../docker/backend/Dockerfile
    container_name: tomo-backend
    volumes:
      - media_volume:/app/media
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - SECRET_KEY=${SECRET_KEY}
      - ACCESS_TOKEN_EXPIRE_MINUTES=${ACCESS_TOKEN_EXPIRE_MINUTES}
      - REFRESH_TOKEN_EXPIRE_DAYS=${REFRESH_TOKEN_EXPIRE_DAYS}
      - CORS_ORIGINS=${CORS_ORIGINS}
      - FIREBASE_SERVICE_ACCOUNT_PATH=/app/firebase_service_account.json
    volumes:
      - media_volume:/app/media
      - ./backend/firebase_service_account.json:/app/firebase_service_account.json:ro
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy

  worker:
    build:
      context: ./backend
      dockerfile: ../docker/backend/Dockerfile
    container_name: tomo-worker
    command: celery -A app.tasks.celery_app worker --loglevel=info --concurrency=4
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - SECRET_KEY=${SECRET_KEY}
      - FIREBASE_SERVICE_ACCOUNT_PATH=/app/firebase_service_account.json
    volumes:
      - media_volume:/app/media
      - ./backend/firebase_service_account.json:/app/firebase_service_account.json:ro
    depends_on:
      - backend
      - redis

  beat:
    build:
      context: ./backend
      dockerfile: ../docker/backend/Dockerfile
    container_name: tomo-beat
    command: celery -A app.tasks.celery_app beat --loglevel=info
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - worker

  db:
    image: postgres:16-alpine
    container_name: tomo-db
    environment:
      - POSTGRES_DB=${POSTGRES_DB}
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_volume:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: tomo-redis
    command: redis-server --appendonly yes
    volumes:
      - redis_volume:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  nginx:
    image: nginx:alpine
    container_name: tomo-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - media_volume:/app/media:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - frontend
      - backend

volumes:
  postgres_volume:
  redis_volume:
  media_volume:
```

---

## docker-compose.dev.yml（開発用）

```yaml
services:
  frontend:
    build:
      context: ./frontend
      dockerfile: ../docker/frontend/Dockerfile.dev
    container_name: tomo-frontend-dev
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - VITE_API_BASE_URL=http://localhost:8000
      - VITE_WS_BASE_URL=ws://localhost:8000

  backend:
    build:
      context: ./backend
      dockerfile: ../docker/backend/Dockerfile.dev
    container_name: tomo-backend-dev
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
      - media_dev_volume:/app/media
    environment:
      - DATABASE_URL=postgresql+asyncpg://tomo:tomo@db:5432/tomo_dev
      - REDIS_URL=redis://redis:6379/0
      - SECRET_KEY=dev-secret-key-change-in-production
      - DEBUG=true
      - CORS_ORIGINS=http://localhost:5173
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy

  worker:
    build:
      context: ./backend
      dockerfile: ../docker/backend/Dockerfile.dev
    container_name: tomo-worker-dev
    command: celery -A app.tasks.celery_app worker --loglevel=debug --concurrency=2
    volumes:
      - ./backend:/app
    environment:
      - DATABASE_URL=postgresql+asyncpg://tomo:tomo@db:5432/tomo_dev
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - backend

  beat:
    build:
      context: ./backend
      dockerfile: ../docker/backend/Dockerfile.dev
    container_name: tomo-beat-dev
    command: celery -A app.tasks.celery_app beat --loglevel=debug
    volumes:
      - ./backend:/app
    environment:
      - DATABASE_URL=postgresql+asyncpg://tomo:tomo@db:5432/tomo_dev
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - worker

  db:
    image: postgres:16-alpine
    container_name: tomo-db-dev
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=tomo_dev
      - POSTGRES_USER=tomo
      - POSTGRES_PASSWORD=tomo
    volumes:
      - postgres_dev_volume:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U tomo -d tomo_dev"]
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:7-alpine
    container_name: tomo-redis-dev
    ports:
      - "6379:6379"
    volumes:
      - redis_dev_volume:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  postgres_dev_volume:
  redis_dev_volume:
  media_dev_volume:
```

---

## Dockerfile（バックエンド本番）

```dockerfile
# docker/backend/Dockerfile
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml poetry.lock ./
RUN pip install poetry && \
    poetry config virtualenvs.create false && \
    poetry install --no-dev

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Dockerfile（バックエンド開発）

```dockerfile
# docker/backend/Dockerfile.dev
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml poetry.lock ./
RUN pip install poetry && \
    poetry config virtualenvs.create false && \
    poetry install

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

## Dockerfile（フロントエンド本番）

```dockerfile
# docker/frontend/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker/nginx/spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

## Dockerfile（フロントエンド開発）

```dockerfile
# docker/frontend/Dockerfile.dev
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

---

## nginx.conf（本番用）

```nginx
# docker/nginx/nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:8000;
    }

    server {
        listen 80;
        server_name _;
        return 301 https://$host$request_uri;
    }

    server {
        listen 443 ssl;
        server_name yourdomain.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        client_max_body_size 20M;

        # フロントエンド SPA
        location / {
            root /usr/share/nginx/html;
            index index.html;
            try_files $uri $uri/ /index.html;
        }

        # バックエンド API
        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        # WebSocket
        location /ws/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        # メディアファイル
        location /media/ {
            alias /app/media/;
            expires 7d;
            add_header Cache-Control "public";
        }
    }
}
```

---

## 開発起動コマンド

```bash
# 初回起動
docker compose -f docker-compose.dev.yml up -d

# DBマイグレーション実行
docker compose -f docker-compose.dev.yml exec backend alembic upgrade head

# ログ確認
docker compose -f docker-compose.dev.yml logs -f backend

# 停止
docker compose -f docker-compose.dev.yml down

# 完全リセット（ボリューム含む）
docker compose -f docker-compose.dev.yml down -v
```

---

> **環境変数の全定義（DATABASE_URL・SECRET_KEY 等）は [10_environment_variables.md](10_environment_variables.md) を参照してください。**  
> docker-compose.dev.yml 内の環境変数はデフォルト値として定義されています。`.env` を作成すれば上書きできます。
