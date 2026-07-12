-- Revoke all active refresh sessions of unverified students
UPDATE "refresh_tokens"
SET "revoked_at" = CURRENT_TIMESTAMP
WHERE "user_id" IN (
  SELECT "id" FROM "users" WHERE "role" = 'student' AND "email_verified_at" IS NULL
) AND "revoked_at" IS NULL;