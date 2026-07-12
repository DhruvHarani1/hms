-- CreateTable
CREATE TABLE "email_otps" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_otps_email_key" ON "email_otps"("email");

-- Verify existing active warden/staff/super_admin/cook users by default
UPDATE "users"
SET "email_verified_at" = CURRENT_TIMESTAMP
WHERE "role" IN ('warden', 'staff', 'super_admin', 'cook') AND "status" = 'active';
