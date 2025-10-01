# KEOHAMS E-Commerce Platform

Monorepo for wholesale e-commerce platform (Node.js/Express, MySQL, Socket.IO, Vanilla JS + Bootstrap).

Backend is being scaffolded: run from `backend` with `npm run dev` after creating `.env` from `.env.example` and running DB migrations.

Key flows:
- Registration requires captcha and DOB>=18; email verification link creates the account. On success, user is auto-signed-in and redirected to `/dashboard` to complete KYC.
- User dashboard (`/dashboard`) lets users upload KYC (portrait, selfie video, ID front/back). Admin reviews in `/admin`.

Scripts:
- `npm run db:create` then `npm run migrate` to set up DB.
- `node scripts/testEmail.js` to verify SMTP.

Scripts:
- `npm run db:create` then `npm run migrate` to set up DB.

