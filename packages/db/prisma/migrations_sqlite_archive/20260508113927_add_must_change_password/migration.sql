-- RedefineTables
PRAGMA defer_foreign_keys=ON;
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
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("address", "avatarUrl", "birthDate", "city", "civility", "company", "country", "createdAt", "email", "firstName", "id", "isActive", "lastLoginAt", "lastName", "nationality", "passwordHash", "phone", "postalCode", "role") SELECT "address", "avatarUrl", "birthDate", "city", "civility", "company", "country", "createdAt", "email", "firstName", "id", "isActive", "lastLoginAt", "lastName", "nationality", "passwordHash", "phone", "postalCode", "role" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
