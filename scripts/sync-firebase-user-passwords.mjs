import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

dotenv.config();

const password = (process.env.FIREBASE_UNIVERSAL_PASSWORD ?? "").trim();
if (!password) {
  throw new Error("Set FIREBASE_UNIVERSAL_PASSWORD env variable.");
}

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

  throw new Error(
    "Service account not found. Set FIREBASE_SERVICE_ACCOUNT_PATH or place firebase-service-account.json in project root.",
  );
}

if (getApps().length === 0) {
  initializeApp({
    credential: cert(resolveServiceAccount()),
  });
}

const auth = getAuth();

async function main() {
  let nextPageToken;
  let updated = 0;
  let skipped = 0;

  do {
    const page = await auth.listUsers(1000, nextPageToken);
    for (const user of page.users) {
      if (!user.email) {
        skipped += 1;
        console.log(`skip uid=${user.uid} (no email)`);
        continue;
      }

      await auth.updateUser(user.uid, { password });
      updated += 1;
      const providers = user.providerData.map((provider) => provider.providerId).join(", ") || "none";
      console.log(`updated ${user.email} [${providers}]`);
    }
    nextPageToken = page.pageToken;
  } while (nextPageToken);

  console.log(`Done. Updated: ${updated}, skipped: ${skipped}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
