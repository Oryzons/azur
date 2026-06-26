-- SMS transactionnels (Twilio) + horodatages d'envoi
CREATE TABLE "SmsSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "confirmationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "cancellationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "contractSignEnabled" BOOLEAN NOT NULL DEFAULT true,
    "paymentCapturedEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "SmsSettings" (
    "id",
    "enabled",
    "confirmationsEnabled",
    "cancellationsEnabled",
    "contractSignEnabled",
    "paymentCapturedEnabled",
    "updatedAt"
) VALUES (
    'sms_settings',
    0,
    1,
    1,
    1,
    1,
    CURRENT_TIMESTAMP
);

ALTER TABLE "Reservation" ADD COLUMN "confirmationSmsSentAt" DATETIME;
ALTER TABLE "ReservationRentalContract" ADD COLUMN "contractSignSmsSentAt" DATETIME;
