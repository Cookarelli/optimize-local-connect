import "server-only";

import { randomUUID } from "node:crypto";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import type { ServiceRequestDocument } from "@/src/domain/firebase-platform/types";
import { getPlatformFirestore } from "@/src/lib/firebase/admin";
import { getEmailProvider, type EmailProvider } from "@/src/lib/firebase/email-provider";
import { renderFirebaseNotificationEmail } from "@/src/lib/firebase/notification-email";
import { claimNotificationForDelivery, recordNotificationDelivery, recordNotificationFailure, type NotificationType } from "@/src/lib/firebase/notifications";

type NotificationRecord = {
  id: string;
  type: NotificationType;
  entityId: string;
  recipientUserId?: string | null;
  recipientEmail?: string | null;
  recipientOrganizationId?: string | null;
  notifyPlatformAdmins?: boolean;
  attempts?: number;
};

function retryAt(attempts: number) {
  return new Date(Date.now() + Math.min(60 * 60_000, 60_000 * 2 ** Math.max(0, attempts - 1)));
}

function validEmail(value: unknown): value is string {
  return typeof value === "string" && /^\S+@\S+\.\S+$/.test(value);
}

async function emailsForNotification(notification: NotificationRecord, db: Firestore) {
  const emails = new Set<string>();
  if (validEmail(notification.recipientEmail)) emails.add(notification.recipientEmail.toLowerCase());
  const userIds = new Set<string>();
  if (notification.recipientUserId) userIds.add(notification.recipientUserId);
  if (notification.recipientOrganizationId) {
    const memberships = await db.collection("organizationMemberships").where("organizationId", "==", notification.recipientOrganizationId).where("status", "==", "active").get();
    memberships.docs.forEach((membership) => { const userId = membership.data().userId; if (typeof userId === "string") userIds.add(userId); });
  }
  if (notification.notifyPlatformAdmins) {
    const admins = await db.collection("platformAdmins").where("status", "==", "active").get();
    admins.docs.forEach((admin) => userIds.add(admin.id));
  }
  if (userIds.size) {
    const users = await db.getAll(...[...userIds].sort().map((userId) => db.doc(`users/${userId}`)));
    users.forEach((user) => { const email = user.data()?.email; if (validEmail(email)) emails.add(email.toLowerCase()); });
  }
  return [...emails].sort();
}

function audience(notification: NotificationRecord) {
  if (notification.recipientOrganizationId && notification.type.startsWith("opportunity_") && notification.type !== "opportunity_accepted" && notification.type !== "opportunity_declined") return "vendor" as const;
  return "property_manager" as const;
}

async function deliverNotification(notification: NotificationRecord, provider: EmailProvider, appUrl: string, db: Firestore) {
  const requestSnapshot = await db.doc(`serviceRequests/${notification.entityId}`).get();
  const request = requestSnapshot.data() as ServiceRequestDocument | undefined;
  if (!request) throw new Error("NOTIFICATION_REQUEST_NOT_FOUND");
  const recipients = await emailsForNotification(notification, db);
  if (!recipients.length) throw new Error("NOTIFICATION_RECIPIENT_NOT_FOUND");
  const email = renderFirebaseNotificationEmail({ type: notification.type, request: { requestId: notification.entityId, propertyName: request.propertyName, categoryName: request.categoryName, serviceAreaKey: request.serviceAreaKey, problemDescription: request.problemDescription, acceptedVendorName: request.acceptedVendorName }, appUrl, audience: audience(notification) });
  const result = await provider.send({ to: recipients, subject: email.subject, html: email.html, text: email.text, idempotencyKey: notification.id });
  await recordNotificationDelivery({ id: notification.id, providerMessageId: result.id }, db);
}

export async function deliverPendingFirebaseNotifications(input: { workerId?: string; limit?: number; provider?: EmailProvider; appUrl?: string; db?: Firestore } = {}) {
  const db = input.db ?? getPlatformFirestore();
  const appUrl = (input.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  if (!appUrl || !/^https?:\/\//.test(appUrl)) throw new Error("NEXT_PUBLIC_APP_URL is required for notification links.");
  const provider = input.provider ?? getEmailProvider();
  const workerId = input.workerId ?? `firebase-email-${randomUUID()}`;
  const limit = Math.max(1, Math.min(100, input.limit ?? 25));
  const [queued, failed] = await Promise.all([
    db.collection("notifications").where("status", "==", "queued").orderBy("nextAttemptAt").limit(limit).get(),
    db.collection("notifications").where("status", "==", "failed").orderBy("nextAttemptAt").limit(limit).get(),
  ]);
  let sent = 0;
  let failedCount = 0;
  for (const candidate of [...queued.docs, ...failed.docs].sort((left, right) => (left.data().nextAttemptAt as Timestamp).toMillis() - (right.data().nextAttemptAt as Timestamp).toMillis()).slice(0, limit)) {
    const notification = await claimNotificationForDelivery(candidate.id, workerId, db) as NotificationRecord | null;
    if (!notification) continue;
    try {
      await deliverNotification(notification, provider, appUrl, db);
      sent += 1;
    } catch (error) {
      failedCount += 1;
      const message = error instanceof Error ? error.message : "EMAIL_DELIVERY_FAILED";
      await recordNotificationFailure({ id: notification.id, errorCode: message, retryAt: retryAt(Number(notification.attempts ?? 1)) }, db);
    }
  }
  return { workerId, sent, failed: failedCount };
}
