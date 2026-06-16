-- Aligne dev.db sur l'historique des migrations (CheckFlowSettings + RefreshToken).
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CheckFlowSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'check_flow_settings',
    "checkOutUsesCheckInForm" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CheckFlowSettings" ("checkOutUsesCheckInForm", "id", "updatedAt") SELECT "checkOutUsesCheckInForm", "id", "updatedAt" FROM "CheckFlowSettings";
DROP TABLE "CheckFlowSettings";
ALTER TABLE "new_CheckFlowSettings" RENAME TO "CheckFlowSettings";
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
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RefreshToken" ("createdAt", "expiresAt", "id", "ip", "lastSeenAt", "revokedAt", "tokenHash", "userAgent", "userId") SELECT "createdAt", "expiresAt", "id", "ip", coalesce("lastSeenAt", CURRENT_TIMESTAMP) AS "lastSeenAt", "revokedAt", "tokenHash", "userAgent", "userId" FROM "RefreshToken";
DROP TABLE "RefreshToken";
ALTER TABLE "new_RefreshToken" RENAME TO "RefreshToken";
CREATE INDEX "RefreshToken_lastSeenAt_idx" ON "RefreshToken"("lastSeenAt" ASC);
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId" ASC);
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash" ASC);
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
