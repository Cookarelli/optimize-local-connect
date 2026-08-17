import { seedFounderCategories } from "@/src/lib/founder-categories/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) throw new Error("Missing Firebase Admin environment: FIREBASE_PROJECT_ID");
if (!process.argv.includes(`--confirm-project=${projectId}`)) {
  throw new Error("Seed aborted. Pass --confirm-project=<FIREBASE_PROJECT_ID> after verifying the target project.");
}

const result = await seedFounderCategories();
console.info("Founder category seed complete.", { total: result.total });
