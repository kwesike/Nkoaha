import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import "./auth.css";
import logoImg from "../assets/nkoaha-logo.png";

export default function OrganizationSignup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

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
  await supabase
  .from("profiles")
  .update({
    full_name: orgName,
    role: "organization",
  })
  .eq("id", data.user.id);




  // 2️⃣ Upload logo (FIXED PATH)
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

  // 3️⃣ Create organization (CHECK ERROR)
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

  // 4️⃣ Add owner as member (FIXED COLUMN NAME)
  await supabase.from("organization_members").insert({
    organization_id: org.id, // ✅ correct
    user_id: data.user.id,
    role: "admin",
  });

  setLoading(false);
  navigate("/mfa-setup");
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

        <button disabled={loading}>
          {loading ? "Creating..." : "Continue"}
        </button>
      </form>
    </div>
  );
}
