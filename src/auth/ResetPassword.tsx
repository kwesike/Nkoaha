import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import "./auth.css";
import logo from "../assets/nkoaha-logo.png";

export default function ResetPassword() {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // ✅ MUST be inside the component
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate("/login");
      }
    });
  }, [navigate]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      return setMessage("Password must be at least 8 characters.");
    }

    if (password !== confirm) {
      return setMessage("Passwords do not match.");
    }

    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.updateUser({
      password
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Password updated successfully.");
      setTimeout(() => navigate("/"), 1500);
    }
  };

  return (
    <div className="page-center">
      <form className="auth-container" onSubmit={handleReset}>
        <div className="auth-logo">
          <img src={logo} alt="Nkoaha Logo" />
        </div>

        <h2>Create new password</h2>
        <p className="auth-subtitle">
          Enter a new password for your account
        </p>

        <div className="input-group">
          <label>New password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="input-group">
          <label>Confirm password</label>
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Updating..." : "Update password"}
        </button>

        {message && <p className="auth-message">{message}</p>}
      </form>
    </div>
  );
}
