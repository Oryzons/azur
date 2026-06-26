-- CreateTable
CREATE TABLE "Fleet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Boat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brand" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "boatType" TEXT NOT NULL,
    "maxPassengers" INTEGER NOT NULL,
    "ownerMemberId" TEXT,
    "fleetId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Boat_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Boat_ownerMemberId_fkey" FOREIGN KEY ("ownerMemberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BoatPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boatId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BoatPhoto_boatId_fkey" FOREIGN KEY ("boatId") REFERENCES "Boat" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ownerSince" DATETIME,
    "ownerCompany" TEXT,
    "ownerIban" TEXT,
    "ownerAddress" TEXT,
    "clientType" TEXT,
    "civility" TEXT,
    "birthDate" DATETIME,
    "nationality" TEXT,
    "address" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "internalNote" TEXT
);

-- CreateTable
CREATE TABLE "Reservation" (
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
    "installments" INTEGER,
    "settlementNote" TEXT,
    "paymentCapturedAt" DATETIME,
    "depositCapturedAt" DATETIME,
    "confirmationEmailSentAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Reservation_boatId_fkey" FOREIGN KEY ("boatId") REFERENCES "Boat" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reservation_clientMemberId_fkey" FOREIGN KEY ("clientMemberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReservationRefund" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reservationId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "note" TEXT,
    "refundedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReservationRefund_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Extra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceKind" TEXT NOT NULL,
    "priceValue" REAL NOT NULL,
    "billingUnit" TEXT NOT NULL,
    "vatRate" REAL NOT NULL,
    "stock" INTEGER,
    "paymentChannel" TEXT NOT NULL DEFAULT 'ONLINE',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ReservationExtra" (
    "reservationId" TEXT NOT NULL,
    "extraId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY ("reservationId", "extraId"),
    CONSTRAINT "ReservationExtra_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReservationExtra_extraId_fkey" FOREIGN KEY ("extraId") REFERENCES "Extra" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "internalLabel" TEXT NOT NULL,
    "discountKind" TEXT NOT NULL,
    "discountValue" REAL NOT NULL,
    "validFrom" DATETIME NOT NULL,
    "validUntil" DATETIME,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "seasonMaxFullUsesPerClient" INTEGER,
    "seasonDegradedDiscountValue" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "couponId" TEXT NOT NULL,
    "clientKey" TEXT NOT NULL,
    "redeemedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "navalBase" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "linkKind" TEXT NOT NULL,
    "linkedFleetId" TEXT,
    "linkedBoatId" TEXT,
    "newFleetName" TEXT,
    "newBoatBrand" TEXT,
    "newBoatName" TEXT,
    "newBoatModel" TEXT,
    "newBoatType" TEXT,
    "newBoatMaxPassengers" INTEGER,
    "newBoatFleetId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Announcement_linkedFleetId_fkey" FOREIGN KEY ("linkedFleetId") REFERENCES "Fleet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Announcement_linkedBoatId_fkey" FOREIGN KEY ("linkedBoatId") REFERENCES "Boat" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Announcement_newBoatFleetId_fkey" FOREIGN KEY ("newBoatFleetId") REFERENCES "Fleet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PricingPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BoatPrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boatId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BoatPrice_boatId_fkey" FOREIGN KEY ("boatId") REFERENCES "Boat" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BoatPrice_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PricingPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'company_settings',
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT NOT NULL,
    "professionalPhone" TEXT NOT NULL,
    "domiciliation" TEXT NOT NULL,
    "companyType" TEXT NOT NULL,
    "vatNumber" TEXT NOT NULL,
    "siret" TEXT NOT NULL,
    "rcsRegistration" TEXT NOT NULL,
    "nafCode" TEXT NOT NULL,
    "shareCapital" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "publicSiteUrl" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "adsVatRatePercent" REAL NOT NULL,
    "vatBasePercent" REAL NOT NULL,
    "vatPercent" REAL NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BankSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'bank_settings',
    "accountHolder" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "bic" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NotificationsSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'notifications_settings',
    "adminEmailsCsv" TEXT NOT NULL,
    "onReservationCreated" BOOLEAN NOT NULL DEFAULT true,
    "onPaymentCaptured" BOOLEAN NOT NULL DEFAULT true,
    "onRefundCreated" BOOLEAN NOT NULL DEFAULT true,
    "onReservationCancelled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BookingSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'booking_settings',
    "defaultNavalBase" TEXT NOT NULL,
    "requireDeposit" BOOLEAN NOT NULL DEFAULT true,
    "depositDefaultAmount" TEXT NOT NULL,
    "paymentsOnlineEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EmailSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'email_settings',
    "fromName" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "replyToEmail" TEXT NOT NULL,
    "confirmationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PublicSiteSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'public_site_settings',
    "publicSiteUrl" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requiredDocuments" TEXT NOT NULL,
    "cancellationTerms" TEXT NOT NULL,
    "rentalTerms" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Fleet_name_key" ON "Fleet"("name");

-- CreateIndex
CREATE INDEX "Boat_fleetId_idx" ON "Boat"("fleetId");

-- CreateIndex
CREATE INDEX "Boat_ownerMemberId_idx" ON "Boat"("ownerMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "Boat_name_model_brand_key" ON "Boat"("name", "model", "brand");

-- CreateIndex
CREATE INDEX "BoatPhoto_boatId_idx" ON "BoatPhoto"("boatId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_email_key" ON "Member"("email");

-- CreateIndex
CREATE INDEX "Reservation_boatId_idx" ON "Reservation"("boatId");

-- CreateIndex
CREATE INDEX "Reservation_clientMemberId_idx" ON "Reservation"("clientMemberId");

-- CreateIndex
CREATE INDEX "Reservation_startAt_idx" ON "Reservation"("startAt");

-- CreateIndex
CREATE INDEX "ReservationRefund_reservationId_idx" ON "ReservationRefund"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "Extra_name_key" ON "Extra"("name");

-- CreateIndex
CREATE INDEX "ReservationExtra_extraId_idx" ON "ReservationExtra"("extraId");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "CouponRedemption_couponId_idx" ON "CouponRedemption"("couponId");

-- CreateIndex
CREATE INDEX "CouponRedemption_clientKey_idx" ON "CouponRedemption"("clientKey");

-- CreateIndex
CREATE INDEX "CouponRedemption_redeemedAt_idx" ON "CouponRedemption"("redeemedAt");

-- CreateIndex
CREATE INDEX "Announcement_linkedFleetId_idx" ON "Announcement"("linkedFleetId");

-- CreateIndex
CREATE INDEX "Announcement_linkedBoatId_idx" ON "Announcement"("linkedBoatId");

-- CreateIndex
CREATE INDEX "PricingPeriod_startDate_idx" ON "PricingPeriod"("startDate");

-- CreateIndex
CREATE INDEX "PricingPeriod_endDate_idx" ON "PricingPeriod"("endDate");

-- CreateIndex
CREATE INDEX "BoatPrice_boatId_idx" ON "BoatPrice"("boatId");

-- CreateIndex
CREATE INDEX "BoatPrice_periodId_idx" ON "BoatPrice"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "BoatPrice_boatId_periodId_unit_key" ON "BoatPrice"("boatId", "periodId", "unit");
