import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export function migrationChecksum(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export async function readJsonFile(path: string) {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

export function migrationMode(argv = process.argv.slice(2)) {
  const apply = argv.includes("--apply");
  const path = argv.find((value) => !value.startsWith("--"));
  if (!path) throw new Error("Provide the path to a Supabase JSON export.");
  if (apply && process.env.FIREBASE_PROJECT_ID === "optimize-local" && process.env.ALLOW_PRODUCTION_FIREBASE_IMPORT !== "I_UNDERSTAND") {
    throw new Error("Production import is locked. Rehearse against an emulator or staging project first.");
  }
  return { apply, path };
}

export function report(value: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
