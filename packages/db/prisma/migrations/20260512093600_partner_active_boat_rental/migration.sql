-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Partner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "linkedOffering" TEXT NOT NULL DEFAULT 'BOAT_LICENSE',
    "description" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT NOT NULL DEFAULT '',
    "price" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Partner" ("contactEmail", "contactName", "contactPhone", "createdAt", "description", "id", "kind", "linkedOffering", "logoUrl", "name", "note", "price", "updatedAt") SELECT "contactEmail", "contactName", "contactPhone", "createdAt", "description", "id", "kind", "linkedOffering", "logoUrl", "name", "note", "price", "updatedAt" FROM "Partner";
DROP TABLE "Partner";
ALTER TABLE "new_Partner" RENAME TO "Partner";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
