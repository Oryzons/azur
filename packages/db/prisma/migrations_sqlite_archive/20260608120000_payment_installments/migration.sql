-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN "depositPercent" INTEGER;

-- AlterTable
ALTER TABLE "Extra" ADD COLUMN "icon" TEXT;

-- CreateTable
CREATE TABLE "ReservationInstallment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reservationId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "label" TEXT,
    "amountCents" INTEGER NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'ONLINE',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" DATETIME,
    "stripeCheckoutSessionId" TEXT,
    "paymentLinkUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReservationInstallment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ReservationInstallment_reservationId_idx" ON "ReservationInstallment"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationInstallment_reservationId_sequence_key" ON "ReservationInstallment"("reservationId", "sequence");
