export type AuthRole = "END_USER" | "ADMIN";

export type AuthSession = {
  userId: number;
  role: AuthRole;
};
