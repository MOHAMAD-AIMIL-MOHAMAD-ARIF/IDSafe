-- CreateTable
CREATE TABLE "AdminCredential" (
    "adminCredentialId" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "passwordAlgo" TEXT NOT NULL DEFAULT 'argon2id',
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminCredential_pkey" PRIMARY KEY ("adminCredentialId")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminCredential_userId_key" ON "AdminCredential"("userId");

-- AddForeignKey
ALTER TABLE "AdminCredential" ADD CONSTRAINT "AdminCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
