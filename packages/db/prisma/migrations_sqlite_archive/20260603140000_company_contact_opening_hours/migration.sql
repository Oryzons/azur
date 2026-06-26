ALTER TABLE "CompanySettings" ADD COLUMN "contactOpeningHours" TEXT NOT NULL DEFAULT '';

UPDATE "CompanySettings"
SET "contactOpeningHours" = 'Lundi – vendredi : 9h – 18h' || char(10) || 'Samedi : 9h – 12h'
WHERE "id" = 'company_settings' AND TRIM("contactOpeningHours") = '';
