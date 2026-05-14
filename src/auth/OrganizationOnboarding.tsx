import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import "./auth.css";
import logo from "../assets/nkoaha-logo.png";

export default function OrganizationOnboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    organization_type: "",
    industry: "",
    organization_size: "",
    country: "",
    region: "",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate("/");
    });
  }, [navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (Object.values(form).some((v) => !v)) {
      alert("Please complete all fields");
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); navigate("/"); return; }

    // Fetch organization created during signup
    const { data: org, error: orgError } = await supabase
      .from("organizations").select("id, name").eq("owner_id", user.id).single();

    if (orgError || !org) {
      setLoading(false);
      alert("Organization not found");
      return;
    }

    // Update organization details
    const { error: updateError } = await supabase
      .from("organizations").update(form).eq("id", org.id);

    if (updateError) {
      setLoading(false);
      alert(updateError.message);
      return;
    }

    // Mark onboarding complete
    await supabase.from("profiles")
      .update({ onboarding_completed: true }).eq("id", user.id);

    // ── Cache role + org name so DashboardLayout and Topbar show correctly ──
    // This is the same thing MFAVerify does on login — must also happen here
    // because new signups skip MFAVerify and land here first.
    localStorage.setItem("nkoaha_role", "organization");
    localStorage.setItem("nkoaha_name", org.name || "");

    setLoading(false);
    navigate("/dashboard/organizationdashboard");
  };

  return (
    <div className="page-center">
      <form className="auth-container" onSubmit={handleSubmit}>
        <div className="auth-logo">
          <img src={logo} alt="Nkoaha Logo" />
        </div>

        <h2>Organization Information</h2>
        <p className="auth-subtitle">Tell us about your organization</p>

        <div className="input-group">
          <label>Organization Type</label>
          <select name="organization_type" value={form.organization_type} onChange={handleChange} required>
            <option value="">Select</option>
            <option>Company</option>
            <option>NGO</option>
            <option>School</option>
            <option>Church</option>
            <option>Startup</option>
            <option>Government</option>
            <option>Other</option>
          </select>
        </div>

        <div className="input-group">
          <label>Industry / Sector</label>
          <input name="industry" value={form.industry} onChange={handleChange}
            placeholder="Finance, Education, Health, Tech..." required />
        </div>

        <div className="input-group">
          <label>Organization Size</label>
          <select name="organization_size" value={form.organization_size} onChange={handleChange} required>
            <option value="">Select</option>
            <option>1–10</option>
            <option>11–50</option>
            <option>51–200</option>
            <option>200+</option>
          </select>
        </div>

        <div className="input-group">
          <label>Country</label>
          <input name="country" value={form.country} onChange={handleChange} required />
        </div>

        <div className="input-group">
          <label>State / Region / City</label>
          <input name="region" value={form.region} onChange={handleChange} required />
        </div>

        <button disabled={loading}>
          {loading ? "Saving..." : "Continue to Dashboard"}
        </button>
      </form>
    </div>
  );
}