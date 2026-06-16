import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Important: do not hardcode passwords in the repo.
// This value is expected to be provided via env var at runtime.
export const FIREBASE_UNIVERSAL_PASSWORD = (process.env.FIREBASE_UNIVERSAL_PASSWORD ?? "").trim();

let initError = null;

function resolveServiceAccount() {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (fromEnv) {
    const absolute = resolve(fromEnv);
    if (!existsSync(absolute)) {
      throw new Error(`FIREBASE_SERVICE_ACCOUNT_PATH not found: ${absolute}`);
    }
    return JSON.parse(readFileSync(absolute, "utf8"));
  }

  const fallback = resolve("firebase-service-account.json");
  if (existsSync(fallback)) {
    return JSON.parse(readFileSync(fallback, "utf8"));
  }

  return null;
}

export function isFirebaseAdminReady() {
  if (getApps().length > 0) return true;
  if (initError) return false;
  try {
    const serviceAccount = resolveServiceAccount();
    if (!serviceAccount) return false;
    initializeApp({ credential: cert(serviceAccount) });
    return true;
  } catch (error) {
    initError = error;
    return false;
  }
}

export function getFirebaseAdminAuth() {
  if (!isFirebaseAdminReady()) {
    throw new Error("Firebase Admin is not configured.");
  }
  return getAuth();
}

export async function ensureUserPasswordByEmail(email) {
  if (!FIREBASE_UNIVERSAL_PASSWORD) {
    throw new Error("FIREBASE_UNIVERSAL_PASSWORD env var is required.");
  }
  const auth = getFirebaseAdminAuth();
  const user = await auth.getUserByEmail(email.trim().toLowerCase());
  await auth.updateUser(user.uid, { password: FIREBASE_UNIVERSAL_PASSWORD });
  return user.uid;
}

export async function ensureUserPasswordByIdToken(idToken) {
  if (!FIREBASE_UNIVERSAL_PASSWORD) {
    throw new Error("FIREBASE_UNIVERSAL_PASSWORD env var is required.");
  }
  const auth = getFirebaseAdminAuth();
  const decoded = await auth.verifyIdToken(idToken);
  await auth.updateUser(decoded.uid, { password: FIREBASE_UNIVERSAL_PASSWORD });
  return decoded.uid;
}
