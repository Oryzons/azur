-- UserRole OWNER + ownerMemberId on User
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "civility" TEXT,
    "phone" TEXT,
    "birthDate" DATETIME,
    "nationality" TEXT,
    "address" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "company" TEXT,
    "avatarUrl" TEXT,
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "ownerMemberId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_ownerMemberId_fkey" FOREIGN KEY ("ownerMemberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("id", "email", "passwordHash", "firstName", "lastName", "civility", "phone", "birthDate", "nationality", "address", "city", "postalCode", "country", "company", "avatarUrl", "role", "isActive", "mustChangePassword", "lastLoginAt", "createdAt") SELECT "id", "email", "passwordHash", "firstName", "lastName", "civility", "phone", "birthDate", "nationality", "address", "city", "postalCode", "country", "company", "avatarUrl", "role", "isActive", "mustChangePassword", "lastLoginAt", "createdAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_ownerMemberId_idx" ON "User"("ownerMemberId");

PRAGMA foreign_keys=ON;

-- BoatUnavailability
CREATE TABLE "BoatUnavailability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boatId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BoatUnavailability_boatId_fkey" FOREIGN KEY ("boatId") REFERENCES "Boat" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BoatUnavailability_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "BoatUnavailability_boatId_idx" ON "BoatUnavailability"("boatId");
CREATE INDEX "BoatUnavailability_startAt_idx" ON "BoatUnavailability"("startAt");

-- InternalNotification: optional reservationId, recipientUserId, unavailabilityId
CREATE TABLE "new_InternalNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "reservationId" TEXT,
    "unavailabilityId" TEXT,
    "submissionId" TEXT,
    "boatName" TEXT,
    "clientName" TEXT,
    "href" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_InternalNotification" ("id", "kind", "title", "message", "reservationId", "submissionId", "boatName", "clientName", "href", "read", "createdAt")
SELECT "id", "kind", "title", "message", "reservationId", "submissionId", "boatName", "clientName", "href", "read", "createdAt" FROM "InternalNotification";
DROP TABLE "InternalNotification";
ALTER TABLE "new_InternalNotification" RENAME TO "InternalNotification";
CREATE INDEX "InternalNotification_read_createdAt_idx" ON "InternalNotification"("read", "createdAt");
CREATE INDEX "InternalNotification_createdAt_idx" ON "InternalNotification"("createdAt");
CREATE INDEX "InternalNotification_recipientUserId_read_createdAt_idx" ON "InternalNotification"("recipientUserId", "read", "createdAt");
