// src/lib/securityLog.ts
// Fire-and-forget helper to record a high-value security event (login,
// document_signed, document_sent, payment, document_deleted). The IP address
// and device are captured SERVER-SIDE by the log-security-event edge function,
// so nothing sensitive or spoofable is sent from here — just the event type and
// a little context. Never throws and never blocks the UI: security logging must
// not break a user action.

import { supabase } from "./supabase";

export type SecurityEventType =
  | "login"
  | "document_signed"
  | "document_sent"
  | "payment"
  | "document_deleted";

export async function logSecurityEvent(
  eventType: SecurityEventType,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return; // not signed in yet — nothing to log as this user

    const supaUrl =
      (supabase as any).supabaseUrl || (import.meta as any).env?.VITE_SUPABASE_URL;
    if (!supaUrl) return;

    // Fire and forget. We don't await the body or surface errors.
    await fetch(`${supaUrl}/functions/v1/log-security-event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ event_type: eventType, metadata }),
      keepalive: true, // let it complete even if the page is navigating away
    });
  } catch {
    // Swallow — logging a security event must never break the user's action.
  }
}