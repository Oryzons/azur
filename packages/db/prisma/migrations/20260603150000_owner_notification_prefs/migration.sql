ALTER TABLE "User" ADD COLUMN "ownerNotifyReservationsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "ownerNotifyNewReservation" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "ownerNotifyReservationUpdated" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "ownerNotifyReservationCancelled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "ownerNotifyReservationRestored" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "ownerNotifyReservationPaid" BOOLEAN NOT NULL DEFAULT true;
