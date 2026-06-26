-- Migrate single linkedOffering -> JSON array linkedOfferingsJson
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Partner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "linkedOfferingsJson" TEXT NOT NULL DEFAULT '[]',
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
INSERT INTO "new_Partner" (
    "id",
    "name",
    "kind",
    "linkedOfferingsJson",
    "description",
    "logoUrl",
    "price",
    "active",
    "contactName",
    "contactEmail",
    "contactPhone",
    "note",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "name",
    "kind",
    CASE
        WHEN "linkedOffering" IS NULL OR trim("linkedOffering") = '' THEN '["BOAT_LICENSE"]'
        ELSE printf('["%s"]', "linkedOffering")
    END,
    "description",
    "logoUrl",
    "price",
    "active",
    "contactName",
    "contactEmail",
    "contactPhone",
    "note",
    "createdAt",
    "updatedAt"
FROM "Partner";
DROP TABLE "Partner";
ALTER TABLE "new_Partner" RENAME TO "Partner";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
