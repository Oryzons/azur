-- CreateTable
CREATE TABLE "CheckFlowSettings" (
    "id" TEXT NOT NULL DEFAULT 'check_flow_settings',
    "checkOutUsesCheckInForm" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,

    CONSTRAINT "CheckFlowSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "CheckFlowSettings" ("id", "checkOutUsesCheckInForm", "updatedAt")
VALUES ('check_flow_settings', false, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
