-- CreateTable
CREATE TABLE "attendance_edit_requests" (
    "id" TEXT NOT NULL,
    "hostel_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "changes" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_edit_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_edit_requests_hostel_id_status_idx" ON "attendance_edit_requests"("hostel_id", "status");

-- CreateIndex
CREATE INDEX "attendance_edit_requests_student_id_idx" ON "attendance_edit_requests"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_edit_requests_student_id_date_key" ON "attendance_edit_requests"("student_id", "date");

-- AddForeignKey
ALTER TABLE "attendance_edit_requests" ADD CONSTRAINT "attendance_edit_requests_hostel_id_fkey" FOREIGN KEY ("hostel_id") REFERENCES "hostels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_edit_requests" ADD CONSTRAINT "attendance_edit_requests_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_edit_requests" ADD CONSTRAINT "attendance_edit_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
