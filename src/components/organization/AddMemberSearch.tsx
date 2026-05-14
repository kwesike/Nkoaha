import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import "../organization/dash.css";

interface Profile {
  id: string;
  email: string;
}

interface Props {
  organizationId: string;
  organizationName: string; // pass org name for notification
  onClose: () => void;
}

export default function AddMemberSearch({ organizationId, organizationName, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  const domainSuggestions = ["gmail.com", "yahoo.com", "outlook.com", "icloud.com"];

  // Search profiles
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const searchProfiles = async () => {
      setLoading(true);

      const { data } = await supabase
        .from("profiles")
        .select("id, email")
        .ilike("email", `%${query}%`)
        .limit(5);

      setResults(data || []);
      setLoading(false);
    };

    searchProfiles();
  }, [query]);

  // Invite member
  const inviteMember = async (user: Profile) => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return;

    // 1️⃣ Insert into organization_invitations
    const { data: invitation, error: inviteError } = await supabase
      .from("organization_invitations")
      .insert({
        organization_id: organizationId,
        invited_user_id: user.id,
        invited_by: authData.user.id,
        status: "pending",
      })
      .select()
      .single();

    if (inviteError || !invitation) {
      console.error(inviteError);
      alert("Failed to send invitation");
      return;
    }

    // 2️⃣ Create notification for invited user
    const { error: notifError } = await supabase.from("notifications").insert({
      user_id: user.id, // recipient
      type: "org_invite",
      title: `Invitation to join ${organizationName}`,
      message: `${authData.user.email} invited you to join the organization.`,
      data: {
        invitation_id: invitation.id,
        organization_id: organizationId,
      },
      is_read: false,
      created_at: new Date(),
    });

    if (notifError) {
      console.error(notifError);
      alert("Invitation sent but failed to notify the user.");
    } else {
      alert("Invitation sent successfully!");
    }

    onClose();
  };

  return (
    <div className="add-member-modal">
      <div className="add-member-box">
        <h3>Add Member</h3>

        <input
          placeholder="Search email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />

        {!query.includes("@") && (
          <div className="email-suggestions">
            {domainSuggestions.map((domain) => (
              <span
                key={domain}
                onClick={() => setQuery(query + "@" + domain)}
              >
                @{domain}
              </span>
            ))}
          </div>
        )}

        <div className="search-results">
          {loading && <p>Searching...</p>}

          {results.map((user) => (
            <div
              key={user.id}
              className="search-item"
              onClick={() => inviteMember(user)}
            >
              {user.email}
            </div>
          ))}

          {!loading && query && results.length === 0 && (
            <p>No user found</p>
          )}
        </div>

        <button className="close-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
