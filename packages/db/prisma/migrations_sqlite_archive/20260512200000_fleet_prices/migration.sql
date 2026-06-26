-- CreateTable
CREATE TABLE "FleetPrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fleetId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FleetPrice_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FleetPrice_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PricingPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FleetPrice_fleetId_periodId_unit_key" ON "FleetPrice"("fleetId", "periodId", "unit");

-- CreateIndex
CREATE INDEX "FleetPrice_fleetId_idx" ON "FleetPrice"("fleetId");

-- CreateIndex
CREATE INDEX "FleetPrice_periodId_idx" ON "FleetPrice"("periodId");
