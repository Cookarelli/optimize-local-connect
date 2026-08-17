import { getMigrationAdminApp } from "./firebase-migration/admin";

const projectId = process.env.FIREBASE_PROJECT_ID;
const domain = process.argv.find((value) => value.startsWith("--authorized-domain="))?.split("=", 2)[1];
const confirmProject = process.argv.find((value) => value.startsWith("--confirm-project="))?.split("=", 2)[1];
const apply = process.argv.includes("--apply");
if (!projectId || projectId === "optimize-local" || !projectId.includes("staging")) throw new Error("Auth configuration requires a staging Firebase project.");
if (!domain || domain.includes("/") || domain.includes(":")) throw new Error("Provide a bare --authorized-domain hostname.");
if (apply && confirmProject !== projectId) throw new Error(`Auth configuration aborted. Pass --confirm-project=${projectId}.`);

const app = getMigrationAdminApp();
const credential = app.options.credential;
if (!credential) throw new Error("Firebase Admin credential is unavailable.");
const token = (await credential.getAccessToken()).access_token;
const endpoint = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`;
const currentResponse = await fetch(endpoint, { headers: { authorization: `Bearer ${token}` } });
if (!currentResponse.ok) throw new Error(`Unable to read Firebase Auth config: ${currentResponse.status}.`);
const current = await currentResponse.json() as { authorizedDomains?: string[]; signIn?: { email?: { enabled?: boolean; passwordRequired?: boolean } } };
const authorizedDomains = [...new Set([...(current.authorizedDomains ?? []), domain])].sort();
if (apply && !(current.authorizedDomains ?? []).includes(domain)) {
  const response = await fetch(`${endpoint}?updateMask=authorizedDomains`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ authorizedDomains }),
  });
  if (!response.ok) throw new Error(`Unable to update Firebase Auth config: ${response.status}.`);
}
process.stdout.write(`${JSON.stringify({ mode: apply ? "apply" : "dry-run", projectId, emailPasswordEnabled: current.signIn?.email?.enabled === true, passwordRequired: current.signIn?.email?.passwordRequired !== false, authorizedDomains }, null, 2)}\n`);
