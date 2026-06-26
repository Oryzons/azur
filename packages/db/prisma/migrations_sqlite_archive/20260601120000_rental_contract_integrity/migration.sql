-- Signature exploitant par défaut (société) + intégrité contrat signé
ALTER TABLE "CompanySettings" ADD COLUMN "contractOperatorSignatureDataUrl" TEXT;

ALTER TABLE "ReservationRentalContract" ADD COLUMN "signedHtmlSha256" TEXT;
ALTER TABLE "ReservationRentalContract" ADD COLUMN "contractTemplateVersionAt" DATETIME;
ALTER TABLE "ReservationRentalContract" ADD COLUMN "contractSignedEmailSentAt" DATETIME;
ALTER TABLE "ReservationRentalContract" ADD COLUMN "contractLocked" BOOLEAN NOT NULL DEFAULT false;
