import { useNavigate } from "react-router-dom";
import "./auth.css";
import logo from "../assets/nkoaha-logo.png";

export default function SignupSelect() {
  const navigate = useNavigate();

  return (
    <div className="page-center">
      <div className="auth-container">
        <div className="auth-logo">
          <img src={logo} alt="Nkoaha Logo" />
        </div>

        <h2>Create an account</h2>
        <p className="auth-subtitle">Choose how you want to sign up</p>

        <button onClick={() => navigate("/signup/individual")}>
          👤 Individual
        </button>

        <button
          style={{ marginTop: 12 }}
          onClick={() => navigate("/signup/organization")}
        >
          🏢 Organization
        </button>
      </div>
    </div>
  );
}
