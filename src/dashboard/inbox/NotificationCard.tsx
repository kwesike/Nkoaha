import { supabase } from "../../lib/supabase";

interface Props {
  notification: any;
  onAction: () => void;
}

export default function NotificationCard({ notification, onAction }: Props) {
  const isInvite = notification.type === "org_invite";
  const invitationId = notification.data?.invitation_id;
  const organizationId = notification.data?.organization_id;

  const handleAccept = async () => {
    if (!invitationId) return;

    // 1️⃣ Accept invite
    await supabase
      .from("organization_invitations")
      .update({
        status: "accepted",
        responded_at: new Date(),
      })
      .eq("id", invitationId);

    // 2️⃣ Create membership
    await supabase.from("organization_members").insert({
      organization_id: organizationId,
      user_id: (await supabase.auth.getUser()).data.user?.id,
      role: "member",
    });

    // 3️⃣ Mark notification as read
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notification.id);

    onAction();
  };

  const handleDecline = async () => {
    await supabase
      .from("organization_invitations")
      .update({
        status: "declined",
        responded_at: new Date(),
      })
      .eq("id", invitationId);

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notification.id);

    onAction();
  };

  return (
    <div className={`notification-card ${notification.is_read ? "read" : ""}`}>
      <h4>{notification.title}</h4>
      <p>{notification.message}</p>

      {isInvite && !notification.is_read && (
        <div className="invite-actions">
          <button className="accept-btn" onClick={handleAccept}>
            Accept
          </button>
          <button className="decline-btn" onClick={handleDecline}>
            Decline
          </button>
        </div>
      )}
    </div>
  );
}
