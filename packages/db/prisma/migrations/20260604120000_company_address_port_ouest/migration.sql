UPDATE "CompanySettings"
SET
  "addressLine" = 'Port Ouest Marseille, D568',
  "postalCode" = '13016',
  "city" = 'Marseille',
  "country" = 'France'
WHERE "id" = 'company_settings';

UPDATE "PublicSiteSettings"
SET
  "addressLine" = 'Port Ouest Marseille, D568',
  "postalCode" = '13016',
  "city" = 'Marseille',
  "country" = 'France'
WHERE "id" = 'public_site_settings';
