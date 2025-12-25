export type VaultEntryForm = {
  title: string;
  username: string;
  password: string;
  url: string;
  notes?: string;
};

export type VaultEntryView = VaultEntryForm & {
  entryId: number;
  createdAt: string;
  updatedAt: string;
};

export type VaultEntryCiphertextPayload = {
  ciphertextBlob: string;
  iv: string;
  authTag: string;
  metadataJson?: unknown;
};

export type VaultEntryRecord = VaultEntryCiphertextPayload & {
  entryId: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  isDeleted: boolean;
};
