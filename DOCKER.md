# KEOHAMS Docker Deployment Guide

## Building the Image

```bash
# From project root
docker build -t keohams:latest .
```

## Running the Container

### Development
```bash
docker run -d \
  --name keohams \
  -p 8000:80 \
  -e APP_ENV=local \
  -e APP_DEBUG=true \
  -e DB_HOST=host.docker.internal \
  -e DB_DATABASE=keohams \
  -e DB_USERNAME=root \
  -e DB_PASSWORD=password \
  -e REDIS_HOST=host.docker.internal \
  keohams:latest
```

### Production
```bash
docker run -d \
  --name keohams \
  -p 80:80 \
  --env-file laravel/.env.production \
  --restart unless-stopped \
  keohams:latest
```

## With Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "80:80"
    environment:
      - APP_ENV=production
      - APP_DEBUG=false
    env_file:
      - laravel/.env.production
    depends_on:
      - db
      - redis
    volumes:
      - ./laravel/storage:/var/www/html/storage
      - ./laravel/public:/var/www/html/public
    restart: unless-stopped

  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: secret
      MYSQL_DATABASE: keohams
    volumes:
      - db_data:/var/lib/mysql
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

volumes:
  db_data:
```

Then run:
```bash
docker-compose up -d
```

## Accessing the Container

```bash
# Shell access
docker exec -it keohams sh

# Run artisan commands
docker exec keohams php artisan migrate
docker exec keohams php artisan db:seed

# View logs
docker logs -f keohams
```

## Environment Variables

Required variables (set via `-e` flag or `.env` file):
- `APP_KEY` - Laravel encryption key
- `DB_HOST`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`
- `REDIS_HOST` (optional but recommended)
- `MAIL_*` variables for email functionality

## Health Check

```bash
curl http://localhost:8000/api/health
```

## Production Checklist

- [ ] Set `APP_ENV=production`
- [ ] Set `APP_DEBUG=false`
- [ ] Generate strong `APP_KEY`
- [ ] Configure proper database credentials
- [ ] Set up Redis for caching
- [ ] Configure mail settings
- [ ] Set up SSL/TLS (use nginx reverse proxy or load balancer)
- [ ] Configure backup strategy for volumes
- [ ] Set up monitoring and logging

## Notes

- The container runs nginx + PHP-FPM + queue workers via Supervisor
- Static assets are served directly by nginx
- Queue workers automatically restart on failure
- Logs are available in `/var/www/html/storage/logs/`
