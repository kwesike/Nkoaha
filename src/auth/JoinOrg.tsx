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
    const token  = params.get("invite") || "";
    const orgId  = params.get("org") || "";
    const name   = params.get("name") || "the organisation";
    const email  = params.get("email") || "";
    setOrgName(name);

    if (!token || !orgId) {
      setStatus("error");
      setMessage("Invalid invite link. Please ask the organisation admin to resend.");
      return;
    }

    (async () => {
      // If they already have a live session (existing user, or already
      // logged in), process the invite directly.
      const { data: sess } = await supabase.auth.getSession();
      if (sess.session?.user) {
        setStatus("joining");
        await processInvite(sess.session.user.id, sess.session.user.email || email, orgId, token, name);
        return;
      }

      // Otherwise create the account NOW with a temporary password, sign in to
      // guarantee a live session, then process the invite. The user sets their
      // REAL password on the next screen (MFASetupInvite step 1).
      if (!email) {
        setStatus("error");
        setMessage("This invite link is missing an email address. Please ask the admin to resend.");
        return;
      }
      setStatus("joining");

      const tempPassword = `Tmp-${crypto.randomUUID()}`;
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email, password: tempPassword,
      });

      if (signUpErr) {
        // Account already exists from a previous attempt — try signing in is
        // not possible (we don't know their password), so send them to log in.
        if (signUpErr.message?.toLowerCase().includes("already")) {
          setStatus("error");
          setMessage("You already have an account with this email. Please log in, then click the invite link again.");
        } else {
          setStatus("error");
          setMessage(signUpErr.message || "Could not create your account.");
        }
        return;
      }

      // Ensure a live session. If signUp didn't return one (email confirmation
      // on), sign in with the temp password we just set.
      let userId = signUpData.user?.id;
      if (!signUpData.session) {
        const { data: signInData, error: signInErr } =
          await supabase.auth.signInWithPassword({ email, password: tempPassword });
        if (signInErr || !signInData.user) {
          setStatus("error");
          setMessage(
            "Your account was created, but we couldn't start a session automatically. " +
            "This usually means email confirmation is required. Please check your email, " +
            "confirm, then click the invite link again."
          );
          return;
        }
        userId = signInData.user.id;
      }

      if (!userId) {
        setStatus("error");
        setMessage("Could not establish your account session. Please try the link again.");
        return;
      }

      await processInvite(userId, email, orgId, token, name);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function processInvite(
    userId: string, userEmail: string,
    orgId: string, token: string, name: string
  ) {
    try {
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
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        setStatus("error");
        setMessage("This invite link has expired. Please ask the admin to resend.");
        return;
      }

      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ organization_id: orgId, role: "organization_member" })
        .eq("id", userId);

      if (profileErr) {
        const { error: upsertErr } = await supabase.from("profiles").upsert({
          id: userId, email: userEmail,
          role: "organization_member", organization_id: orgId,
        });
        if (upsertErr) {
          setStatus("error");
          setMessage(`Could not add you to the organisation: ${upsertErr.message}`);
          return;
        }
      }

      const { error: acceptErr } = await supabase.from("organization_invites")
        .update({ status: "accepted" })
        .eq("id", invite.id);
      if (acceptErr) console.warn("Could not mark invite accepted:", acceptErr.message);

      const { data: org } = await supabase
        .from("organizations").select("owner_id,name").eq("id", orgId).single();
      if (org?.owner_id) {
        await supabase.from("activity_logs").insert({
          user_id: org.owner_id,
          action: "member_joined",
          metadata: { member_email: userEmail, organization_name: org.name },
        });
      }

      localStorage.setItem("nkoaha_role", "organization_member");
      localStorage.setItem("nkoaha_name", userEmail.split("@")[0]);

      setStatus("done");
      setMessage(`Welcome to ${name}! Setting up your account…`);

      // → MFASetupInvite: user sets their REAL password + picks verification → dashboard
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
          <h2>Checking your invite…</h2>
          <p className="auth-subtitle">One moment.</p>
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
  )
}