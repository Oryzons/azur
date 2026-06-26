-- Notifications internes (check-in / check-out)
ALTER TABLE "NotificationsSettings" ADD COLUMN "onCheckInDone" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationsSettings" ADD COLUMN "onCheckOutDone" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "InternalNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "submissionId" TEXT,
    "boatName" TEXT,
    "clientName" TEXT,
    "href" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "InternalNotification_read_createdAt_idx" ON "InternalNotification"("read", "createdAt");
CREATE INDEX "InternalNotification_createdAt_idx" ON "InternalNotification"("createdAt");
