-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "SmsSettings";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Reservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boatId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "color" TEXT,
    "clientMemberId" TEXT,
    "clientType" TEXT,
    "civility" TEXT,
    "clientEmail" TEXT,
    "clientFirstName" TEXT,
    "clientLastName" TEXT,
    "clientPhone" TEXT,
    "clientBirthDate" DATETIME,
    "clientAddress" TEXT,
    "clientPostalCode" TEXT,
    "clientCity" TEXT,
    "clientCountry" TEXT,
    "passengerCount" INTEGER,
    "hasChildren" BOOLEAN NOT NULL DEFAULT false,
    "childrenCount" INTEGER,
    "internalNote" TEXT,
    "paymentChannel" TEXT NOT NULL DEFAULT 'ONLINE',
    "rentalPriceCents" INTEGER,
    "depositAmountCents" INTEGER,
    "discountPercent" INTEGER,
    "couponCode" TEXT,
    "airbusBadge" TEXT,
    "installments" INTEGER,
    "depositPercent" INTEGER,
    "settlementNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paymentCapturedAt" DATETIME,
    "depositCapturedAt" DATETIME,
    "confirmationEmailSentAt" DATETIME,
    "totalDueCents" INTEGER,
    "stripeCheckoutSessionId" TEXT,
    "stripeDepositPaymentIntentId" TEXT,
    "stripeFeeCents" INTEGER,
    "stripeNetCents" INTEGER,
    "paymentLinkUrl" TEXT,
    "cancelledAt" DATETIME,
    "detailsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Reservation_boatId_fkey" FOREIGN KEY ("boatId") REFERENCES "Boat" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reservation_clientMemberId_fkey" FOREIGN KEY ("clientMemberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Reservation" ("airbusBadge", "boatId", "cancelledAt", "childrenCount", "civility", "clientAddress", "clientBirthDate", "clientCity", "clientCountry", "clientEmail", "clientFirstName", "clientLastName", "clientMemberId", "clientPhone", "clientPostalCode", "clientType", "color", "confirmationEmailSentAt", "couponCode", "createdAt", "depositAmountCents", "depositCapturedAt", "depositPercent", "detailsJson", "discountPercent", "endAt", "hasChildren", "id", "installments", "internalNote", "passengerCount", "paymentCapturedAt", "paymentChannel", "paymentLinkUrl", "rentalPriceCents", "settlementNote", "startAt", "status", "stripeCheckoutSessionId", "stripeDepositPaymentIntentId", "stripeFeeCents", "stripeNetCents", "title", "totalDueCents", "updatedAt") SELECT "airbusBadge", "boatId", "cancelledAt", "childrenCount", "civility", "clientAddress", "clientBirthDate", "clientCity", "clientCountry", "clientEmail", "clientFirstName", "clientLastName", "clientMemberId", "clientPhone", "clientPostalCode", "clientType", "color", "confirmationEmailSentAt", "couponCode", "createdAt", "depositAmountCents", "depositCapturedAt", "depositPercent", "detailsJson", "discountPercent", "endAt", "hasChildren", "id", "installments", "internalNote", "passengerCount", "paymentCapturedAt", "paymentChannel", "paymentLinkUrl", "rentalPriceCents", "settlementNote", "startAt", "status", "stripeCheckoutSessionId", "stripeDepositPaymentIntentId", "stripeFeeCents", "stripeNetCents", "title", "totalDueCents", "updatedAt" FROM "Reservation";
DROP TABLE "Reservation";
ALTER TABLE "new_Reservation" RENAME TO "Reservation";
CREATE INDEX "Reservation_boatId_idx" ON "Reservation"("boatId");
CREATE INDEX "Reservation_clientMemberId_idx" ON "Reservation"("clientMemberId");
CREATE INDEX "Reservation_startAt_idx" ON "Reservation"("startAt");
CREATE TABLE "new_ReservationRentalContract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reservationId" TEXT NOT NULL,
    "contractNumber" INTEGER NOT NULL,
    "signToken" TEXT NOT NULL,
    "contractTemplateId" TEXT,
    "clientSignatureDataUrl" TEXT,
    "operatorSignatureDataUrl" TEXT,
    "signedAt" DATETIME,
    "contractSignEmailSentAt" DATETIME,
    "contractSignedEmailSentAt" DATETIME,
    "signedHtml" TEXT,
    "signedHtmlSha256" TEXT,
    "contractTemplateVersionAt" DATETIME,
    "contractLocked" BOOLEAN NOT NULL DEFAULT false,
    "signedReservationSnapshotSha256" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReservationRentalContract_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ReservationRentalContract" ("clientSignatureDataUrl", "contractLocked", "contractNumber", "contractSignEmailSentAt", "contractSignedEmailSentAt", "contractTemplateId", "contractTemplateVersionAt", "createdAt", "id", "operatorSignatureDataUrl", "reservationId", "signToken", "signedAt", "signedHtml", "signedHtmlSha256", "signedReservationSnapshotSha256", "updatedAt") SELECT "clientSignatureDataUrl", "contractLocked", "contractNumber", "contractSignEmailSentAt", "contractSignedEmailSentAt", "contractTemplateId", "contractTemplateVersionAt", "createdAt", "id", "operatorSignatureDataUrl", "reservationId", "signToken", "signedAt", "signedHtml", "signedHtmlSha256", "signedReservationSnapshotSha256", "updatedAt" FROM "ReservationRentalContract";
DROP TABLE "ReservationRentalContract";
ALTER TABLE "new_ReservationRentalContract" RENAME TO "ReservationRentalContract";
CREATE UNIQUE INDEX "ReservationRentalContract_reservationId_key" ON "ReservationRentalContract"("reservationId");
CREATE UNIQUE INDEX "ReservationRentalContract_contractNumber_key" ON "ReservationRentalContract"("contractNumber");
CREATE UNIQUE INDEX "ReservationRentalContract_signToken_key" ON "ReservationRentalContract"("signToken");
CREATE INDEX "ReservationRentalContract_signToken_idx" ON "ReservationRentalContract"("signToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
