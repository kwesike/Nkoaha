// src/hooks/usePushNotifications.ts
// Handles push notification subscription and sending

import { supabase } from "../lib/supabase";

// ── VAPID Public Key ──
// Generate your own at: https://web-push-codelab.glitch.me
// Or run: npx web-push generate-vapid-keys
// Then set VITE_VAPID_PUBLIC_KEY in your .env
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding  = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64   = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData  = window.atob(base64);
  const arr      = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr;
}

// Register service worker and subscribe to push
export async function subscribeToPush(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("Push notifications not supported");
    return false;
  }
  if (!VAPID_PUBLIC_KEY) {
    console.warn("VITE_VAPID_PUBLIC_KEY not set — push disabled");
    return false;
  }

  try {
    // Register SW
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    // Subscribe
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
    });

    // Save subscription to Supabase
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const sub = subscription.toJSON();
    await supabase.from("push_subscriptions").upsert({
      user_id:   user.id,
      endpoint:  sub.endpoint,
      p256dh:    sub.keys?.p256dh,
      auth:      sub.keys?.auth,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    return true;
  } catch (err) {
    console.error("Push subscription failed:", err);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();

  const { data: { user } } = await supabase.auth.getUser();
  if (user) await supabase.from("push_subscriptions").delete().eq("user_id", user.id);
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

// ── Send a push notification to a user via Supabase Edge Function ──
// This calls your edge function which sends the actual push via web-push library
export async function sendPushToUser(
  userId: string,
  title:  string,
  body:   string,
  url?:   string,
  tag?:   string,
) {
  try {
    await supabase.functions.invoke("send-push", {
      body: { userId, title, body, url: url || "/dashboard", tag },
    });
  } catch (err) {
    // Push is best-effort — never block the main action
    console.warn("Push send failed (non-critical):", err);
  }
}

// ── Browser notification fallback (no server needed) ──
// Shows a local notification when the app is open/focused
export function showLocalNotification(title: string, body: string, url?: string) {
  if (Notification.permission !== "granted") return;
  const n = new Notification(title, {
    body,
    icon:  "/nkoaha-icon-192.png",
    badge: "/nkoaha-icon-96.png",
    tag:   "nkoaha-local",
  });
  n.onclick = () => {
    window.focus();
    if (url) window.location.href = url;
    n.close();
  };
}