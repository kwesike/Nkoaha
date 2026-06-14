import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import "./auth.css";
import logoImg from "../assets/nkoaha-logo.png";

type AuthMethod = "authenticator" | "email_otp";

export default function OrganizationSignup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [authMethod, setAuthMethod] = useState<AuthMethod>("authenticator");

  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const orgName = form.get("orgName") as string;
    const email = form.get("email") as string;
    const password = form.get("password") as string;

    // 1️⃣ Create auth user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: "organization",
          name: orgName,
        },
      },
    });

    if (error || !data.user) {
      setLoading(false);
      alert(error?.message);
      return;
    }

    // Store org name + role + chosen verification method
    await supabase
      .from("profiles")
      .update({
        full_name: orgName,
        role: "organization",
        auth_method: authMethod,
      })
      .eq("id", data.user.id);

    // 2️⃣ Upload logo
    let logoUrl: string | null = null;

    if (logo) {
      const path = `${data.user.id}.png`;

      const { error: uploadError } = await supabase.storage
        .from("organization-logos")
        .upload(path, logo, { upsert: true });

      if (uploadError) {
        setLoading(false);
        alert(uploadError.message);
        return;
      }

      logoUrl = supabase.storage
        .from("organization-logos")
        .getPublicUrl(path).data.publicUrl;
    }

    // 3️⃣ Create organization
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        owner_id: data.user.id,
        name: orgName,
        logo: logoUrl,
      })
      .select()
      .single();

    if (orgError || !org) {
      setLoading(false);
      alert(orgError?.message || "Failed to create organization");
      return;
    }

    // 4️⃣ Add owner as member
    await supabase.from("organization_members").insert({
      organization_id: org.id,
      user_id: data.user.id,
      role: "admin",
    });

    setLoading(false);

    // ── Route by chosen verification method ──
    if (authMethod === "authenticator") {
      navigate("/mfa");
    } else {
      navigate("/dashboard/organizationdashboard");
    }
  };

  const handleLogoChange = (file: File) => {
    setLogo(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  return (
    <div className="page-center">
      <form className="auth-container" onSubmit={handleSignup}>
        <div className="auth-logo">
          <img src={logoImg} alt="Nkoaha Logo" />
        </div>

        <h2>Organization Signup</h2>

        <div className="input-group">
          <label>Organization name</label>
          <input name="orgName" required />
        </div>

        <div className="input-group">
          <label>Email</label>
          <input name="email" type="email" required />
        </div>

        <div className="input-group">
          <label>Password</label>
          <input name="password" type="password" required />
        </div>

        <div className="input-group">
          <label>Organization logo</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) =>
              e.target.files && handleLogoChange(e.target.files[0])
            }
          />
        </div>

        {/* ✅ Logo preview */}
        {logoPreview && (
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <p style={{ fontSize: 12 }}>Logo preview</p>
            <img
              src={logoPreview}
              alt="Organization Logo Preview"
              style={{
                maxHeight: 100,
                maxWidth: 100,
                borderRadius: 8,
                objectFit: "contain",
              }}
            />
          </div>
        )}

        {/* ── Verification method choice ── */}
        <div className="input-group">
          <label>How should members of your account verify identity?</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={() => setAuthMethod("authenticator")}
              style={methodCardStyle(authMethod === "authenticator")}
            >
              <span style={{ fontSize: 20 }}>🔐</span>
              <span style={{ flex: 1, textAlign: "left" }}>
                <span style={{ display: "block", fontWeight: 600, fontSize: 13.5, color: "#1c1917" }}>
                  Authenticator app
                </span>
                <span style={{ display: "block", fontSize: 11.5, color: "#78716c" }}>
                  Most secure · Google Authenticator, Authy, etc.
                </span>
              </span>
              {authMethod === "authenticator" && <span style={{ color: "#7c3aed", fontWeight: 700 }}>✓</span>}
            </button>

            <button
              type="button"
              onClick={() => setAuthMethod("email_otp")}
              style={methodCardStyle(authMethod === "email_otp")}
            >
              <span style={{ fontSize: 20 }}>✉️</span>
              <span style={{ flex: 1, textAlign: "left" }}>
                <span style={{ display: "block", fontWeight: 600, fontSize: 13.5, color: "#1c1917" }}>
                  Email code
                </span>
                <span style={{ display: "block", fontSize: 11.5, color: "#78716c" }}>
                  A 6-digit code sent to your email each time
                </span>
              </span>
              {authMethod === "email_otp" && <span style={{ color: "#7c3aed", fontWeight: 700 }}>✓</span>}
            </button>
          </div>
          {authMethod === "email_otp" && (
            <p style={{ fontSize: 11, color: "#b45309", background: "#fef9c3", padding: "7px 10px", borderRadius: 7, marginTop: 8, lineHeight: 1.5 }}>
              Email codes are convenient but less secure than an authenticator app.
              You can change this later in Settings.
            </p>
          )}
        </div>

        <button disabled={loading}>
          {loading ? "Creating..." : "Continue"}
        </button>
      </form>
    </div>
  );
}

function methodCardStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "11px 13px",
    borderRadius: 10,
    border: `1.5px solid ${active ? "#7c3aed" : "#e7e4df"}`,
    background: active ? "#ede9fe" : "#fff",
    cursor: "pointer",
    width: "100%",
    transition: "all .15s",
  };
}