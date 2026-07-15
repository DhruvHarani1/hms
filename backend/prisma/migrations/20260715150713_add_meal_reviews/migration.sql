-- CreateTable
CREATE TABLE "meal_reviews" (
    "id" TEXT NOT NULL,
    "hostel_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "meal_type" "MealType" NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meal_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meal_reviews_hostel_id_date_idx" ON "meal_reviews"("hostel_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "meal_reviews_student_id_date_meal_type_key" ON "meal_reviews"("student_id", "date", "meal_type");

-- AddForeignKey
ALTER TABLE "meal_reviews" ADD CONSTRAINT "meal_reviews_hostel_id_fkey" FOREIGN KEY ("hostel_id") REFERENCES "hostels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_reviews" ADD CONSTRAINT "meal_reviews_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
