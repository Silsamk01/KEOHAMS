-- Fix corrupted migration record
-- Run this in your MySQL database (keohams)

-- Check current migrations
SELECT * FROM knex_migrations ORDER BY id DESC LIMIT 10;

-- Delete the corrupted migration record
DELETE FROM knex_migrations WHERE name = '20251018021026_kyc_submissions.js';

-- Verify it's removed
SELECT * FROM knex_migrations ORDER BY id DESC LIMIT 10;
