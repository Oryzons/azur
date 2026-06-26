-- CreateTable
CREATE TABLE "ExtraRental" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "extraId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "title" TEXT NOT NULL,
    "clientMemberId" TEXT,
    "clientEmail" TEXT,
    "clientFirstName" TEXT,
    "clientLastName" TEXT,
    "clientPhone" TEXT,
    "paymentChannel" TEXT NOT NULL DEFAULT 'ONLINE',
    "totalDueCents" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paymentCapturedAt" DATETIME,
    "settlementNote" TEXT,
    "internalNote" TEXT,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExtraRental_extraId_fkey" FOREIGN KEY ("extraId") REFERENCES "Extra" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExtraRental_clientMemberId_fkey" FOREIGN KEY ("clientMemberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ExtraRental_extraId_idx" ON "ExtraRental"("extraId");

-- CreateIndex
CREATE INDEX "ExtraRental_startAt_idx" ON "ExtraRental"("startAt");
