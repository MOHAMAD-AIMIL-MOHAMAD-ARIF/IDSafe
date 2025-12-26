import "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    role?: "END_USER" | "ADMIN";

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

    // Admin WebAuthn registration temp state
    adminWebauthnReg?: {
      userId: number;
      email: string;
      challenge: string;
      createdAt: string;
    };

    // Admin WebAuthn login
    adminWebauthnLogin?: {
      challenge: string;
      userId: number;
      createdAtMs: number;
    };

    // Admin password + OTP login
    adminOtpLogin?: {
      userId: number;
      stage: "OTP_REQUIRED";
      createdAt: string;
    };

    // Recovery-only session state (tightly scoped)
    recovery?: {
      userId: number;
      tokenId: number;
      verifiedAt: string; // ISO string (serializable in session store)
      completedAt?: string;
      deviceId?: number;
      webauthn?: { challenge: string };
    };
  }
}
