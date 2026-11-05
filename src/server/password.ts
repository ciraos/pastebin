import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

const SCRYPT_N = 2 ** 14;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 32;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

const b64url = (raw: Buffer): string => raw.toString("base64url");

/** `scrypt$N$r$p$salt$hash` — the exact format the previous backend used. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const digest = await scryptAsync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${b64url(salt)}$${b64url(digest)}`;
}

let dummyHash: string | null = null;

async function getDummyHash(): Promise<string> {
  if (!dummyHash) dummyHash = await hashPassword(randomBytes(16).toString("base64url"));
  return dummyHash;
}

/**
 * Verifies a password; when the account is unknown it still burns a scrypt
 * round so response timing does not leak whether the email exists.
 */
export async function verifyPassword(password: string, encoded: string | null): Promise<boolean> {
  if (!encoded) {
    await verifyPassword(password, await getDummyHash());
    return false;
  }
  const parts = encoded.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, rawN, rawR, rawP, saltB64, hashB64] = parts as [string, string, string, string, string, string];
  const digest = Buffer.from(hashB64!, "base64url");
  try {
    const candidate = await scryptAsync(password, Buffer.from(saltB64!, "base64url"), digest.length, {
      N: Number.parseInt(rawN, 10),
      r: Number.parseInt(rawR, 10),
      p: Number.parseInt(rawP, 10),
      maxmem: SCRYPT_MAXMEM,
    });
    return candidate.length === digest.length && timingSafeEqual(candidate, digest);
  } catch {
    return false;
  }
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createUnlockToken(pasteId: string, secret: string, ttl: number): string {
  const expires = Math.floor(Date.now() / 1000) + ttl;
  const payload = `${pasteId}.${expires}`;
  const signature = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  return `${expires}.${signature}`;
}

export function verifyUnlockToken(pasteId: string, token: string | null | undefined, secret: string): boolean {
  if (!token) return false;
  const [rawExpires, signature] = token.split(".", 2);
  if (!rawExpires || !signature) return false;
  const expires = Number.parseInt(rawExpires, 10);
  if (!Number.isFinite(expires) || expires * 1000 < Date.now()) return false;
  const expected = createHmac("sha256", secret).update(`${pasteId}.${expires}`, "utf8").digest("hex");
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(signature, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}
