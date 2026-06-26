-- Lieux de départ / arrivée (contrats, réservations, site public)
ALTER TABLE "CompanySettings" ADD COLUMN "departureLocation" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanySettings" ADD COLUMN "arrivalLocation" TEXT NOT NULL DEFAULT '';

ALTER TABLE "BookingSettings" ADD COLUMN "departureLocation" TEXT NOT NULL DEFAULT '';
ALTER TABLE "BookingSettings" ADD COLUMN "arrivalLocation" TEXT NOT NULL DEFAULT '';

ALTER TABLE "PublicSiteSettings" ADD COLUMN "departureLocation" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PublicSiteSettings" ADD COLUMN "arrivalLocation" TEXT NOT NULL DEFAULT '';

UPDATE "BookingSettings"
SET
  "departureLocation" = COALESCE(NULLIF(TRIM("defaultNavalBase"), ''), 'Port Ouest Marseille — L''Estaque'),
  "arrivalLocation" = COALESCE(NULLIF(TRIM("defaultNavalBase"), ''), 'Port Ouest Marseille — L''Estaque')
WHERE "id" = 'booking_settings';

UPDATE "CompanySettings"
SET
  "departureLocation" = 'Port Ouest Marseille — L''Estaque',
  "arrivalLocation" = 'Port Ouest Marseille — L''Estaque'
WHERE "id" = 'company_settings' AND TRIM("departureLocation") = '';

UPDATE "PublicSiteSettings"
SET
  "departureLocation" = 'Port Ouest Marseille — L''Estaque',
  "arrivalLocation" = 'Port Ouest Marseille — L''Estaque'
WHERE "id" = 'public_site_settings' AND TRIM("departureLocation") = '';
