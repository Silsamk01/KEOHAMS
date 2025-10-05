# KEOHAMS E-Commerce Platform

Monorepo for wholesale e-commerce platform (Node.js/Express, MySQL, Socket.IO, Vanilla JS + Bootstrap).

Backend is being scaffolded: run from `backend` with `npm run dev` after creating `.env` from `.env.example` and running DB migrations.

Key flows:
- Registration requires captcha and DOB>=18; email verification link creates the account. On success, user is auto-signed-in and redirected to `/dashboard` to complete KYC.
- User dashboard (`/dashboard`) lets users upload KYC (portrait, selfie video, ID front/back). Admin reviews in `/admin`.

Scripts:
- `npm run db:create` then `npm run migrate` to set up DB.
- `node scripts/testEmail.js` to verify SMTP.

## New Features (Oct 2025)

### Currency Converter
Authenticated users now have a "Quick Currency Converter" widget on their dashboard overview. It:
- Supports a curated set of currencies (USD, EUR, GBP, NGN, GHS, KES, ZAR, JPY, CAD, AUD)
- Uses the endpoint: `/api/currency/convert?from=USD&to=NGN&amount=1` (auth required)
- Caches upstream exchange rates for 10 minutes (configurable). Fallback reference rates are used if the external API is unreachable.

Optional environment variable: `EXCHANGE_RATES_BASE_URL` (defaults to https://api.exchangerate.host/latest).

### Chat System Improvements
- Message input validation (length limit, whitespace trimming) to reduce noise and potential abuse.
- Frontend badge syncing reliability improvements.

### Profile Name Lock
The display name field has been locked in both standalone and embedded settings UIs. Users can no longer edit their name; only phone updates are sent to the server. If stronger enforcement is required, ensure the backend `PATCH /user/profile` route ignores or rejects incoming `name` fields from non-admin contexts.

### Profile Display Simplification (Oct 2025)
Profile section now renders read-only: Name, Phone, Age (derived from stored DOB). All editing, avatar changes, and phone updates were removed from the public UI to reduce PII handling surface.


## Scalability & Performance Architecture (Oct 2025)

This codebase has been prepared for higher traffic with the following layers:

### Database
- Added composite and selective indexes (`20251004_013_add_indexes.js`) on: users(email,name), products(category_id,created_at), notifications(user_id, read_at), chats(owner_id), chat_messages(thread_id, created_at).
- Connection pool (Knex) defaults to `max:10`; tune via env: `DB_POOL_MAX` (extend knex config to read if needed).

### Caching
- In-memory TTL cache middleware (`src/middlewares/cache.js`) applied to high-read endpoints: categories (5m), products list (30s), blog list (60s), currency rates (5m).
- Future: swap to Redis by replacing the in-memory Map with `ioredis` operations while preserving the middleware contract.

### HTTP Layer
- Strong ETags enabled (`app.set('etag','strong')`) for client-side cache validation.
- Compression with threshold (1KB) to avoid CPU overhead on tiny payloads.
- Helmet CSP tightened; `trust proxy` enabled for deployment behind a load balancer.
- Rate limiter on `/api/auth`; recommend extending to other sensitive routes (password reset, verification triggers) and adding user-based + IP-based layered limits.

### Logging & Observability
- Structured logging via Pino (`src/utils/logger.js`) with pretty output in development and JSON in production.
- Global handlers for `unhandledRejection` and `uncaughtException` for crash diagnostics.
- Recommendation: Ship logs to ELK / Loki / CloudWatch; set `LOG_LEVEL=warn` under extreme load to reduce I/O.

### Horizontal Scaling
- `src/cluster.js` enables multi-core usage (`npm run start:cluster`).
- Socket.IO rooms used for notifications and chats; for multi-instance deployment attach a message broker (Redis adapter) so events propagate: `io.adapter(createAdapter(redisClient, subClient))`.
- Containerization: see `Dockerfile` and `.dockerignore`. Build and run:
	```bash
	docker build -t keohams:latest .
	docker run -p 4000:4000 --env-file backend/.env keohams:latest
	```

### Frontend Performance
- ESBuild bundling script (`scripts/buildFrontend.js`) bundles all JS in `frontend/src/js` into `frontend/dist` (ESM splitting). Add hashed filenames and reference them in HTML for long-term caching as a next step.
- Recommend deferring non-critical scripts and using preconnect hints (already present for fonts).

### Future Hardening Roadmap
- Replace in-memory cache with Redis cluster for eviction policy and shared state.
- Implement distributed rate limiting (Redis + token bucket) and add circuit breakers for upstream currency API.
- Add background job queue (BullMQ / RabbitMQ) for email, notification fan-out, and heavy KYC processing.
- Introduce integration tests (Jest) and load tests (k6 or Artillery) before major releases.
- Add health checks: `/api/health` already exists; extend with DB ping + build SHA.
- Add feature flags (e.g., via simple table or LaunchDarkly) for gradual rollouts.

### Environment Variables (Suggested Additions)
| Variable | Purpose |
|----------|---------|
| LOG_LEVEL | Adjust pino logging verbosity (info / warn / error) |
| WEB_CONCURRENCY | Worker count for cluster mode |
| CACHE_DISABLE | If set, bypass cache middleware (ops toggle) |

---
For sustained heavy traffic, deploy: MySQL (managed service) + Redis (cache & Socket.IO adapter) + container orchestrator (Kubernetes / ECS) + CDN in front of static assets.


