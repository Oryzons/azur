-- CreateTable
CREATE TABLE "SeoSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'seo_settings',
    "metaTitle" TEXT NOT NULL,
    "metaDescription" TEXT NOT NULL,
    "ogImageUrl" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NauticManagerSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'nautic_manager_settings',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "baseUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "webhookSecret" TEXT NOT NULL,
    "syncOwners" BOOLEAN NOT NULL DEFAULT true,
    "syncBoats" BOOLEAN NOT NULL DEFAULT true,
    "syncReservations" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ownerSince" DATETIME,
    "ownerCompany" TEXT,
    "ownerIban" TEXT,
    "ownerAddress" TEXT,
    "clientType" TEXT,
    "civility" TEXT,
    "birthDate" DATETIME,
    "nationality" TEXT,
    "address" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "internalNote" TEXT,
    "cniFrontUrl" TEXT,
    "cniBackUrl" TEXT,
    "boatLicenseFrontUrl" TEXT,
    "boatLicenseBackUrl" TEXT,
    "permManageMembers" BOOLEAN NOT NULL DEFAULT false,
    "permManageBoats" BOOLEAN NOT NULL DEFAULT false,
    "permManageReservations" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Member" ("address", "birthDate", "city", "civility", "clientType", "country", "createdAt", "email", "firstName", "id", "internalNote", "isActive", "lastName", "nationality", "ownerAddress", "ownerCompany", "ownerIban", "ownerSince", "phone", "postalCode", "role", "updatedAt") SELECT "address", "birthDate", "city", "civility", "clientType", "country", "createdAt", "email", "firstName", "id", "internalNote", "isActive", "lastName", "nationality", "ownerAddress", "ownerCompany", "ownerIban", "ownerSince", "phone", "postalCode", "role", "updatedAt" FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
CREATE UNIQUE INDEX "Member_email_key" ON "Member"("email");
CREATE TABLE "new_PricingPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PricingPeriod" ("createdAt", "endDate", "id", "name", "startDate", "updatedAt") SELECT "createdAt", "endDate", "id", "name", "startDate", "updatedAt" FROM "PricingPeriod";
DROP TABLE "PricingPeriod";
ALTER TABLE "new_PricingPeriod" RENAME TO "PricingPeriod";
CREATE INDEX "PricingPeriod_startDate_idx" ON "PricingPeriod"("startDate");
CREATE INDEX "PricingPeriod_endDate_idx" ON "PricingPeriod"("endDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
