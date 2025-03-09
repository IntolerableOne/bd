-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "status" "BookingStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Booking" ADD COLUMN "stripePaymentId" TEXT;

-- If the Hold table doesn't exist yet, uncomment these lines:
-- CreateTable
-- CREATE TABLE "Hold" (
--   "id" TEXT NOT NULL,
--   "expiresAt" TIMESTAMP(3) NOT NULL,
--   "availabilityId" TEXT NOT NULL,
--   "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   CONSTRAINT "Hold_pkey" PRIMARY KEY ("id")
-- );

-- CreateIndex
-- CREATE UNIQUE INDEX "Hold_availabilityId_key" ON "Hold"("availabilityId");

-- AddForeignKey
-- ALTER TABLE "Hold" ADD CONSTRAINT "Hold_availabilityId_fkey" FOREIGN KEY ("availabilityId") REFERENCES "Availability"("id") ON DELETE RESTRICT ON UPDATE CASCADE;