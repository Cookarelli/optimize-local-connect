import "server-only";
import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";
import type { Bucket } from "@google-cloud/storage";

let cachedApp: App | undefined;

function requireFirebaseAdminEnvironment() {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return { projectId: process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? "demo-optimize-local-connect", credential: applicationDefault() };
  }
  const names = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"] as const;
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Missing Firebase Admin environment: ${missing.join(", ")}`);
  return {
    projectId: process.env.FIREBASE_PROJECT_ID!,
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    }),
  };
}

export function getFirebaseAdminApp() {
  if (cachedApp) return cachedApp;
  cachedApp = getApps()[0] ?? initializeApp(requireFirebaseAdminEnvironment());
  return cachedApp;
}

export function getFounderFirestore(): Firestore {
  return getFirestore(getFirebaseAdminApp());
}

export function getPlatformFirestore(): Firestore {
  return getFounderFirestore();
}

export function getFirebaseAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}

export function getFirebaseAdminStorage(): Storage {
  return getStorage(getFirebaseAdminApp());
}

export function getFirebaseStorageBucket(): Bucket {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) throw new Error("Missing Firebase Storage bucket configuration.");
  return getFirebaseAdminStorage().bucket(bucketName);
}
