export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/** Sends a real SMS via Vonage's SMS REST API (plain fetch — no SDK needed
 * for a single call). Returns a result rather than throwing — callers (the
 * risk monitor, Agent Sentinel) log the outcome either way. Never
 * fabricates a "sent" result: if Vonage isn't configured or the send
 * fails, success is false and error explains why. */
export async function sendSms(to: string, text: string): Promise<SmsResult> {
  const apiKey = process.env.VONAGE_API_KEY;
  const apiSecret = process.env.VONAGE_API_SECRET;
  const from = process.env.VONAGE_FROM_NUMBER;

  if (!apiKey || !apiSecret || !from) {
    return {
      success: false,
      error: "SMS isn't configured yet (missing VONAGE_API_KEY / VONAGE_API_SECRET / VONAGE_FROM_NUMBER)",
    };
  }

  try {
    const res = await fetch("https://rest.nexmo.com/sms/json", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        api_key: apiKey,
        api_secret: apiSecret,
        to: to.replace(/^\+/, ""),
        from,
        text,
      }),
    });
    const data = await res.json();
    const first = data?.messages?.[0];
    if (!first) return { success: false, error: "Unexpected response from Vonage" };
    if (first.status !== "0") {
      return { success: false, error: first["error-text"] || `Vonage error status ${first.status}` };
    }
    return { success: true, messageId: first["message-id"] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to send SMS" };
  }
}

/** SMS costs real money and can reach real people, so on a public site it is
 * deny-by-default: only numbers listed in SMS_ALLOWLIST (comma-separated,
 * +E.164) can receive alerts. Unset means nobody can. */
export function isAllowedRecipient(phone: string): boolean {
  const allowed = (process.env.SMS_ALLOWLIST ?? "")
    .split(",")
    .map((n) => n.replace(/[^\d+]/g, ""))
    .filter(Boolean);
  return allowed.includes(phone.replace(/[^\d+]/g, ""));
}
