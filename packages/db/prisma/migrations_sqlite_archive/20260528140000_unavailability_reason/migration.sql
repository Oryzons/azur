-- Add reason to BoatUnavailability (SQLite)
ALTER TABLE "BoatUnavailability" ADD COLUMN "reason" TEXT NOT NULL DEFAULT 'OTHER';

