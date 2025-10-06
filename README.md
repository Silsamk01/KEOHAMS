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


### Blog Modernization (Oct 2025)
The public blog UI has been upgraded for a more contemporary UX:

	- Split public vs authenticated views (`/blog-public` for anonymous, `/blog` for signed-in users). Anonymous users are redirected if they visit the private route without a token.
New assets:
- `frontend/src/css/blog-modern.css`
API enhancement:
- `GET /api/blog?meta=1` now returns `{ page, pageSize, total, hasMore, data:[...] }` and auto-generates an excerpt (first 160 chars of content) if none stored.

## Public vs Authenticated Blog
Anonymous visitors access `/blog-public`, which lists only posts that do not require login. Authenticated users access `/blog` (dashboard chrome, infinite scroll). Attempting to load `/blog` without a valid token now shows a notice then redirects to `/blog-public`.

Backlog suggestions (not yet implemented): categories/tags taxonomy, full-text search (MySQL MATCH/AGAINST or external search), server-side filtering, image covers, content sanitization + markdown parser (e.g., `marked` + DOMPurify), caching of count totals, prefetch next post.

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

## Verification & Risk System (Oct 2025)

The platform implements an internal multi-phase verification & risk scoring layer to classify user trust and gate sensitive actions.

### Data Model
Tables introduced / extended:
- `user_verification_state` – one row per user tracking `status`, `risk_score`, `risk_level`, timestamps, lock flags.
- `risk_events` – append-only log of score adjustments (event_type, delta, resulting_score/level, metadata JSON).
- `kyc_submissions` (extended) – now stores document metadata (`doc_country`, `doc_type`, `doc_hash`, `risk_score_at_submission`).

### Status Lifecycle
`UNVERIFIED` → `BASIC_PENDING` → `BASIC_VERIFIED` → `KYC_PENDING` → `KYC_VERIFIED`

Exceptional / terminal-like states:
- `REJECTED` (can re-enter basic collection or resubmit KYC)
- `LOCKED` (manual administrative lock; blocks all gated actions)

### Risk Levels
Score buckets: `LOW <200`, `MEDIUM 200-399`, `HIGH 400-699`, `CRITICAL >=700`.
Events (e.g., `KYC_APPROVED`, `KYC_REJECTED`, `ADMIN_MANUAL_ADJUST`, `ADMIN_LOCK`) adjust the numeric score; level recalculated after each mutation.

### Core Endpoints (User)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/verification/status` | Current status + risk snapshot |
| POST | `/api/verification/basic/trigger` | Tries to promote to BASIC_PENDING when profile minimally complete |
| POST | `/api/verification/kyc/submit` | Submits a KYC package (type, files/meta) → status `KYC_PENDING` |

### Core Endpoints (Admin)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/verification/states` | Paginated verification states |
| GET | `/api/admin/verification/states/:user_id` | Detailed state + recent KYC submissions |
| POST | `/api/admin/verification/kyc/:submission_id/approve` | Approve submission; promotes to `KYC_VERIFIED` & risk -20 |
| POST | `/api/admin/verification/kyc/:submission_id/reject` | Reject submission; sets `REJECTED` & risk +50 |
| POST | `/api/admin/verification/score/:user_id/adjust` | Manual delta adjust (positive or negative) |
| POST | `/api/admin/verification/lock/:user_id` | Lock account (+100 score) |
| POST | `/api/admin/verification/unlock/:user_id` | Unlock account (restores prior tier heuristic, -30) |
| GET | `/api/admin/verification/risk-events/:user_id` | Paginated risk event log |

### Middleware Gating
`requireVerificationTier(minRank)` enforces minimum status rank numerically mapped:
`UNVERIFIED/REJECTED=0, BASIC_PENDING=1, BASIC_VERIFIED=2, KYC_PENDING=3, KYC_VERIFIED=4, LOCKED=-1`.

### Implementation Notes
- `verificationController` centralizes state transitions; always uses `VerificationState.ensureRow()` to avoid race conditions.
- Risk adjustments and events are atomic per request; future improvement: wrap high-impact transitions in a DB transaction if multi-table writes expand.
- Administrative actions generate corresponding risk events ensuring auditability.
- Score never drops below zero; ceiling left unbounded for anomaly detection.

### Future Enhancements
- Device / IP reputation events (login velocity, geo mismatch).
- Automated escalation: auto-lock if level reaches CRITICAL.
- Periodic recomputation task consolidating stale risk heuristics.
- Webhook or notification fan-out on status changes for frontend real-time UX.

## Account Session Security (Oct 2025 Additions)

To harden authentication integrity and allow immediate session invalidation:

### Token Versioning
- `users.token_version` added (default 1). Each JWT now includes `tv` claim.
- Middleware compares token `tv` against current DB value; mismatch returns 401 `Session expired`.
- Increment triggers: password reset, admin explicit revoke, (future) sensitive profile changes.

### Soft Delete
- Admin user deletion now sets `users.deleted_at` instead of hard delete, preserving audit trail.
- Auth middleware rejects deleted users (401 Account removed).

### Audit Trail
- `admin_audit_events` table records: USER_DELETE, TOKEN_REVOKE, PASSWORD_RESET.
- Model: `src/models/adminAuditEvent.js` with `log()` helper for structured JSON metadata.

### New Admin Endpoint
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/admin/users/:id/revoke-tokens` | Increment `token_version`, invalidating all existing JWTs |

### Frontend Auto-Logout
- Global fetch wrapper auto-clears token & redirects on 401/404 from protected endpoints.

### Recommended Next Steps
- Introduce refresh token rotation & allow short-lived (15m) access tokens.
- Build device/session management UI (list + selective revoke).
- Add Socket.IO `forceLogout` broadcast for immediate tab eviction.
- Consider storing hashed refresh tokens with expiration + IP / UA fingerprint.

## Quotation-Based Checkout (Oct 2025)

The platform now supports a quotation workflow instead of immediate checkout:

1. User adds products to cart and clicks the Request Quotation button (cart page).
2. A quotation is created with a snapshot of product titles, unit prices and quantities.
3. User receives a confirmation email and can view all quotations under Dashboard → Quotations (KYC required like other protected panes).
4. Admin reviews the request (future admin UI) and replies by setting logistics amount, discount amount, and allowed payment methods (comma list: `stripe,paystack,crypto`). This transitions status to REPLIED and recalculates totals.
5. User selects a payment method; current implementation returns a placeholder payload referencing environment variables (`STRIPE_PUBLISHABLE_KEY`, `PAYSTACK_PUBLIC_KEY`, `CRYPTO_PAYMENT_ADDRESS`).
6. After payment confirmation (future real integration / webhook), admin (or automation) marks the quotation PAID.
7. Statuses: REQUESTED → REPLIED → PAID (or CANCELLED). Only REPLIED quotations expose the Pay dropdown.

Environment variables (optional):
```
STRIPE_PUBLISHABLE_KEY=pk_test_...
PAYSTACK_PUBLIC_KEY=pk_test_...
CRYPTO_PAYMENT_ADDRESS=0xYourAddress
```

Run migrations if you see: `Quotation system not initialized. Run migrations.`

Frontend module: `frontend/src/js/quotations.js` (lazy loads on first visit to the pane, renders list + detail + payment initiation payload).

Future enhancements:
- Admin quotation management UI (reply / mark paid / cancel)
- Webhook listeners for automatic PAID transition
- PDF quotation export & email attachment
- Per-method dynamic fees & currency conversion
- Expiration timestamps & reminder notifications

### Admin Quotation Management (Oct 2025)
Admin panel now includes a Quotations tab:
* Lazy-loads data on first activation to reduce initial payload.
* Filter by status or user ID.
* Reply form sets logistics fee, discount, allowed payment methods (comma separated) and admin notes.
* Mark Paid available only when status = REPLIED.
* Cancel available for non-final (not already PAID/CANCELLED) quotations.
* Badge on tab shows count of REQUESTED + REPLIED quotations.

Endpoints leveraged:
```
GET    /api/quotations/admin          (list paginated)
GET    /api/quotations/admin/:id      (detail)
POST   /api/quotations/admin/:id/reply
POST   /api/quotations/admin/:id/mark-paid
POST   /api/quotations/admin/:id/cancel
```

Front-end module: `frontend/src/js/adminQuotations.js` (dynamically imported in `admin.js`).

Pricing Snapshot: Each quotation stores a snapshot of product `unit_price` and derives `line_total` and `subtotal_amount` at creation time to ensure later product price changes do not mutate historical quotation values.
Fallback Price Fields: When capturing an item's unit price, the system checks (in order) `price`, `unit_price`, `price_per_unit`, `base_price`, `amount` and uses the first non-negative numeric value. If none exist it records 0 and the UI flags the zero-priced row.



