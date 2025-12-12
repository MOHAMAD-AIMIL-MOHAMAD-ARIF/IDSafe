-- CreateTable
CREATE TABLE "DeviceKey" (
    "deviceId" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "devicePublicKey" TEXT NOT NULL,
    "deviceLabel" TEXT,
    "wrappedDEK" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "DeviceKey_pkey" PRIMARY KEY ("deviceId")
);

-- CreateIndex
CREATE INDEX "DeviceKey_userId_idx" ON "DeviceKey"("userId");

-- AddForeignKey
ALTER TABLE "DeviceKey" ADD CONSTRAINT "DeviceKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
