export type AccountProfile = {
  userId: number;
  email: string;
  registrationDate: string;
  lastLoginAt: string | null;
};

export type WebauthnCredential = {
  credentialId: number;
  externalCredentialId: string;
  aaguid: string;
  attestationFormat: string;
  signCount: number;
  createdAt: string;
  lastUsedAt: string | null;
  isActive: boolean;
};

export type DeviceBinding = {
  deviceId: number;
  deviceLabel: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};
