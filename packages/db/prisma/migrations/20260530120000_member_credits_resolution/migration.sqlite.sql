-- Variante SQLite (la migration PostgreSQL échoue sur dev.db).
-- Appliquée manuellement ou via `prisma db execute` si besoin.

ALTER TABLE "ReservationRefund" ADD COLUMN "resolutionType" TEXT NOT NULL DEFAULT 'REFUND';

CREATE TABLE "MemberCredit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT,
    "clientEmail" TEXT,
    "sourceReservationId" TEXT,
    "initialAmountCents" INTEGER NOT NULL,
    "remainingAmountCents" INTEGER NOT NULL,
    "note" TEXT,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MemberCredit_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MemberCredit_sourceReservationId_fkey" FOREIGN KEY ("sourceReservationId") REFERENCES "Reservation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "MemberCredit_memberId_idx" ON "MemberCredit"("memberId");
CREATE INDEX "MemberCredit_clientEmail_idx" ON "MemberCredit"("clientEmail");
CREATE INDEX "MemberCredit_sourceReservationId_idx" ON "MemberCredit"("sourceReservationId");

CREATE TABLE "MemberCreditUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "creditId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "usedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MemberCreditUsage_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "MemberCredit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MemberCreditUsage_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "MemberCreditUsage_creditId_idx" ON "MemberCreditUsage"("creditId");
CREATE INDEX "MemberCreditUsage_reservationId_idx" ON "MemberCreditUsage"("reservationId");
