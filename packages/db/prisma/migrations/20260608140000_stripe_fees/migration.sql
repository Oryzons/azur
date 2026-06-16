-- Frais Stripe enregistrés à l'encaissement (balance_transaction).
ALTER TABLE "Reservation" ADD COLUMN "stripeFeeCents" INTEGER;
ALTER TABLE "Reservation" ADD COLUMN "stripeNetCents" INTEGER;
ALTER TABLE "ReservationInstallment" ADD COLUMN "stripeFeeCents" INTEGER;
ALTER TABLE "ReservationInstallment" ADD COLUMN "stripeNetCents" INTEGER;
