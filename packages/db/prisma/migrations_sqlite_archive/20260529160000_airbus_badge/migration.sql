-- Badge Airbus (coupon partenaire) + snapshot réservation
ALTER TABLE "Coupon" ADD COLUMN "requiresAirbusBadge" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Member" ADD COLUMN "airbusBadge" TEXT;
ALTER TABLE "Reservation" ADD COLUMN "airbusBadge" TEXT;

UPDATE "Coupon" SET "requiresAirbusBadge" = true WHERE UPPER("code") LIKE '%AIRBUS%';
