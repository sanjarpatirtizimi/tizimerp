export interface StaffTokenClaims {
  kind: "staff";
  sub: string;
  role: "SUPER_ADMIN" | "OPERATOR";
  exp: number;
}

export interface DriverTokenClaims {
  kind: "driver";
  sub: string;
  exp: number;
}

export type TokenClaims = StaffTokenClaims | DriverTokenClaims;

/**
 * Decodes (does NOT verify) a JWT's payload. Signature verification happens
 * server-side on every request — this is only used client-side to read
 * non-sensitive claims (kind/role/sub/exp) for routing and UI decisions.
 */
export function decodeJwt<T = TokenClaims>(token: string): T | null {
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(normalized)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    );
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function isExpired(claims: { exp: number } | null): boolean {
  if (!claims) return true;
  return claims.exp * 1000 < Date.now();
}
