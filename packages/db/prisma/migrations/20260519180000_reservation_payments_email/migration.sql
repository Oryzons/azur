-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN "totalDueCents" INTEGER;
ALTER TABLE "Reservation" ADD COLUMN "stripeCheckoutSessionId" TEXT;
ALTER TABLE "Reservation" ADD COLUMN "stripeDepositPaymentIntentId" TEXT;
ALTER TABLE "Reservation" ADD COLUMN "paymentLinkUrl" TEXT;
