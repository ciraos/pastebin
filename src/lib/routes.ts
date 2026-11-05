// Publishing is open to everyone, so `/new` is intentionally not protected.
export const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/settings"];

export function isProtectedPath(pathname: string): boolean {
  if (PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }
  return /^\/p\/[^/]+\/edit\/?$/.test(pathname);
}
