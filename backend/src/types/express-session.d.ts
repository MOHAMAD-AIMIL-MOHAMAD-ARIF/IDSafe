import "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    role?: string;

    // WebAuthn registration temp state
    webauthnReg?: {
      userId: number;
      email: string;
      challenge: string; // base64url string from SimpleWebAuthn
      createdAt: string; // ISO
    };

    // WebAuthn login
    webauthnLogin?: {
      challenge: string;
      userId: number;
      createdAtMs: number;
    };
  }
}
