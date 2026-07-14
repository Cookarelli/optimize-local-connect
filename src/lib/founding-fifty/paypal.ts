import "server-only";
import { z } from "zod";

const paypalEnvSchema = z.object({
  PAYPAL_CLIENT_ID: z.string().min(1),
  PAYPAL_CLIENT_SECRET: z.string().min(1),
  PAYPAL_WEBHOOK_ID: z.string().min(1),
  PAYPAL_MODE: z.enum(["sandbox", "live"]).default("sandbox"),
});

function apiBase(mode: "sandbox" | "live") {
  return mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

export async function verifyPayPalWebhook(headers: Headers, body: unknown): Promise<boolean> {
  const env = paypalEnvSchema.parse(process.env);
  const authorization = Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const tokenResponse = await fetch(`${apiBase(env.PAYPAL_MODE)}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${authorization}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!tokenResponse.ok) return false;
  const token = z.object({ access_token: z.string() }).parse(await tokenResponse.json());
  const verificationResponse = await fetch(`${apiBase(env.PAYPAL_MODE)}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: env.PAYPAL_WEBHOOK_ID,
      webhook_event: body,
    }),
    cache: "no-store",
  });
  if (!verificationResponse.ok) return false;
  const result = z.object({ verification_status: z.string() }).parse(await verificationResponse.json());
  return result.verification_status === "SUCCESS";
}
