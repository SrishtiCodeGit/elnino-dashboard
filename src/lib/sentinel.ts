export type SentinelEventType = "report" | "email" | "sms" | "check";
export type SentinelEventStatus = "success" | "error" | "info";

export interface SentinelEvent {
  id: string;
  timestamp: number;
  type: SentinelEventType;
  message: string;
  detail?: string;
  status: SentinelEventStatus;
}

let counter = 0;
export function makeSentinelEvent(
  type: SentinelEventType,
  status: SentinelEventStatus,
  message: string,
  detail?: string
): SentinelEvent {
  counter += 1;
  return { id: `${Date.now()}-${counter}`, timestamp: Date.now(), type, status, message, detail };
}
