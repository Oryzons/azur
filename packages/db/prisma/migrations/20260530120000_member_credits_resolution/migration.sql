-- CreateEnum
CREATE TYPE "RefundResolutionType" AS ENUM ('REFUND', 'STORE_CREDIT');

-- AlterTable
ALTER TABLE "ReservationRefund" ADD COLUMN "resolutionType" "RefundResolutionType" NOT NULL DEFAULT 'REFUND';

-- CreateTable
CREATE TABLE "MemberCredit" (
    "id" TEXT NOT NULL,
    "memberId" TEXT,
    "clientEmail" TEXT,
    "sourceReservationId" TEXT,
    "initialAmountCents" INTEGER NOT NULL,
    "remainingAmountCents" INTEGER NOT NULL,
    "note" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberCreditUsage" (
    "id" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberCreditUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberCredit_memberId_idx" ON "MemberCredit"("memberId");
CREATE INDEX "MemberCredit_clientEmail_idx" ON "MemberCredit"("clientEmail");
CREATE INDEX "MemberCredit_sourceReservationId_idx" ON "MemberCredit"("sourceReservationId");
CREATE INDEX "MemberCreditUsage_creditId_idx" ON "MemberCreditUsage"("creditId");
CREATE INDEX "MemberCreditUsage_reservationId_idx" ON "MemberCreditUsage"("reservationId");

-- AddForeignKey
ALTER TABLE "MemberCredit" ADD CONSTRAINT "MemberCredit_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MemberCredit" ADD CONSTRAINT "MemberCredit_sourceReservationId_fkey" FOREIGN KEY ("sourceReservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MemberCreditUsage" ADD CONSTRAINT "MemberCreditUsage_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "MemberCredit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemberCreditUsage" ADD CONSTRAINT "MemberCreditUsage_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
