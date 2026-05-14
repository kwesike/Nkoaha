import logo from "../assets/nkoaha-logo.png";
import "./loading.css";

interface LoadingScreenProps {
  message?: string;
}

export default function LoadingScreen({ message }: LoadingScreenProps) {
  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <img src={logo} alt="Nkoaha" className="loading-logo" />
        <p>{message || "Signing you in..."}</p>
      </div>
    </div>
  );
}
