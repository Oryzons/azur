-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'STAFF', 'AGENT', 'OWNER', 'DAF');

-- CreateEnum
CREATE TYPE "BoatType" AS ENUM ('BATEAU_A_MOTEUR', 'SEMI_RIGIDE', 'VOILIER', 'CATAMARAN', 'TRIMARAN', 'PENICHE', 'YACHT', 'JETSKI', 'ENGIN_NAUTIQUE', 'AUTRE');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('ADMIN', 'AGENT', 'OWNER', 'CLIENT', 'DAF');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('PARTICULIER', 'PROFESSIONNEL', 'ASSOCIATION');

-- CreateEnum
CREATE TYPE "Civility" AS ENUM ('NONE', 'M', 'MME', 'MX');

-- CreateEnum
CREATE TYPE "PaymentChannel" AS ENUM ('ONLINE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('ONLINE', 'CASH', 'CARD_ONSITE', 'CHECK', 'TRANSFER');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING_PAYMENT', 'RESERVED_PAID', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "UnavailabilityReason" AS ENUM ('REPAIR', 'PRIVATE_USE', 'WEATHER', 'OTHER');

-- CreateEnum
CREATE TYPE "RefundResolutionType" AS ENUM ('REFUND', 'STORE_CREDIT');

-- CreateEnum
CREATE TYPE "ExtraPriceKind" AS ENUM ('PERCENT', 'EURO');

-- CreateEnum
CREATE TYPE "ExtraBillingUnit" AS ENUM ('LOCATION', 'JOUR', 'SEMAINE');

-- CreateEnum
CREATE TYPE "ExtraRentalStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CouponDiscountKind" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AnnouncementLinkKind" AS ENUM ('EXISTING_FLEET', 'EXISTING_BOAT', 'NEW_FLEET', 'NEW_BOAT');

-- CreateEnum
CREATE TYPE "PricingUnit" AS ENUM ('DEMI_JOURNEE', 'JOURNEE', 'SEMAINE');

-- CreateEnum
CREATE TYPE "InternalNotificationKind" AS ENUM ('CHECK_IN_DONE', 'CHECK_OUT_DONE', 'PAYMENT_ONLINE_CAPTURED', 'RESERVATION_CREATED', 'RESERVATION_UPDATED', 'RESERVATION_CANCELLED', 'RESERVATION_RESTORED', 'RESERVATION_REFUNDED', 'RESERVATION_PARTIAL_REFUND', 'RESERVATION_DELETED', 'RESERVATION_PAID', 'RENTAL_CONTRACT_SIGNED', 'RESERVATION_ON_OWNER_BOAT', 'UNAVAILABILITY_CREATED', 'UNAVAILABILITY_UPDATED', 'UNAVAILABILITY_DELETED');

-- CreateEnum
CREATE TYPE "PartnerKind" AS ENUM ('NAUTIC_BASE', 'MAINTENANCE', 'INSURANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "CheckFlowKind" AS ENUM ('CHECK_IN', 'CHECK_OUT');

-- CreateEnum
CREATE TYPE "CheckQuestionType" AS ENUM ('TEXT', 'BOOLEAN', 'SELECT', 'PHOTO', 'FUEL_GAUGE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "civility" TEXT,
    "phone" TEXT,
    "birthDate" TIMESTAMP(3),
    "nationality" TEXT,
    "address" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "company" TEXT,
    "avatarUrl" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "ownerMemberId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "ownerNotifyReservationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ownerNotifyNewReservation" BOOLEAN NOT NULL DEFAULT true,
    "ownerNotifyReservationUpdated" BOOLEAN NOT NULL DEFAULT true,
    "ownerNotifyReservationCancelled" BOOLEAN NOT NULL DEFAULT true,
    "ownerNotifyReservationRestored" BOOLEAN NOT NULL DEFAULT true,
    "ownerNotifyReservationPaid" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "oldData" TEXT,
    "newData" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ip" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fleet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fleet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Boat" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "boatType" "BoatType" NOT NULL,
    "maxPassengers" INTEGER NOT NULL,
    "ownerMemberId" TEXT,
    "fleetId" TEXT,
    "depositAmountCents" INTEGER NOT NULL DEFAULT 250000,
    "detailsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Boat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoatPhoto" (
    "id" TEXT NOT NULL,
    "boatId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoatPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerSince" TIMESTAMP(3),
    "ownerCompany" TEXT,
    "ownerIban" TEXT,
    "ownerAddress" TEXT,
    "clientType" "ClientType",
    "civility" "Civility",
    "birthDate" TIMESTAMP(3),
    "nationality" TEXT,
    "address" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "internalNote" TEXT,
    "airbusBadge" TEXT,
    "airbusBadgePhotoUrl" TEXT,
    "clientIdNumber" TEXT,
    "clientIdType" TEXT,
    "licenseNumber" TEXT,
    "licenseType" TEXT,
    "licenseCountry" TEXT,
    "licenseYear" TEXT,
    "cniFrontUrl" TEXT,
    "cniBackUrl" TEXT,
    "boatLicenseFrontUrl" TEXT,
    "boatLicenseBackUrl" TEXT,
    "permManageMembers" BOOLEAN NOT NULL DEFAULT false,
    "permManageBoats" BOOLEAN NOT NULL DEFAULT false,
    "permManageReservations" BOOLEAN NOT NULL DEFAULT false,
    "permComptabilite" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "boatId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "color" TEXT,
    "clientMemberId" TEXT,
    "clientType" "ClientType",
    "civility" "Civility",
    "clientEmail" TEXT,
    "clientFirstName" TEXT,
    "clientLastName" TEXT,
    "clientPhone" TEXT,
    "clientBirthDate" TIMESTAMP(3),
    "clientAddress" TEXT,
    "clientPostalCode" TEXT,
    "clientCity" TEXT,
    "clientCountry" TEXT,
    "passengerCount" INTEGER,
    "hasChildren" BOOLEAN NOT NULL DEFAULT false,
    "childrenCount" INTEGER,
    "internalNote" TEXT,
    "paymentChannel" "PaymentChannel" NOT NULL DEFAULT 'ONLINE',
    "rentalPriceCents" INTEGER,
    "depositAmountCents" INTEGER,
    "discountPercent" INTEGER,
    "couponCode" TEXT,
    "airbusBadge" TEXT,
    "installments" INTEGER,
    "depositPercent" INTEGER,
    "settlementNote" TEXT,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paymentCapturedAt" TIMESTAMP(3),
    "depositCapturedAt" TIMESTAMP(3),
    "confirmationEmailSentAt" TIMESTAMP(3),
    "totalDueCents" INTEGER,
    "stripeCheckoutSessionId" TEXT,
    "stripeDepositPaymentIntentId" TEXT,
    "stripeFeeCents" INTEGER,
    "stripeNetCents" INTEGER,
    "paymentLinkUrl" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "detailsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationInstallment" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "label" TEXT,
    "amountCents" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'ONLINE',
    "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "stripeCheckoutSessionId" TEXT,
    "stripeFeeCents" INTEGER,
    "stripeNetCents" INTEGER,
    "paymentLinkUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoatUnavailability" (
    "id" TEXT NOT NULL,
    "boatId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reason" "UnavailabilityReason" NOT NULL DEFAULT 'OTHER',
    "note" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoatUnavailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationRefund" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "note" TEXT,
    "resolutionType" "RefundResolutionType" NOT NULL DEFAULT 'REFUND',
    "refundedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberCredit" (
    "id" TEXT NOT NULL,
    "memberId" TEXT,
    "clientEmail" TEXT,
    "sourceReservationId" TEXT,
    "initialAmountCents" INTEGER NOT NULL,
    "remainingAmountCents" INTEGER NOT NULL,
    "note" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberCreditUsage" (
    "id" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberCreditUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Extra" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceKind" "ExtraPriceKind" NOT NULL,
    "priceValue" DOUBLE PRECISION NOT NULL,
    "billingUnit" "ExtraBillingUnit" NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL,
    "stock" INTEGER,
    "paymentChannel" "PaymentChannel" NOT NULL DEFAULT 'ONLINE',
    "icon" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Extra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtraRental" (
    "id" TEXT NOT NULL,
    "extraId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "clientMemberId" TEXT,
    "clientEmail" TEXT,
    "clientFirstName" TEXT,
    "clientLastName" TEXT,
    "clientPhone" TEXT,
    "paymentChannel" "PaymentChannel" NOT NULL DEFAULT 'ONLINE',
    "totalDueCents" INTEGER,
    "status" "ExtraRentalStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paymentCapturedAt" TIMESTAMP(3),
    "settlementNote" TEXT,
    "internalNote" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtraRental_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationExtra" (
    "reservationId" TEXT NOT NULL,
    "extraId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ReservationExtra_pkey" PRIMARY KEY ("reservationId","extraId")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "internalLabel" TEXT NOT NULL,
    "discountKind" "CouponDiscountKind" NOT NULL,
    "discountValue" DOUBLE PRECISION NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "seasonMaxFullUsesPerClient" INTEGER,
    "seasonDegradedDiscountValue" DOUBLE PRECISION,
    "requiresAirbusBadge" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "clientKey" TEXT NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "navalBase" TEXT NOT NULL,
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'ACTIVE',
    "linkKind" "AnnouncementLinkKind" NOT NULL,
    "linkedFleetId" TEXT,
    "linkedBoatId" TEXT,
    "newFleetName" TEXT,
    "newBoatBrand" TEXT,
    "newBoatName" TEXT,
    "newBoatModel" TEXT,
    "newBoatType" "BoatType",
    "newBoatMaxPassengers" INTEGER,
    "newBoatFleetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementPhoto" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingPeriod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoatPrice" (
    "id" TEXT NOT NULL,
    "boatId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "unit" "PricingUnit" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoatPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetPrice" (
    "id" TEXT NOT NULL,
    "fleetId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "unit" "PricingUnit" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL DEFAULT 'company_settings',
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
    "adsVatRatePercent" DOUBLE PRECISION NOT NULL,
    "vatBasePercent" DOUBLE PRECISION NOT NULL,
    "vatPercent" DOUBLE PRECISION NOT NULL,
    "contractOperatorSignatureDataUrl" TEXT,
    "departureLocation" TEXT NOT NULL DEFAULT '',
    "arrivalLocation" TEXT NOT NULL DEFAULT '',
    "contactOpeningHours" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankSettings" (
    "id" TEXT NOT NULL DEFAULT 'bank_settings',
    "accountHolder" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "bic" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationsSettings" (
    "id" TEXT NOT NULL DEFAULT 'notifications_settings',
    "adminEmailsCsv" TEXT NOT NULL,
    "onReservationCreated" BOOLEAN NOT NULL DEFAULT true,
    "onReservationUpdated" BOOLEAN NOT NULL DEFAULT true,
    "onPaymentCaptured" BOOLEAN NOT NULL DEFAULT true,
    "onRefundCreated" BOOLEAN NOT NULL DEFAULT true,
    "onReservationCancelled" BOOLEAN NOT NULL DEFAULT true,
    "onReservationRestored" BOOLEAN NOT NULL DEFAULT true,
    "onReservationDeleted" BOOLEAN NOT NULL DEFAULT true,
    "onCheckInDone" BOOLEAN NOT NULL DEFAULT true,
    "onCheckOutDone" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationsSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalNotification" (
    "id" TEXT NOT NULL,
    "kind" "InternalNotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "reservationId" TEXT,
    "unavailabilityId" TEXT,
    "submissionId" TEXT,
    "boatName" TEXT,
    "clientName" TEXT,
    "href" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingSettings" (
    "id" TEXT NOT NULL DEFAULT 'booking_settings',
    "defaultNavalBase" TEXT NOT NULL,
    "departureLocation" TEXT NOT NULL DEFAULT '',
    "arrivalLocation" TEXT NOT NULL DEFAULT '',
    "requireDeposit" BOOLEAN NOT NULL DEFAULT true,
    "depositDefaultAmount" TEXT NOT NULL,
    "paymentsOnlineEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSettings" (
    "id" TEXT NOT NULL DEFAULT 'email_settings',
    "fromName" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "replyToEmail" TEXT NOT NULL,
    "confirmationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicSiteSettings" (
    "id" TEXT NOT NULL DEFAULT 'public_site_settings',
    "publicSiteUrl" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "departureLocation" TEXT NOT NULL DEFAULT '',
    "arrivalLocation" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicSiteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoSettings" (
    "id" TEXT NOT NULL DEFAULT 'seo_settings',
    "metaTitle" TEXT NOT NULL,
    "metaDescription" TEXT NOT NULL,
    "ogImageUrl" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NauticManagerSettings" (
    "id" TEXT NOT NULL DEFAULT 'nautic_manager_settings',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "baseUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "webhookSecret" TEXT NOT NULL,
    "syncOwners" BOOLEAN NOT NULL DEFAULT true,
    "syncBoats" BOOLEAN NOT NULL DEFAULT true,
    "syncReservations" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NauticManagerSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "PartnerKind" NOT NULL,
    "linkedOfferingsJson" TEXT NOT NULL DEFAULT '[]',
    "description" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT NOT NULL DEFAULT '',
    "price" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckFlowSettings" (
    "id" TEXT NOT NULL DEFAULT 'check_flow_settings',
    "checkOutUsesCheckInForm" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckFlowSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckFlowQuestion" (
    "id" TEXT NOT NULL,
    "kind" "CheckFlowKind" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT NOT NULL,
    "helpText" TEXT,
    "questionType" "CheckQuestionType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "optionsJson" TEXT,
    "photoMinCount" INTEGER NOT NULL DEFAULT 1,
    "photoMaxCount" INTEGER NOT NULL DEFAULT 3,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckFlowQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckFlowSubmission" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "kind" "CheckFlowKind" NOT NULL,
    "submittedByUserId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summaryJson" TEXT,
    "clientSignatureUrl" TEXT,
    "agentSignatureUrl" TEXT,

    CONSTRAINT "CheckFlowSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckFlowAnswer" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "valueText" TEXT,
    "valueJson" TEXT,
    "commentText" TEXT,

    CONSTRAINT "CheckFlowAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requiredDocuments" TEXT NOT NULL,
    "cancellationTerms" TEXT NOT NULL,
    "rentalTerms" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationRentalContract" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "contractNumber" INTEGER NOT NULL,
    "signToken" TEXT NOT NULL,
    "contractTemplateId" TEXT,
    "clientSignatureDataUrl" TEXT,
    "operatorSignatureDataUrl" TEXT,
    "signedAt" TIMESTAMP(3),
    "contractSignEmailSentAt" TIMESTAMP(3),
    "contractSignedEmailSentAt" TIMESTAMP(3),
    "signedHtml" TEXT,
    "signedHtmlSha256" TEXT,
    "contractTemplateVersionAt" TIMESTAMP(3),
    "contractLocked" BOOLEAN NOT NULL DEFAULT false,
    "signedReservationSnapshotSha256" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationRentalContract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_ownerMemberId_idx" ON "User"("ownerMemberId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_lastSeenAt_idx" ON "RefreshToken"("lastSeenAt");

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
CREATE INDEX "ReservationInstallment_reservationId_idx" ON "ReservationInstallment"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationInstallment_reservationId_sequence_key" ON "ReservationInstallment"("reservationId", "sequence");

-- CreateIndex
CREATE INDEX "BoatUnavailability_boatId_idx" ON "BoatUnavailability"("boatId");

-- CreateIndex
CREATE INDEX "BoatUnavailability_startAt_idx" ON "BoatUnavailability"("startAt");

-- CreateIndex
CREATE INDEX "ReservationRefund_reservationId_idx" ON "ReservationRefund"("reservationId");

-- CreateIndex
CREATE INDEX "MemberCredit_memberId_idx" ON "MemberCredit"("memberId");

-- CreateIndex
CREATE INDEX "MemberCredit_clientEmail_idx" ON "MemberCredit"("clientEmail");

-- CreateIndex
CREATE INDEX "MemberCredit_sourceReservationId_idx" ON "MemberCredit"("sourceReservationId");

-- CreateIndex
CREATE INDEX "MemberCreditUsage_creditId_idx" ON "MemberCreditUsage"("creditId");

-- CreateIndex
CREATE INDEX "MemberCreditUsage_reservationId_idx" ON "MemberCreditUsage"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "Extra_name_key" ON "Extra"("name");

-- CreateIndex
CREATE INDEX "ExtraRental_extraId_idx" ON "ExtraRental"("extraId");

-- CreateIndex
CREATE INDEX "ExtraRental_startAt_idx" ON "ExtraRental"("startAt");

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
CREATE INDEX "AnnouncementPhoto_announcementId_idx" ON "AnnouncementPhoto"("announcementId");

-- CreateIndex
CREATE UNIQUE INDEX "PricingPeriod_code_key" ON "PricingPeriod"("code");

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

-- CreateIndex
CREATE INDEX "FleetPrice_fleetId_idx" ON "FleetPrice"("fleetId");

-- CreateIndex
CREATE INDEX "FleetPrice_periodId_idx" ON "FleetPrice"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "FleetPrice_fleetId_periodId_unit_key" ON "FleetPrice"("fleetId", "periodId", "unit");

-- CreateIndex
CREATE INDEX "InternalNotification_read_createdAt_idx" ON "InternalNotification"("read", "createdAt");

-- CreateIndex
CREATE INDEX "InternalNotification_createdAt_idx" ON "InternalNotification"("createdAt");

-- CreateIndex
CREATE INDEX "InternalNotification_recipientUserId_read_createdAt_idx" ON "InternalNotification"("recipientUserId", "read", "createdAt");

-- CreateIndex
CREATE INDEX "CheckFlowQuestion_kind_sortOrder_idx" ON "CheckFlowQuestion"("kind", "sortOrder");

-- CreateIndex
CREATE INDEX "CheckFlowSubmission_kind_submittedAt_idx" ON "CheckFlowSubmission"("kind", "submittedAt");

-- CreateIndex
CREATE INDEX "CheckFlowSubmission_reservationId_idx" ON "CheckFlowSubmission"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckFlowSubmission_reservationId_kind_key" ON "CheckFlowSubmission"("reservationId", "kind");

-- CreateIndex
CREATE INDEX "CheckFlowAnswer_questionId_idx" ON "CheckFlowAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckFlowAnswer_submissionId_questionId_key" ON "CheckFlowAnswer"("submissionId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationRentalContract_reservationId_key" ON "ReservationRentalContract"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationRentalContract_contractNumber_key" ON "ReservationRentalContract"("contractNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationRentalContract_signToken_key" ON "ReservationRentalContract"("signToken");

-- CreateIndex
CREATE INDEX "ReservationRentalContract_signToken_idx" ON "ReservationRentalContract"("signToken");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_ownerMemberId_fkey" FOREIGN KEY ("ownerMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Boat" ADD CONSTRAINT "Boat_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Boat" ADD CONSTRAINT "Boat_ownerMemberId_fkey" FOREIGN KEY ("ownerMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoatPhoto" ADD CONSTRAINT "BoatPhoto_boatId_fkey" FOREIGN KEY ("boatId") REFERENCES "Boat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_boatId_fkey" FOREIGN KEY ("boatId") REFERENCES "Boat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_clientMemberId_fkey" FOREIGN KEY ("clientMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationInstallment" ADD CONSTRAINT "ReservationInstallment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoatUnavailability" ADD CONSTRAINT "BoatUnavailability_boatId_fkey" FOREIGN KEY ("boatId") REFERENCES "Boat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoatUnavailability" ADD CONSTRAINT "BoatUnavailability_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationRefund" ADD CONSTRAINT "ReservationRefund_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberCredit" ADD CONSTRAINT "MemberCredit_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberCredit" ADD CONSTRAINT "MemberCredit_sourceReservationId_fkey" FOREIGN KEY ("sourceReservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberCreditUsage" ADD CONSTRAINT "MemberCreditUsage_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "MemberCredit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberCreditUsage" ADD CONSTRAINT "MemberCreditUsage_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraRental" ADD CONSTRAINT "ExtraRental_extraId_fkey" FOREIGN KEY ("extraId") REFERENCES "Extra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraRental" ADD CONSTRAINT "ExtraRental_clientMemberId_fkey" FOREIGN KEY ("clientMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationExtra" ADD CONSTRAINT "ReservationExtra_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationExtra" ADD CONSTRAINT "ReservationExtra_extraId_fkey" FOREIGN KEY ("extraId") REFERENCES "Extra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_linkedFleetId_fkey" FOREIGN KEY ("linkedFleetId") REFERENCES "Fleet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_linkedBoatId_fkey" FOREIGN KEY ("linkedBoatId") REFERENCES "Boat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_newBoatFleetId_fkey" FOREIGN KEY ("newBoatFleetId") REFERENCES "Fleet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementPhoto" ADD CONSTRAINT "AnnouncementPhoto_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoatPrice" ADD CONSTRAINT "BoatPrice_boatId_fkey" FOREIGN KEY ("boatId") REFERENCES "Boat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoatPrice" ADD CONSTRAINT "BoatPrice_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PricingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetPrice" ADD CONSTRAINT "FleetPrice_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetPrice" ADD CONSTRAINT "FleetPrice_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PricingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckFlowSubmission" ADD CONSTRAINT "CheckFlowSubmission_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckFlowSubmission" ADD CONSTRAINT "CheckFlowSubmission_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckFlowAnswer" ADD CONSTRAINT "CheckFlowAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "CheckFlowSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckFlowAnswer" ADD CONSTRAINT "CheckFlowAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "CheckFlowQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationRentalContract" ADD CONSTRAINT "ReservationRentalContract_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

