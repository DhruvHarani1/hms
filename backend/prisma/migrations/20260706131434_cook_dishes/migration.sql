-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'cook';

-- CreateTable
CREATE TABLE "dishes" (
    "id" TEXT NOT NULL,
    "hostel_id" TEXT NOT NULL,
    "meal_type" "MealType" NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dishes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dishes_hostel_id_meal_type_idx" ON "dishes"("hostel_id", "meal_type");

-- AddForeignKey
ALTER TABLE "dishes" ADD CONSTRAINT "dishes_hostel_id_fkey" FOREIGN KEY ("hostel_id") REFERENCES "hostels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
