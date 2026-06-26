-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT';

UPDATE "Reservation" SET "status" = 'CANCELLED' WHERE "cancelledAt" IS NOT NULL;
UPDATE "Reservation" SET "status" = 'RESERVED_PAID' WHERE "cancelledAt" IS NULL AND "paymentCapturedAt" IS NOT NULL;
