import assert from "node:assert/strict";
import test from "node:test";
import { renderFirebaseNotificationEmail } from "../src/lib/firebase/notification-email";
import type { NotificationType } from "../src/lib/firebase/notifications";

const request = { requestId: "request-1", propertyName: "Oak Apartments", categoryName: "Plumbing / Sewer", serviceAreaKey: "rockford-il", problemDescription: "A drain is backing up.", acceptedVendorName: "River City Plumbing" };

test("Firebase transactional templates cover every request update without private contact data", () => {
  const types: NotificationType[] = ["opportunity_assigned", "opportunity_accepted", "opportunity_declined", "opportunity_reassigned", "request_in_progress", "request_completed"];
  for (const type of types) {
    const audience = type === "opportunity_assigned" || type === "opportunity_reassigned" ? "vendor" : "property_manager";
    const email = renderFirebaseNotificationEmail({ type, request, appUrl: "https://staging.example.test", audience });
    assert.match(email.subject, /Optimize Local Connect/);
    assert.match(email.html, /Optimize Local Connect/);
    assert.doesNotMatch(email.html, /Oak Street|815-555|contact@example/);
  }
  const assigned = renderFirebaseNotificationEmail({ type: "opportunity_assigned", request, appUrl: "https://staging.example.test", audience: "vendor" });
  assert.match(assigned.html, /Exact property and contact details remain private/);
  assert.match(assigned.actionUrl, /\/vendor\/opportunities\/request-1$/);
});
