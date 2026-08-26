import twilio from "twilio";

export interface SmsResult {
  success: boolean;
  sid?: string;
  error?: string;
}

/** Sends a real SMS via Twilio. Returns a result rather than throwing —
 * callers (the risk monitor, Agent Sentinel) log the outcome either way.
 * Never fabricates a "sent" result: if Twilio isn't configured or the send
 * fails, success is false and error explains why. */
export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !from) {
    return {
      success: false,
      error: "SMS isn't configured yet (missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER)",
    };
  }

  try {
    const client = twilio(accountSid, authToken);
    const message = await client.messages.create({ to, from, body });
    return { success: true, sid: message.sid };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to send SMS" };
  }
}
