CREATE TYPE "PaymentPurpose" AS ENUM ('LEVEL_4_INSTALLMENT', 'EXAM_FEE');
CREATE TYPE "PaymentRequestStatus" AS ENUM ('OPEN', 'PAID', 'CANCELLED', 'REVIEW');
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('INITIATED', 'PAID', 'FAILED', 'CANCELLED', 'REVIEW');

CREATE TABLE "payment_requests" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "leadId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "purpose" "PaymentPurpose" NOT NULL,
    "description" TEXT,
    "amountUsd" DECIMAL(10,2) NOT NULL,
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    CONSTRAINT "payment_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_attempts" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "validationId" TEXT,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'INITIATED',
    "gatewaySessionKey" TEXT,
    "gatewayUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_requests_tokenHash_key" ON "payment_requests"("tokenHash");
CREATE INDEX "payment_requests_leadId_purpose_status_idx" ON "payment_requests"("leadId", "purpose", "status");
CREATE INDEX "payment_requests_createdById_idx" ON "payment_requests"("createdById");
CREATE UNIQUE INDEX "payment_attempts_transactionId_key" ON "payment_attempts"("transactionId");
CREATE UNIQUE INDEX "payment_attempts_validationId_key" ON "payment_attempts"("validationId");
CREATE INDEX "payment_attempts_requestId_status_idx" ON "payment_attempts"("requestId", "status");
CREATE UNIQUE INDEX "payment_attempts_one_active_per_request" ON "payment_attempts"("requestId") WHERE "status" = 'INITIATED';
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "payment_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
