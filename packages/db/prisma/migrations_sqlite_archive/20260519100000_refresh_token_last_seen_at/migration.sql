-- SQLite : recréation de table pour lastSeenAt NOT NULL + index.
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "userAgent" TEXT,
    "ip" TEXT,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RefreshToken" (
    "id", "userId", "tokenHash", "expiresAt", "revokedAt", "userAgent", "ip", "lastSeenAt", "createdAt"
)
SELECT
    "id", "userId", "tokenHash", "expiresAt", "revokedAt", "userAgent", "ip", COALESCE("lastSeenAt", "createdAt"), "createdAt"
FROM "RefreshToken";
DROP TABLE "RefreshToken";
ALTER TABLE "new_RefreshToken" RENAME TO "RefreshToken";
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");
CREATE INDEX "RefreshToken_lastSeenAt_idx" ON "RefreshToken"("lastSeenAt");
PRAGMA foreign_keys=ON;
