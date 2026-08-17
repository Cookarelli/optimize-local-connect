import { ensureFounderOperationalProfiles } from "../src/lib/firebase/vendor-profiles";
import { getMigrationFirestore } from "./firebase-migration/admin";
const apply=process.argv.includes("--apply");
if(apply&&process.env.FIREBASE_PROJECT_ID==="optimize-local"&&process.env.ALLOW_PRODUCTION_FIREBASE_IMPORT!=="I_UNDERSTAND")throw new Error("Production mutation is locked.");
const operations=await ensureFounderOperationalProfiles(getMigrationFirestore(),apply);
process.stdout.write(`${JSON.stringify({mode:apply?"apply":"dry-run",operations},null,2)}\n`);
