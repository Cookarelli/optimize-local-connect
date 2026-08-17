import "server-only";

import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { FOUNDER_CATEGORY_CATALOG } from "@/src/domain/founder-categories/catalog";
import { getPlatformFirestore } from "@/src/lib/firebase/admin";

export async function prepareFirebaseServiceCategories(db: Firestore = getPlatformFirestore(), apply = false) {
  const operations = [] as Array<{ id: string; action: "create" | "preserve" }>;
  for (const category of FOUNDER_CATEGORY_CATALOG) {
    const ref = db.doc(`serviceCategories/${category.slug}`);
    const snapshot = await ref.get();
    operations.push({ id: category.slug, action: snapshot.exists ? "preserve" : "create" });
    if (apply) await ref.set({ slug: category.slug, name: category.displayName, displayOrder: category.displayOrder, status: "active", updatedAt: Timestamp.now(), ...(snapshot.exists ? {} : { createdAt: Timestamp.now() }) }, { merge: true });
  }
  return operations;
}
