import type { TokenClaims } from "./jwt";

/** Where staff land after login / logo home. Super Admin → statistika. */
export function staffEntryPath(claims: TokenClaims | null | undefined): string {
  if (claims?.kind === "staff" && claims.role === "SUPER_ADMIN") {
    return "/staff/analytics";
  }
  return "/staff/dashboard";
}
