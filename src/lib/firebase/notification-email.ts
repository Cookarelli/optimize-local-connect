import type { NotificationType } from "@/src/lib/firebase/notifications";

export type TransactionalEmail = {
  subject: string;
  text: string;
  html: string;
  actionUrl: string;
};

type RequestEmailContext = {
  requestId: string;
  propertyName: string;
  categoryName: string;
  serviceAreaKey: string;
  problemDescription: string;
  acceptedVendorName: string | null;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}

function displayArea(value: string) {
  return value.split("-").filter(Boolean).map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`).join(" ");
}

function actionLink(url: string, label: string) {
  return `<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 18px;border-radius:999px;font-weight:700;text-decoration:none">${escapeHtml(label)}</a></p>`;
}

function template(title: string, body: string, url: string, label: string, footer: string) {
  return {
    subject: `Optimize Local Connect — ${title}`,
    text: `${title}\n\n${body}\n\n${label}: ${url}\n\n${footer}`,
    html: `<!doctype html><html><body style="margin:0;background:#f8fafc;color:#0f172a;font-family:Arial,sans-serif"><main style="max-width:600px;margin:24px auto;background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:32px"><p style="margin:0;color:#047857;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Optimize Local Connect</p><h1 style="margin:14px 0 0;font-size:26px">${escapeHtml(title)}</h1><p style="margin:18px 0 0;line-height:1.6">${escapeHtml(body)}</p>${actionLink(url, label)}<p style="margin:0;color:#64748b;font-size:12px;line-height:1.5">${escapeHtml(footer)}</p></main></body></html>`,
    actionUrl: url,
  };
}

export function renderFirebaseNotificationEmail(input: { type: NotificationType; request: RequestEmailContext; appUrl: string; audience: "vendor" | "property_manager" | "platform_admin" }): TransactionalEmail {
  const { type, request, appUrl, audience } = input;
  const safeSummary = `Service: ${request.categoryName}. Area: ${displayArea(request.serviceAreaKey)}.`;
  const vendorUrl = `${appUrl}/vendor/opportunities/${encodeURIComponent(request.requestId)}`;
  const pmUrl = `${appUrl}/property-manager/service-requests/${encodeURIComponent(request.requestId)}`;
  const adminUrl = `${appUrl}/admin/service-requests`;
  const recipientUrl = audience === "vendor" ? vendorUrl : audience === "platform_admin" ? adminUrl : pmUrl;
  if (type === "opportunity_assigned" || type === "opportunity_reassigned") {
    const reassigned = type === "opportunity_reassigned";
    return template(reassigned ? "A new opportunity was reassigned to your team" : "A new opportunity is ready for your team", `${safeSummary} Review the request details and respond in Connect. Exact property and contact details remain private unless your team accepts.`, vendorUrl, "Review opportunity", "This message contains only the information needed to evaluate the opportunity.");
  }
  if (type === "opportunity_accepted") return template("A vendor accepted your service request", `${request.acceptedVendorName ?? "A vendor"} accepted the ${request.categoryName} request for ${request.propertyName}. Their approved contact details are now available in Connect.`, recipientUrl, audience === "platform_admin" ? "Review request" : "View request", "The request remains managed in your private Connect workspace.");
  if (type === "opportunity_declined") return template("A vendor declined a service request", `The ${request.categoryName} request for ${request.propertyName} needs another review. No private vendor response details are included in this email.`, recipientUrl, audience === "platform_admin" ? "Review request" : "View request", "Connect will keep the request in review until another eligible vendor is assigned.");
  if (type === "request_in_progress") return template("Work has started", `${request.acceptedVendorName ?? "Your accepted vendor"} marked the ${request.categoryName} request for ${request.propertyName} as in progress.`, recipientUrl, audience === "platform_admin" ? "Review request" : "View request", "Use Connect for the current status and request history.");
  if (type === "request_completed") return template("Work was marked completed", `${request.acceptedVendorName ?? "Your accepted vendor"} marked the ${request.categoryName} request for ${request.propertyName} as completed.`, recipientUrl, audience === "platform_admin" ? "Review request" : "View request", "The completed status and timeline are available in Connect.");
  return template("Connect notification", "There is an update in your Optimize Local Connect workspace.", recipientUrl, "Open Connect", "This is a transactional service notification.");
}
