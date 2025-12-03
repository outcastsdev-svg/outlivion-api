-- Migration: Add login_sessions table for Telegram Bot deep-link authentication
-- Date: 2025-12-03

CREATE TABLE IF NOT EXISTS "login_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" varchar(255) NOT NULL UNIQUE,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"telegram_id" varchar(255),
	"user_id" uuid,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "login_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "login_sessions_token_idx" ON "login_sessions" ("token");
CREATE INDEX IF NOT EXISTS "login_sessions_status_idx" ON "login_sessions" ("status");
CREATE INDEX IF NOT EXISTS "login_sessions_expires_at_idx" ON "login_sessions" ("expires_at");

-- Add check constraint for status
ALTER TABLE "login_sessions" ADD CONSTRAINT "login_sessions_status_check" 
CHECK ("status" IN ('pending', 'approved', 'expired'));

