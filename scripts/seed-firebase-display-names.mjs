import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

dotenv.config();

const PROFILES = [
  { email: "sanejkstrronger@gmail.com", fullName: "Капров Александр Николаевич" },
  { email: "sasharicky99@gmail.com", fullName: "Алексеев Дмитрий Сергеевич" },
  { email: "n0zicsgo@gmail.com", fullName: "Журавлёв Михаил Дмитриевич" },
  { email: "angel16yoo@gmail.com", fullName: "Орлова Анна Вячеславовна" },
  { email: "sdvikkikishm@icloud.com", fullName: "Шустрова Александра Семеновна" },
];

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
  let updated = 0;
  let missing = 0;

  for (const profile of PROFILES) {
    try {
      const user = await auth.getUserByEmail(profile.email);
      await auth.updateUser(user.uid, { displayName: profile.fullName });
      updated += 1;
      console.log(`updated ${profile.email} -> ${profile.fullName}`);
    } catch (error) {
      missing += 1;
      console.log(`skip ${profile.email}: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(`Done. Updated: ${updated}, missing: ${missing}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
