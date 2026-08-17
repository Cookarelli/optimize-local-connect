import "server-only";

import { createHash } from "node:crypto";
import { Timestamp, type Firestore, type Transaction } from "firebase-admin/firestore";
import { getPlatformFirestore } from "@/src/lib/firebase/admin";

export const EMAIL_PROVIDER_STATUS = "EMAIL_PROVIDER_REQUIRED" as const;
export const NOTIFICATION_TYPES = [
  "organization_invitation",
  "opportunity_assigned",
  "opportunity_accepted",
  "opportunity_declined",
  "opportunity_reassigned",
  "request_in_progress",
  "request_completed",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

type NotificationInput = {
  type: NotificationType;
  entityId: string;
  version: string;
  recipientUserId?: string | null;
  recipientEmail?: string | null;
  recipientOrganizationId?: string | null;
  templateKey: string;
  templateData: Record<string, string | number | boolean | null>;
};

export function notificationId(input: Pick<NotificationInput, "type" | "entityId" | "version" | "recipientUserId" | "recipientEmail" | "recipientOrganizationId">) {
  return createHash("sha256").update([
    input.type, input.entityId, input.version, input.recipientUserId ?? "", input.recipientEmail ?? "", input.recipientOrganizationId ?? "",
  ].join("|")).digest("hex");
}
export function setNotificationInTransaction(transaction: Transaction, input: NotificationInput, db: Firestore = getPlatformFirestore()) {
  const now = Timestamp.now();
  const id = notificationId(input);
  transaction.set(db.doc(`notifications/${id}`), {
    ...input,
    channel: "email",
    status: "queued",
    attempts: 0,
    nextAttemptAt: now,
    providerMessageId: null,
    processingStartedAt: null,
    sentAt: null,
    failedAt: null,
    lastErrorCode: null,
    createdAt: now,
    updatedAt: now,
  }, { merge: false });
  return id;
}

export async function queueNotification(input: NotificationInput, db: Firestore = getPlatformFirestore()) {
  const id = notificationId(input);
  const now = Timestamp.now();
  await db.doc(`notifications/${id}`).set({
    ...input,
    channel: "email",
    status: "queued",
    attempts: 0,
    nextAttemptAt: now,
    providerMessageId: null,
    processingStartedAt: null,
    sentAt: null,
    failedAt: null,
    lastErrorCode: null,
    createdAt: now,
    updatedAt: now,
  }, { merge: false });
  return id;
}

export async function claimNotificationForDelivery(id: string, workerId: string, db: Firestore = getPlatformFirestore()) {
  const ref = db.doc(`notifications/${id}`);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data();
    const now = Timestamp.now();
    if (!data || !["queued", "failed"].includes(data.status) || data.nextAttemptAt?.toMillis() > now.toMillis()) return null;
    transaction.update(ref, { status: "processing", workerId, attempts: Number(data.attempts ?? 0) + 1, processingStartedAt: now, updatedAt: now });
    return { id, ...data };
  });
}

export async function recordNotificationDelivery(input: { id: string; providerMessageId: string }, db: Firestore = getPlatformFirestore()) {
  const now = Timestamp.now();
  await db.doc(`notifications/${input.id}`).update({ status: "sent", providerMessageId: input.providerMessageId, sentAt: now, updatedAt: now, lastErrorCode: null });
}

export async function recordNotificationFailure(input: { id: string; errorCode: string; retryAt: Date }, db: Firestore = getPlatformFirestore()) {
  const now = Timestamp.now();
  await db.doc(`notifications/${input.id}`).update({ status: "failed", failedAt: now, nextAttemptAt: Timestamp.fromDate(input.retryAt), lastErrorCode: input.errorCode.slice(0, 120), updatedAt: now });
}
