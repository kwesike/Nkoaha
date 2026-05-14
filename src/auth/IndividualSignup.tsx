import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import "./auth.css";
import logo from "../assets/nkoaha-logo.png";

export default function IndividualSignup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  

  // ✅ Load invite if exists
  useEffect(() => {
    const invite = localStorage.getItem("org_invite");
    if (invite) {
      const parsed = JSON.parse(invite);
      setInviteEmail(parsed.email);
      setOrganizationId(parsed.organization_id);
      
    }
  }, []);

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = inviteEmail ?? (formData.get("email") as string);
    const password = formData.get("password") as string;

    setLoading(true);

    if (inviteEmail && inviteEmail !== email) {
  alert("This invite was sent to a different email address.");
  setLoading(false);
  return;
}


    // ✅ CREATE AUTH USER
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error || !data.user) {
      alert(error?.message);
      setLoading(false);
      return;
    }

    

    const userId = data.user.id;

    // ✅ CREATE PROFILE
    await supabase
  .from("profiles")
  .update({
    full_name: name,
    role: organizationId ? "organization_member" : "individual",
  })
  .eq("id", userId);



      

      {
      // normal individual flow
      navigate("/mfa-setup");
    }

    setLoading(false);
  };

  return (
    <div className="page-center">
      <form className="auth-container" onSubmit={handleSignup}>
        <div className="auth-logo">
          <img src={logo} alt="Nkoaha Logo" />
        </div>

        <h2>{inviteEmail ? "Join Organization" : "Individual Signup"}</h2>

        <div className="input-group">
          <label>Full name</label>
          <input name="name" required />
        </div>

        <div className="input-group">
          <label>Email</label>
          <input
            name="email"
            type="email"
            required
            defaultValue={inviteEmail ?? ""}
            disabled={!!inviteEmail}
          />
        </div>

        <div className="input-group">
          <label>Password</label>
          <input name="password" type="password" required />
        </div>

        <button disabled={loading}>
          {loading ? "Creating…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
