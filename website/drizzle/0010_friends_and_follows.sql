ALTER TYPE "notification_type" ADD VALUE 'FRIEND_REQUEST';--> statement-breakpoint
ALTER TYPE "notification_type" ADD VALUE 'FRIEND_ACCEPTED';--> statement-breakpoint
ALTER TYPE "notification_type" ADD VALUE 'NEW_FOLLOWER';--> statement-breakpoint
CREATE TYPE "friend_request_status" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "disable_follow_notifications" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "friend_request" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"receiver_id" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"status" "friend_request_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	CONSTRAINT "friend_request_unique" UNIQUE("sender_id","receiver_id"),
	CONSTRAINT "no_self_friend_request" CHECK ("sender_id" != "receiver_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_friend" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"friend_id" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_friend_unique" UNIQUE("user_id","friend_id"),
	CONSTRAINT "no_self_friend" CHECK ("user_id" != "friend_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_follow" (
	"id" serial PRIMARY KEY NOT NULL,
	"follower_id" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"following_id" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_follow_unique" UNIQUE("follower_id","following_id"),
	CONSTRAINT "no_self_follow" CHECK ("follower_id" != "following_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "friend_request_sender_id_idx" ON "friend_request" ("sender_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "friend_request_receiver_id_idx" ON "friend_request" ("receiver_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "friend_request_receiver_pending_idx" ON "friend_request" ("receiver_id") WHERE status = 'PENDING';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_friend_user_id_idx" ON "user_friend" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_friend_friend_id_idx" ON "user_friend" ("friend_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_follow_follower_id_idx" ON "user_follow" ("follower_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_follow_following_id_idx" ON "user_follow" ("following_id");
