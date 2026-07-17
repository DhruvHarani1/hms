-- CreateTable
CREATE TABLE "complaint_upvotes" (
    "id" TEXT NOT NULL,
    "complaint_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_upvotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "complaint_upvotes_user_id_idx" ON "complaint_upvotes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "complaint_upvotes_complaint_id_user_id_key" ON "complaint_upvotes"("complaint_id", "user_id");

-- AddForeignKey
ALTER TABLE "complaint_upvotes" ADD CONSTRAINT "complaint_upvotes_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_upvotes" ADD CONSTRAINT "complaint_upvotes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
