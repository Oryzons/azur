-- AlterEnum UserRole: add AGENT (SQLite stores as TEXT)
-- Prisma: no SQL needed for enum extension on SQLite

-- CreateTable
CREATE TABLE "CheckFlowQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT NOT NULL,
    "helpText" TEXT,
    "questionType" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "optionsJson" TEXT,
    "photoMinCount" INTEGER NOT NULL DEFAULT 1,
    "photoMaxCount" INTEGER NOT NULL DEFAULT 3,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "CheckFlowSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reservationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "submittedByUserId" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summaryJson" TEXT,
    CONSTRAINT "CheckFlowSubmission_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CheckFlowSubmission_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "CheckFlowAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submissionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "valueText" TEXT,
    "valueJson" TEXT,
    CONSTRAINT "CheckFlowAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "CheckFlowSubmission" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CheckFlowAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "CheckFlowQuestion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CheckFlowSubmission_reservationId_kind_key" ON "CheckFlowSubmission"("reservationId", "kind");
CREATE INDEX "CheckFlowSubmission_kind_submittedAt_idx" ON "CheckFlowSubmission"("kind", "submittedAt");
CREATE INDEX "CheckFlowSubmission_reservationId_idx" ON "CheckFlowSubmission"("reservationId");
CREATE INDEX "CheckFlowQuestion_kind_sortOrder_idx" ON "CheckFlowQuestion"("kind", "sortOrder");
CREATE UNIQUE INDEX "CheckFlowAnswer_submissionId_questionId_key" ON "CheckFlowAnswer"("submissionId", "questionId");
CREATE INDEX "CheckFlowAnswer_questionId_idx" ON "CheckFlowAnswer"("questionId");
