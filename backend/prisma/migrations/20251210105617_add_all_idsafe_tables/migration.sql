/*
  Warnings:

  - The values [USER] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - The values [DISABLED] on the enum `UserStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('END_USER', 'ADMIN');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "UserStatus_new" AS ENUM ('ACTIVE', 'LOCKED', 'DEACTIVATED');
ALTER TABLE "User" ALTER COLUMN "status" TYPE "UserStatus_new" USING ("status"::text::"UserStatus_new");
ALTER TYPE "UserStatus" RENAME TO "UserStatus_old";
ALTER TYPE "UserStatus_new" RENAME TO "UserStatus";
DROP TYPE "public"."UserStatus_old";
COMMIT;

-- CreateTable
CREATE TABLE "WebauthnCredential" (
    "credentialId" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "externalCredentialId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "aaguid" TEXT NOT NULL,
    "attestationFormat" TEXT NOT NULL,
    "signCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "WebauthnCredential_pkey" PRIMARY KEY ("credentialId")
);

-- CreateTable
CREATE TABLE "VaultEntry" (
    "entryId" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "ciphertextBlob" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "VaultEntry_pkey" PRIMARY KEY ("entryId")
);

-- CreateTable
CREATE TABLE "RecoveryData" (
    "recoveryId" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "wrappedVaultKey" TEXT NOT NULL,
    "kdfSalt" TEXT NOT NULL,
    "kdfAlgorithm" TEXT NOT NULL,
    "kdfTimeCost" INTEGER NOT NULL,
    "kdfMemoryCost" INTEGER NOT NULL,
    "kdfParallelism" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryData_pkey" PRIMARY KEY ("recoveryId")
);

-- CreateTable
CREATE TABLE "RecoveryToken" (
    "tokenId" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenType" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryToken_pkey" PRIMARY KEY ("tokenId")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "logId" SERIAL NOT NULL,
    "userId" INTEGER,
    "actorId" INTEGER,
    "eventType" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "detailsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("logId")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "configKey" TEXT NOT NULL,
    "configValue" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedByUserId" INTEGER,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("configKey")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebauthnCredential_externalCredentialId_key" ON "WebauthnCredential"("externalCredentialId");

-- CreateIndex
CREATE INDEX "WebauthnCredential_userId_idx" ON "WebauthnCredential"("userId");

-- CreateIndex
CREATE INDEX "VaultEntry_userId_idx" ON "VaultEntry"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryData_userId_key" ON "RecoveryData"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryToken_tokenHash_key" ON "RecoveryToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RecoveryToken_userId_idx" ON "RecoveryToken"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "SystemConfig_updatedByUserId_idx" ON "SystemConfig"("updatedByUserId");

-- AddForeignKey
ALTER TABLE "WebauthnCredential" ADD CONSTRAINT "WebauthnCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultEntry" ADD CONSTRAINT "VaultEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryData" ADD CONSTRAINT "RecoveryData_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryToken" ADD CONSTRAINT "RecoveryToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemConfig" ADD CONSTRAINT "SystemConfig_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;
