-- Snapshot des données réservation au moment de la signature (détection de divergence).
ALTER TABLE "ReservationRentalContract" ADD COLUMN "signedReservationSnapshotSha256" TEXT;
