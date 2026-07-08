-- CreateTable
CREATE TABLE "usage_daily" (
    "id" TEXT NOT NULL,
    "hostel_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_daily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "usage_daily_hostel_id_date_idx" ON "usage_daily"("hostel_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "usage_daily_user_id_date_key" ON "usage_daily"("user_id", "date");

-- AddForeignKey
ALTER TABLE "usage_daily" ADD CONSTRAINT "usage_daily_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
