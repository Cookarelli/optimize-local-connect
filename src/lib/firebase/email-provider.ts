import "server-only";

export type EmailPayload = { to: string[]; subject: string; html: string; text: string; idempotencyKey: string };
export type EmailProvider = { send(input: EmailPayload): Promise<{ id: string }> };

export class EmailProviderConfigurationError extends Error {
  code = "EMAIL_PROVIDER_REQUIRED";
}

export function getEmailProvider(env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): EmailProvider {
  if (env.EMAIL_PROVIDER !== "resend") throw new EmailProviderConfigurationError("Set EMAIL_PROVIDER=resend to enable Firebase notification delivery.");
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new EmailProviderConfigurationError("Missing RESEND_API_KEY or EMAIL_FROM for notification delivery.");
  return {
    async send(input) {
      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": input.idempotencyKey },
        body: JSON.stringify({ from: env.EMAIL_FROM, to: input.to, subject: input.subject, html: input.html, text: input.text }),
      });
      const body = await response.json().catch(() => null) as { id?: string; message?: string; name?: string } | null;
      if (!response.ok || !body?.id) throw new Error(`EMAIL_PROVIDER_${response.status}_${body?.name ?? "SEND_FAILED"}`);
      return { id: body.id };
    },
  };
}
