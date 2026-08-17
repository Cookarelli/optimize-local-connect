import { prepareFirebaseServiceCategories } from "../src/lib/firebase/catalog";
import { getMigrationFirestore } from "./firebase-migration/admin";

const apply = process.argv.includes("--apply");
if (apply && process.env.FIREBASE_PROJECT_ID === "optimize-local" && process.env.ALLOW_PRODUCTION_FIREBASE_IMPORT !== "I_UNDERSTAND") throw new Error("Production mutation is locked.");
const operations = await prepareFirebaseServiceCategories(getMigrationFirestore(), apply);
process.stdout.write(`${JSON.stringify({ mode: apply ? "apply" : "dry-run", operations }, null, 2)}\n`);
