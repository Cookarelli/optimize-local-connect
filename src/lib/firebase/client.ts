"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFirebasePublicEnv } from "@/src/lib/env";

export function getFirebaseClientApp() {
  if (getApps().length) return getApp();
  const env = getFirebasePublicEnv();
  return initializeApp({
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
}

export function getFirebaseClientAuth() {
  return getAuth(getFirebaseClientApp());
}

export function getFirebaseClientStorage() {
  return getStorage(getFirebaseClientApp());
}
