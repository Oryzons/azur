-- Notifications internes : réglages réservation (modif, rétablissement, suppression)
ALTER TABLE "NotificationsSettings" ADD COLUMN "onReservationUpdated" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationsSettings" ADD COLUMN "onReservationRestored" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationsSettings" ADD COLUMN "onReservationDeleted" BOOLEAN NOT NULL DEFAULT true;
