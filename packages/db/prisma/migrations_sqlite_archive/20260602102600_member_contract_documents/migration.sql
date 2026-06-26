-- Add reusable contract document fields on Member (client).
ALTER TABLE "Member" ADD COLUMN "clientIdNumber" TEXT;
ALTER TABLE "Member" ADD COLUMN "licenseNumber" TEXT;

