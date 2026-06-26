-- AlterTable
ALTER TABLE "Boat" ADD COLUMN "depositAmountCents" INTEGER NOT NULL DEFAULT 250000;

-- AlterTable
ALTER TABLE "PricingPeriod" ADD COLUMN "code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PricingPeriod_code_key" ON "PricingPeriod"("code");
