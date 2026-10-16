-- AlterTable
ALTER TABLE "Mahalla" ADD COLUMN     "assignedToId" TEXT;

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Mahalla_assignedToId_idx" ON "Mahalla"("assignedToId");

-- AddForeignKey
ALTER TABLE "Mahalla" ADD CONSTRAINT "Mahalla_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
