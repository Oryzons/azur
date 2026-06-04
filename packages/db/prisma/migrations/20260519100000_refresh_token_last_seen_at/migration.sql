-- AlterTable (SQLite: pas de DEFAULT dynamique sur ADD COLUMN)
ALTER TABLE "RefreshToken" ADD COLUMN "lastSeenAt" DATETIME;

UPDATE "RefreshToken" SET "lastSeenAt" = "createdAt" WHERE "lastSeenAt" IS NULL;

-- CreateIndex
CREATE INDEX "RefreshToken_lastSeenAt_idx" ON "RefreshToken"("lastSeenAt");
