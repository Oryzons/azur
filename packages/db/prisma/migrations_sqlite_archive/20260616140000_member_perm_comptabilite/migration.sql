-- Permission comptabilité sur les fiches membre admin.
ALTER TABLE "Member" ADD COLUMN "permComptabilite" BOOLEAN NOT NULL DEFAULT false;
