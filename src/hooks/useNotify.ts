// src/hooks/useNotify.ts
// Central notification dispatcher — call notify() anywhere in the app
// Sends both a push notification (via Edge Function) AND a local browser notification

import { sendPushToUser, showLocalNotification } from "../hooks/usePushNotifications";

type NotifyPayload = {
  userId:  string;
  title:   string;
  body:    string;
  url?:    string;
  tag?:    string;
};

export async function notify({ userId, title, body, url, tag }: NotifyPayload) {
  // 1. Local notification (instant, works when app is open)
  showLocalNotification(title, body, url);

  // 2. Push notification (works when app is closed/background)
  await sendPushToUser(userId, title, body, url, tag);
}

// ── Notification templates for each action type ──
export const NotifyTemplates = {
  document_received: (docTitle: string, senderEmail: string) => ({
    title: "📄 Document Received",
    body:  `${senderEmail.split("@")[0]} sent you "${docTitle}" for review`,
    tag:   "doc-received",
  }),
  document_approved: (docTitle: string, approverEmail: string) => ({
    title: "✅ Document Approved",
    body:  `${approverEmail.split("@")[0]} approved "${docTitle}"`,
    tag:   "doc-approved",
  }),
  document_signed: (docTitle: string, signerEmail: string) => ({
    title: "✍️ Document Signed",
    body:  `${signerEmail.split("@")[0]} signed and completed "${docTitle}"`,
    tag:   "doc-signed",
  }),
  document_declined: (docTitle: string, declinerEmail: string) => ({
    title: "❌ Document Declined",
    body:  `${declinerEmail.split("@")[0]} declined "${docTitle}"`,
    tag:   "doc-declined",
  }),
  document_comment: (_docTitle: string, senderEmail: string, message: string) => ({
    title: "💬 New Message",
    body:  `${senderEmail.split("@")[0]}: "${message.slice(0, 60)}${message.length > 60 ? "…" : ""}"`,
    tag:   "doc-comment",
  }),
  proof_issued: (docTitle: string, actionLabel: string) => ({
    title: "🏆 Certificate Issued",
    body:  `Your proof certificate for "${docTitle}" (${actionLabel}) is ready`,
    tag:   "proof",
  }),
  org_invite_received: (orgName: string) => ({
    title: "👥 Organisation Invite",
    body:  `You've been invited to join ${orgName}`,
    tag:   "org-invite",
  }),
  member_joined: (memberEmail: string, orgName: string) => ({
    title: "🎉 New Member Joined",
    body:  `${memberEmail.split("@")[0]} joined ${orgName}`,
    tag:   "member-joined",
  }),
  partnership_invite_received: (requesterOrgName: string) => ({
    title: "🤝 Partnership Request",
    body:  `${requesterOrgName} wants to partner with your organisation`,
    tag:   "partnership",
  }),
  partnership_accepted: (partnerOrgName: string) => ({
    title: "🤝 Partnership Accepted",
    body:  `${partnerOrgName} accepted your partnership request`,
    tag:   "partnership",
  }),
};