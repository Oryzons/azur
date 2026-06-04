-- CreateTable
CREATE TABLE "ReservationRentalContract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reservationId" TEXT NOT NULL,
    "contractNumber" INTEGER NOT NULL,
    "signToken" TEXT NOT NULL,
    "contractTemplateId" TEXT,
    "clientSignatureDataUrl" TEXT,
    "operatorSignatureDataUrl" TEXT,
    "signedAt" DATETIME,
    "signedHtml" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReservationRentalContract_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ReservationRentalContract_reservationId_key" ON "ReservationRentalContract"("reservationId");
CREATE UNIQUE INDEX "ReservationRentalContract_contractNumber_key" ON "ReservationRentalContract"("contractNumber");
CREATE UNIQUE INDEX "ReservationRentalContract_signToken_key" ON "ReservationRentalContract"("signToken");
CREATE INDEX "ReservationRentalContract_signToken_idx" ON "ReservationRentalContract"("signToken");
