import { API_URL } from "./api-client";

const backendOrigin = API_URL.replace(/\/api\/?$/, "");

/** Resolve backend-relative paths like `/api/public/...` to absolute URLs. */
export function mediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `${backendOrigin}${path}`;
}
