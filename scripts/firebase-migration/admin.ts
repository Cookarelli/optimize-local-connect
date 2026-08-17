import { createHash } from "node:crypto";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { applicationDefault, getApps, initializeApp, type App, type Credential } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "../../src/lib/firebase/admin";

const require = createRequire(import.meta.url);

type FirebaseCliAccount = {
  user?: { email?: string };
  tokens?: { access_token?: string; expires_at?: number; refresh_token?: string };
};

function firebaseCliCredential(accountEmail: string): Credential {
  const configPath = join(homedir(), ".config", "configstore", "firebase-tools.json");
  const config = JSON.parse(readFileSync(configPath, "utf8")) as {
    user?: FirebaseCliAccount["user"];
    tokens?: FirebaseCliAccount["tokens"];
    additionalAccounts?: FirebaseCliAccount[];
  };
  const accounts: FirebaseCliAccount[] = [
    { user: config.user, tokens: config.tokens },
    ...(config.additionalAccounts ?? []),
  ];
  const account = accounts.find((candidate) => candidate.user?.email?.toLowerCase() === accountEmail.toLowerCase());
  const accessToken = account?.tokens?.access_token;
  const expiresAt = account?.tokens?.expires_at ?? 0;
  const refreshToken = account?.tokens?.refresh_token;
  if (!accessToken || !refreshToken || expiresAt <= Date.now() + 60_000) {
    throw new Error(`Firebase CLI access for ${accountEmail} is unavailable or expires too soon. Refresh it with a read-only Firebase CLI command and retry.`);
  }
  const slug = createHash("sha256").update(accountEmail).digest("hex").slice(0, 12);
  const credentialPath = `/private/tmp/olc-firebase-migration-${slug}.json`;
  const firebaseToolsApi = require("firebase-tools/lib/api") as { clientId(): string; clientSecret(): string };
  writeFileSync(credentialPath, JSON.stringify({
    client_id: firebaseToolsApi.clientId(),
    client_secret: firebaseToolsApi.clientSecret(),
    refresh_token: refreshToken,
    type: "authorized_user",
  }), { mode: 0o600 });
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialPath;
  process.once("exit", () => {
    try { unlinkSync(credentialPath); } catch { /* already removed */ }
  });
  return applicationDefault();
}

export function getMigrationAdminApp(argv = process.argv.slice(2)): App {
  const accountEmail = argv.find((value) => value.startsWith("--firebase-cli-account="))?.split("=", 2)[1];
  if (!accountEmail) return getFirebaseAdminApp();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID is required when using Firebase CLI credentials.");
  if (projectId === "optimize-local") throw new Error("Firebase CLI user credentials are never permitted for production migration writes.");
  const appName = `migration-cli-${createHash("sha256").update(`${projectId}|${accountEmail}`).digest("hex").slice(0, 12)}`;
  return getApps().find((app) => app.name === appName)
    ?? initializeApp({ projectId, credential: firebaseCliCredential(accountEmail) }, appName);
}

export function getMigrationAuth(argv = process.argv.slice(2)) {
  return getAuth(getMigrationAdminApp(argv));
}

export function getMigrationFirestore(argv = process.argv.slice(2)) {
  return getFirestore(getMigrationAdminApp(argv));
}
