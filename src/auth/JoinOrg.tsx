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
    const token   = params.get("invite");
    const orgId   = params.get("org");
    const name    = params.get("name") || "the organisation";
    const email   = params.get("email") || "";
    setOrgName(name);

    if (!token || !orgId) {
      setStatus("error");
      setMessage("Invalid invite link. Please ask the organisation admin to resend.");
      return;
    }

    // ── Key fix: use a `handled` flag so joinOrg is never called twice ──
    // Supabase fires both onAuthStateChange AND getSession can return a session,
    // which caused double-execution and race conditions.
    let handled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (handled) return;
      // USER_UPDATED fires for magic links in Supabase v2; SIGNED_IN also fires
      if ((event === "SIGNED_IN" || event === "USER_UPDATED") && session?.user) {
        handled = true;
        setStatus("joining");
        await joinOrg(session.user.id, session.user.email || email, orgId, token, name);
      }
    });

    // Also check if session already exists (user clicked link in same browser)
    supabase.auth.getSession().then(async ({ data }) => {
      if (handled) return;
      if (data.session?.user) {
        handled = true;
        setStatus("joining");
        await joinOrg(data.session.user.id, data.session.user.email || email, orgId, token, name);
      }
    });

    // ── Timeout: if no session after 8s, Supabase redirected to login instead ──
    // Root cause: /join-org must be whitelisted in Supabase →
    //   Auth → URL Configuration → Redirect URLs:
    //     https://nkoaha.space/join-org
    //     https://nkoaha.space/join-org/*
    //     http://localhost:5173/join-org
    //     http://localhost:5173/join-org/*
    const timeout = setTimeout(() => {
      if (!handled) {
        setStatus("error");
        setMessage(
          "Your invite session expired or the link was already used. " +
          "Please ask the admin to resend the invite."
        );
      }
    }, 8000);

    return () => { subscription.unsubscribe(); clearTimeout(timeout); };
  }, []);

  async function joinOrg(userId: string, userEmail: string, orgId: string, token: string, name: string) {
    try {
      const { data: invite } = await supabase
        .from("organization_invites")
        .select("id,status,invite_token,expires_at")
        .eq("invite_token", token)
        .eq("organization_id", orgId)
        .single();

      if (!invite) {
        setStatus("error");
        setMessage("Invite not found or already used. Please ask the admin to resend.");
        return;
      }

      if (invite.status === "accepted") {
        localStorage.setItem("nkoaha_role", "organization_member");
        localStorage.setItem("nkoaha_name", userEmail.split("@")[0]);
        setStatus("done");
        setMessage(`You are already a member of ${name}.`);
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const hasMFA = factors?.totp?.some((f:any) => f.status === "verified");
        setTimeout(() => navigate(hasMFA ? "/dashboard/organizationmembersdashboard" : "/mfa-setup", {
          state: { destination: "/dashboard/organizationmembersdashboard" }
        }), 2000);
        return;
      }

      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        setStatus("error");
        setMessage("This invite link has expired. Please ask the admin to resend.");
        return;
      }

      // Update profile role + org
      const { error: profileErr } = await supabase.from("profiles")
        .update({ organization_id: orgId, role: "organization_member" })
        .eq("id", userId);

      if (profileErr) {
        await supabase.from("profiles").upsert({
          id:              userId,
          email:           userEmail,
          role:            "organization_member",
          organization_id: orgId,
        });
      }

      await supabase.from("organization_invites")
        .update({ status: "accepted" })
        .eq("id", invite.id);

      const { data: org } = await supabase
        .from("organizations").select("owner_id,name").eq("id", orgId).single();
      if (org?.owner_id) {
        await supabase.from("activity_logs").insert({
          user_id:  org.owner_id,
          action:   "member_joined",
          metadata: {
            member_email:      userEmail,
            organization_name: org.name,
            status:            "pending",
          },
        });
      }

      localStorage.setItem("nkoaha_role", "organization_member");
      localStorage.setItem("nkoaha_name", userEmail.split("@")[0]);

      setStatus("done");
      setMessage(`Welcome to ${name}! Setting up your account security…`);
      setTimeout(() => navigate("/mfa-setup", {
        state: { destination: "/dashboard/organizationmembersdashboard" }
      }), 2000);

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

        {status === "loading" && (
          <>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <h2>Joining {orgName || "organisation"}…</h2>
            <p className="auth-subtitle">Verifying your invite link, please wait.</p>
          </>
        )}

        {status === "joining" && (
          <>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔄</div>
            <h2>Setting up your account…</h2>
            <p className="auth-subtitle">Adding you to {orgName}, just a moment.</p>
          </>
        )}

        {status === "done" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <h2 style={{ color: "#16a34a" }}>You're in!</h2>
            <p className="auth-subtitle" style={{ color: "#16a34a" }}>{message}</p>
            <p className="auth-subtitle" style={{ marginTop: 8 }}>Redirecting you to your dashboard…</p>
          </>
        )}

        {status === "error" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
            <h2 style={{ color: "#dc2626" }}>Invite Error</h2>
            <p className="auth-subtitle" style={{ color: "#dc2626", marginBottom: 16 }}>{message}</p>
            <a href="/" style={{ color: "#7c3aed", fontSize: 13 }}>← Back to login</a>
          </>
        )}
      </div>
    </div>
  );
}