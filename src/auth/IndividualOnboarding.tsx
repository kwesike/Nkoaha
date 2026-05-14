import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { removeBackground } from "../utils/removeBackground";
import "./auth.css";
import logo from "../assets/nkoaha-logo.png";

export default function IndividualOnboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [phone, setPhone] = useState("");
  const [signatureBlob, setSignatureBlob] = useState<Blob | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // 🔐 Protect page + role check
  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return navigate("/");

      const { data: profile, error } = await supabase
  .from("profiles")
  .select("role, onboarding_completed")
  .eq("id", data.session.user.id)
  .single();

if (error || !profile) {
  console.error("Profile fetch failed", error);
  return navigate("/");
}

if (profile.role !== "individual") {
  return navigate("/dashboard/IndividualDashboard");
}

if (profile.onboarding_completed) {
  return navigate("/dashboard/IndividualDashboard");
}

    };

    checkUser();
  }, [navigate]);

  // 🖊 Signature handling
  const handleSignature = async (file: File) => {
    const processed = await removeBackground(file);
    setSignatureBlob(processed);
    setSignaturePreview(URL.createObjectURL(processed));
  };

  // 🖼 Avatar handling
  const handleAvatar = (file: File) => {
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone || !signatureBlob || !avatarFile) {
      alert("All fields are required");
      return;
    }

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return navigate("/");
    }

    // Upload signature
    const signaturePath = `signatures/${user.id}.png`;
    await supabase.storage
      .from("signatures")
      .upload(signaturePath, signatureBlob, { upsert: true });

    const { data: sigUrl } = supabase.storage
      .from("signatures")
      .getPublicUrl(signaturePath);

    // Upload avatar
    const avatarPath = `avatars/${user.id}.png`;
    await supabase.storage
      .from("avatars")
      .upload(avatarPath, avatarFile, { upsert: true });

    const { data: avatarUrl } = supabase.storage
      .from("avatars")
      .getPublicUrl(avatarPath);

    // Update profile
    await supabase.from("profiles").update({
      phone,
      signature_url: sigUrl.publicUrl,
      avatar_url: avatarUrl.publicUrl,
      onboarding_completed: true,
    }).eq("id", user.id);

    setLoading(false);
    navigate("/dashboard/IndividualDashboard");
  };

  return (
    <div className="page-center">
      <form className="auth-container" onSubmit={handleSubmit}>
        <div className="auth-logo">
          <img src={logo} alt="Nkoaha Logo" />
        </div>

        <h2>Complete your profile</h2>
        <p className="auth-subtitle">
          This helps us personalize your experience
        </p>

        <div className="input-group">
          <label>Phone number</label>
          <input
            type="tel"
            placeholder="+234..."
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>

        <div className="input-group">
          <label>Signature</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) =>
              e.target.files && handleSignature(e.target.files[0])
            }
            required
          />
        </div>

        {signaturePreview && (
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <p style={{ fontSize: 12 }}>Signature preview</p>
            <img src={signaturePreview} style={{ maxHeight: 80 }} />
          </div>
        )}

        <div className="input-group">
          <label>Profile picture</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) =>
              e.target.files && handleAvatar(e.target.files[0])
            }
            required
          />
        </div>

        {avatarPreview && (
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <img
              src={avatarPreview}
              style={{ height: 80, width: 80, borderRadius: "50%" }}
            />
          </div>
        )}

        <button disabled={loading}>
          {loading ? "Saving..." : "Finish setup"}
        </button>
      </form>
    </div>
  );
}
