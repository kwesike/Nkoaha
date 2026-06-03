import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import "./auth.css";
import logo from "../assets/nkoaha-logo.png";

export default function JoinOrg() {
  const navigate = useNavigate();
  const [status, setStatus]   = useState<"loading"|"joining"|"done"|"error">("loading");
  const [message, setMessage] = useState("");
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get("invite");
    const orgId  = params.get("org");
    const name   = params.get("name") || "the organisation";
    const email  = params.get("email") || "";
    setOrgName(name);

    if (!token || !orgId) {
      setStatus("error");
      setMessage("Invalid invite link. Please ask the organisation admin to resend.");
      return;
    }

    let handled = false;

    async function tryJoin(userId: string, userEmail: string) {
      if (handled) return;
      handled = true;
      setStatus("joining");
      await processInvite(userId, userEmail, orgId!, token!, name);
    }

    // ── Strategy 1: onAuthStateChange (fires when Supabase processes hash) ──
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (handled) return;
        if (session?.user && (event === "SIGNED_IN" || event === "USER_UPDATED")) {
          await tryJoin(session.user.id, session.user.email || email);
        }
      }
    );

    // ── Strategy 2: poll getSession every 500ms for up to 10s ──
    // Supabase v2 processes the #access_token hash asynchronously.
    // getSession() returns null until it's done — polling catches it reliably.
    let attempts = 0;
    const poll = setInterval(async () => {
      if (handled) { clearInterval(poll); return; }
      attempts++;
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        clearInterval(poll);
        await tryJoin(data.session.user.id, data.session.user.email || email);
      }
      if (attempts >= 20) { // 10 seconds
        clearInterval(poll);
        if (!handled) {
          setStatus("error");
          setMessage(
            "Could not verify your invite session. The link may have expired or already been used. " +
            "Please ask the admin to send a new invite."
          );
        }
      }
    }, 500);

    return () => {
      subscription.unsubscribe();
      clearInterval(poll);
    };
  }, []);

  async function processInvite(
    userId: string, userEmail: string,
    orgId: string, token: string, name: string
  ) {
    try {
      // Verify invite — RLS must allow authenticated users to read by token
      const { data: invite, error: inviteErr } = await supabase
        .from("organization_invites")
        .select("id,status,invite_token,expires_at")
        .eq("invite_token", token)
        .eq("organization_id", orgId)
        .maybeSingle();

      if (inviteErr) {
        setStatus("error");
        setMessage(`Could not verify invite: ${inviteErr.message}. Please ask the admin to resend.`);
        return;
      }
      if (!invite) {
        setStatus("error");
        setMessage("Invite not found or already used. Please ask the admin to resend a fresh invite link.");
        return;
      }

      if (invite.status === "accepted") {
        // Already a member — check MFA and redirect
        localStorage.setItem("nkoaha_role", "organization_member");
        localStorage.setItem("nkoaha_name", userEmail.split("@")[0]);
        setStatus("done");
        setMessage(`You are already a member of ${name}.`);
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const hasMFA = factors?.totp?.some((f: any) => f.status === "verified");
        setTimeout(() => navigate(
          hasMFA ? "/dashboard/organizationmembersdashboard" : "/mfa-setup",
          { state: { destination: "/dashboard/organizationmembersdashboard" } }
        ), 2000);
        return;
      }

      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        setStatus("error");
        setMessage("This invite link has expired. Please ask the admin to resend.");
        return;
      }

      // Add to org
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ organization_id: orgId, role: "organization_member" })
        .eq("id", userId);

      if (profileErr) {
        await supabase.from("profiles").upsert({
          id: userId, email: userEmail,
          role: "organization_member", organization_id: orgId,
        });
      }

      // Mark accepted
      await supabase.from("organization_invites")
        .update({ status: "accepted" })
        .eq("id", invite.id);

      // Notify owner
      const { data: org } = await supabase
        .from("organizations").select("owner_id,name").eq("id", orgId).single();
      if (org?.owner_id) {
        await supabase.from("activity_logs").insert({
          user_id: org.owner_id,
          action: "member_joined",
          metadata: { member_email: userEmail, organization_name: org.name, status: "pending" },
        });
      }

      localStorage.setItem("nkoaha_role", "organization_member");
      localStorage.setItem("nkoaha_name", userEmail.split("@")[0]);

      setStatus("done");
      setMessage(`Welcome to ${name}! Setting up your account…`);

      // → Password setup → MFA setup → member dashboard
      setTimeout(() => navigate("/mfa-setup", {
        state: { destination: "/dashboard/organizationmembersdashboard" }
      }), 1500);

    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "Something went wrong. Please try again.");
    }
  }

  return (
    <div className="page-center">
      <div className="auth-container" style={{ textAlign: "center" }}>
        <div className="auth-logo">
          <img src={logo} alt="NkoAha" />
        </div>

        {status === "loading" && (<>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <h2>Joining {orgName || "organisation"}…</h2>
          <p className="auth-subtitle">Verifying your invite link, please wait.</p>
        </>)}

        {status === "joining" && (<>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔄</div>
          <h2>Setting up your account…</h2>
          <p className="auth-subtitle">Adding you to {orgName}, just a moment.</p>
        </>)}

        {status === "done" && (<>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
          <h2 style={{ color: "#16a34a" }}>You're in!</h2>
          <p className="auth-subtitle" style={{ color: "#16a34a" }}>{message}</p>
          <p className="auth-subtitle" style={{ marginTop: 8 }}>Redirecting you now…</p>
        </>)}

        {status === "error" && (<>
          <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
          <h2 style={{ color: "#dc2626" }}>Invite Error</h2>
          <p className="auth-subtitle" style={{ color: "#dc2626", marginBottom: 16 }}>{message}</p>
          <a href="/" style={{ color: "#7c3aed", fontSize: 13 }}>← Back to login</a>
        </>)}
      </div>
    </div>
  );
}