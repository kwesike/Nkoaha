import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import LoadingScreen from "../components/LoadingScreen";

/* ─────────────────────────────────────────────
   NavigationLoader
   Wrap this once inside your router — it shows
   a splash screen whenever the route changes.
   Usage: place <NavigationLoader /> inside
   <BrowserRouter> in App.tsx, before <Routes>.
───────────────────────────────────────────── */
export default function NavigationLoader() {
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    // Show splash for 600ms — enough to feel responsive without being slow
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, [location.pathname]);

  if (!loading) return null;
  return <LoadingScreen message="Loading…" />;
}