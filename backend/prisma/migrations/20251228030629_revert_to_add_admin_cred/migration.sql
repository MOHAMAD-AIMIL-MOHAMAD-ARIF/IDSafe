-- DropIndex
DROP INDEX "WebauthnCredential_externalCredentialId_key";

-- AddForeignKey
ALTER TABLE "WebauthnCredential" ADD CONSTRAINT "WebauthnCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
