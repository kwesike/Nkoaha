import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import LoadingScreen from "../components/LoadingScreen";
import "./auth.css";
import logo from "../assets/nkoaha-logo.png";

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Always clear stale role cache before a new login
    // so the previous user's role never bleeds into this session
    localStorage.removeItem("nkoaha_role");
    localStorage.removeItem("nkoaha_name");

    const form = e.currentTarget;
    const email    = (form.email    as HTMLInputElement).value;
    const password = (form.password as HTMLInputElement).value;

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    navigate("/mfa-verify");
  };

  return (
    <>
      {loading && <LoadingScreen message="Signing you in..." />}
      <div className="page-center">
        <form className="auth-container" onSubmit={handleLogin}>
          <div className="auth-logo">
            <img src={logo} alt="Nkoaha Logo" />
          </div>
          <h2>Welcome back</h2>
          <p className="auth-subtitle">Sign in to continue to Nkoaha</p>
          <div className="input-group">
            <label>Email</label>
            <input name="email" type="email" required />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input name="password" type="password" required />
          </div>
          <div className="auth-actions">
            <span onClick={() => navigate("/forgot-password")}>Forgot password?</span>
          </div>
          <button type="submit" disabled={loading}>Continue</button>
          {error && <p className="auth-error">{error}</p>}
          <p className="auth-footer">
            Don't have an account?{" "}
            <span onClick={() => navigate("/signup")}>Sign up</span>
          </p>
        </form>
      </div>
    </>
  );
}