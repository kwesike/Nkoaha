import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import DashboardLayout from "./layout/DashboardLayout";

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
  :root{--purple:#7c3aed;--purple-light:#ede9fe;--purple-dark:#5b21b6;--green:#16a34a;--green-bg:#dcfce7;--red:#dc2626;--red-bg:#fee2e2;--surface:#fff;--border:#e7e4df;--bg:#f5f3ef;--text:#1c1917;--muted:#78716c;--font:'DM Sans',sans-serif;--mono:'DM Mono',monospace}
  .st-root{font-family:var(--font);color:var(--text);padding:32px 28px 64px;max-width:680px}
  .st-title{font-size:20px;font-weight:700;margin-bottom:4px}
  .st-sub{font-size:13px;color:var(--muted);margin-bottom:32px}
  .st-section{background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:20px}
  .st-section-head{padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px}
  .st-section-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--purple-light);color:var(--purple);flex-shrink:0}
  .st-section-title{font-size:14px;font-weight:600;color:var(--text)}
  .st-section-desc{font-size:12px;color:var(--muted)}
  .st-row{padding:14px 20px;border-bottom:1px solid #faf9f8;display:flex;align-items:center;gap:14px}
  .st-row:last-child{border-bottom:none}
  .st-row-label{font-size:13px;font-weight:500;color:var(--text);min-width:120px;flex-shrink:0}
  .st-row-value{flex:1;min-width:0}
  .st-input{width:100%;padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--font);font-size:13px;color:var(--text);outline:none;transition:border-color .15s;background:var(--bg)}
  .st-input:focus{border-color:var(--purple);background:#fff}
  .st-input:disabled{opacity:.6;cursor:not-allowed}
  .st-btn{padding:8px 16px;border-radius:8px;font-family:var(--font);font-size:12.5px;font-weight:500;cursor:pointer;border:none;transition:all .15s;white-space:nowrap;flex-shrink:0}
  .st-btn-primary{background:var(--purple);color:#fff}.st-btn-primary:hover{background:var(--purple-dark)}.st-btn-primary:disabled{opacity:.5;cursor:not-allowed}
  .st-btn-ghost{background:transparent;color:var(--muted);border:1.5px solid var(--border)}.st-btn-ghost:hover{background:var(--bg);color:var(--text)}
  .st-btn-danger{background:transparent;color:var(--red);border:1.5px solid var(--red)}.st-btn-danger:hover{background:var(--red-bg)}
  .st-avatar-wrap{display:flex;align-items:center;gap:14px}
  .st-avatar{width:60px;height:60px;border-radius:14px;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;font-size:22px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;border:2px solid var(--purple-light)}
  .st-avatar img{width:100%;height:100%;object-fit:cover}
  .st-sig-wrap{display:flex;align-items:center;gap:14px}
  .st-sig-preview{width:160px;height:56px;border:1.5px dashed var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--bg);overflow:hidden;flex-shrink:0}
  .st-sig-preview img{max-width:100%;max-height:100%;object-fit:contain}
  .st-msg{font-size:12.5px;padding:8px 12px;border-radius:7px;margin-top:8px}
  .st-msg.success{background:var(--green-bg);color:var(--green)}
  .st-msg.error{background:var(--red-bg);color:var(--red)}
  .st-toggle{display:flex;align-items:center;gap:10px}
  .st-toggle-track{width:40px;height:22px;border-radius:11px;background:var(--border);cursor:pointer;position:relative;transition:background .2s;flex-shrink:0}
  .st-toggle-track.on{background:var(--purple)}
  .st-toggle-thumb{width:16px;height:16px;border-radius:50%;background:#fff;position:absolute;top:3px;left:3px;transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.2)}
  .st-toggle-track.on .st-toggle-thumb{left:21px}
`;

export default function SettingsPage() {
  const [org, setOrg]         = useState<any>(null);
  const [email, setEmail]     = useState("");
  const [phone, setPhone]     = useState("");
  const [orgName, setOrgName] = useState("");
  const [saving, setSaving]   = useState(false);
  const [pwNew, setPwNew]     = useState("");
  const [pwNew2, setPwNew2]   = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [msg, setMsg]         = useState<{type:"success"|"error";text:string;field:string}|null>(null);
  const avatarInputRef        = useRef<HTMLInputElement>(null);
  const sigInputRef           = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [sigUrl, setSigUrl]       = useState("");
  const [uploading, setUploading] = useState<"avatar"|"sig"|null>(null);
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifInbox, setNotifInbox] = useState(true);

  useEffect(() => {
    const id = "st-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style"); el.id=id; el.textContent=STYLES;
      document.head.appendChild(el);
    }
    load();
  }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setEmail(p?.email||user.email||""); setPhone(p?.phone||"");
    if (p?.avatar_url) setAvatarUrl(p.avatar_url);
    if (p?.signature_url) setSigUrl(p.signature_url);
    const { data: o } = await supabase.from("organizations").select("*").eq("owner_id", user.id).maybeSingle();
    setOrg(o); setOrgName(o?.name||"");
  }

  const showMsg = (type:"success"|"error", text:string, field:string) => {
    setMsg({type,text,field});
    setTimeout(()=>setMsg(null), 4000);
  };

  async function saveProfile() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
    const { error } = await supabase.from("profiles").update({ phone }).eq("id", user.id);
    if (org) await supabase.from("organizations").update({ name: orgName }).eq("id", org.id);
    setSaving(false);
    error ? showMsg("error", error.message, "profile") : showMsg("success", "Profile saved.", "profile");
  }

  async function changePassword() {
    if (!pwNew || pwNew !== pwNew2) { showMsg("error","New passwords do not match.","pw"); return; }
    if (pwNew.length < 8) { showMsg("error","Password must be at least 8 characters.","pw"); return; }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwNew });
    setPwSaving(false);
    if (error) { showMsg("error", error.message, "pw"); } else {
      showMsg("success","Password updated successfully.","pw");
      setPwNew(""); setPwNew2("");
    }
  }

  async function uploadAvatar(file: File) {
    if (!file.type.startsWith("image/")) { showMsg("error","Please select an image file.","avatar"); return; }
    setUploading("avatar");
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
    const ext = file.name.split(".").pop();
    const path = `avatars/${user.id}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert:true, contentType:file.type });
    if (upErr) { showMsg("error", upErr.message, "avatar"); setUploading(null); return; }
    const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
    setAvatarUrl(url+"?t="+Date.now());
    setUploading(null);
    showMsg("success","Profile photo updated.","avatar");
  }

  async function uploadSignature(file: File) {
    if (!file.type.startsWith("image/")) { showMsg("error","Please select an image file.","sig"); return; }
    setUploading("sig");
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
    const ext = file.name.split(".").pop();
    const path = `avatars/${user.id}/signature.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert:true, contentType:file.type });
    if (upErr) { showMsg("error", upErr.message, "sig"); setUploading(null); return; }
    const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    await supabase.from("profiles").update({ signature_url: url }).eq("id", user.id);
    setSigUrl(url+"?t="+Date.now());
    setUploading(null);
    showMsg("success","Signature updated.","sig");
  }

  const initials = (email||"U").split("@")[0].slice(0,2).toUpperCase();

  return (
    <DashboardLayout>
      <div className="st-root">
        <div className="st-title">Settings</div>
        <div className="st-sub">Manage your account, profile, and preferences</div>

        {/* Profile */}
        <div className="st-section">
          <div className="st-section-head">
            <div className="st-section-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div>
              <div className="st-section-title">Profile</div>
              <div className="st-section-desc">Your personal information</div>
            </div>
          </div>

          {/* Avatar */}
          <div className="st-row">
            <div className="st-row-label">Photo</div>
            <div className="st-row-value">
              <div className="st-avatar-wrap">
                <div className="st-avatar">
                  {avatarUrl ? <img src={avatarUrl} alt="avatar" crossOrigin="anonymous" onError={()=>setAvatarUrl("")}/> : initials}
                </div>
                <div>
                  <button className="st-btn st-btn-ghost" onClick={()=>avatarInputRef.current?.click()} disabled={uploading==="avatar"}>
                    {uploading==="avatar"?"Uploading…":"Change Photo"}
                  </button>
                  <div style={{fontSize:11,color:"var(--muted)",marginTop:4}}>JPG, PNG or WebP. Max 2MB.</div>
                  {msg?.field==="avatar"&&<div className={`st-msg ${msg.type}`}>{msg.text}</div>}
                </div>
              </div>
              <input hidden ref={avatarInputRef} type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f)uploadAvatar(f);e.target.value="";}}/>
            </div>
          </div>

          {/* Email */}
          <div className="st-row">
            <div className="st-row-label">Email</div>
            <div className="st-row-value">
              <input className="st-input" value={email} disabled style={{maxWidth:360}}/>
              <div style={{fontSize:11,color:"var(--muted)",marginTop:4}}>Email cannot be changed here. Contact support.</div>
            </div>
          </div>

          {/* Phone */}
          <div className="st-row">
            <div className="st-row-label">Phone</div>
            <div className="st-row-value" style={{display:"flex",gap:10,alignItems:"center"}}>
              <input className="st-input" value={phone} placeholder="+1 (555) 000-0000" onChange={e=>setPhone(e.target.value)} style={{maxWidth:260}}/>
            </div>
          </div>

          {/* Org name if org admin */}
          {org && (
            <div className="st-row">
              <div className="st-row-label">Organization</div>
              <div className="st-row-value" style={{display:"flex",gap:10,alignItems:"center"}}>
                <input className="st-input" value={orgName} placeholder="Organization name" onChange={e=>setOrgName(e.target.value)} style={{maxWidth:320}}/>
              </div>
            </div>
          )}

          <div style={{padding:"14px 20px",display:"flex",alignItems:"center",gap:12}}>
            <button className="st-btn st-btn-primary" onClick={saveProfile} disabled={saving}>{saving?"Saving…":"Save Changes"}</button>
            {msg?.field==="profile"&&<span className={`st-msg ${msg.type}`} style={{margin:0}}>{msg.text}</span>}
          </div>
        </div>

        {/* Signature */}
        <div className="st-section">
          <div className="st-section-head">
            <div className="st-section-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 19.5v.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8.5L18 5.5"/><path d="M8 18h1l9.1-9.1-1-1L8 17z"/></svg>
            </div>
            <div>
              <div className="st-section-title">Signature</div>
              <div className="st-section-desc">Used when signing documents in the approval chain</div>
            </div>
          </div>
          <div className="st-row">
            <div className="st-row-label">Your Signature</div>
            <div className="st-row-value">
              <div className="st-sig-wrap">
                <div className="st-sig-preview">
                  {sigUrl
                    ? <img src={sigUrl} alt="signature" crossOrigin="anonymous" onError={()=>setSigUrl("")}/>
                    : <span style={{fontSize:11,color:"var(--muted)"}}>No signature</span>
                  }
                </div>
                <div>
                  <button className="st-btn st-btn-ghost" onClick={()=>sigInputRef.current?.click()} disabled={uploading==="sig"}>
                    {uploading==="sig"?"Uploading…":sigUrl?"Replace Signature":"Upload Signature"}
                  </button>
                  <div style={{fontSize:11,color:"var(--muted)",marginTop:4}}>Upload a PNG with transparent background for best results.</div>
                  {msg?.field==="sig"&&<div className={`st-msg ${msg.type}`}>{msg.text}</div>}
                </div>
              </div>
              <input hidden ref={sigInputRef} type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f)uploadSignature(f);e.target.value="";}}/>
            </div>
          </div>
        </div>

        {/* Password */}
        <div className="st-section">
          <div className="st-section-head">
            <div className="st-section-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <div>
              <div className="st-section-title">Password</div>
              <div className="st-section-desc">Change your account password</div>
            </div>
          </div>
          <div className="st-row">
            <div className="st-row-label">New Password</div>
            <div className="st-row-value"><input className="st-input" type="password" value={pwNew} onChange={e=>setPwNew(e.target.value)} placeholder="Min 8 characters" style={{maxWidth:280}}/></div>
          </div>
          <div className="st-row">
            <div className="st-row-label">Confirm</div>
            <div className="st-row-value"><input className="st-input" type="password" value={pwNew2} onChange={e=>setPwNew2(e.target.value)} placeholder="Repeat new password" style={{maxWidth:280}}/></div>
          </div>
          <div style={{padding:"14px 20px",display:"flex",alignItems:"center",gap:12}}>
            <button className="st-btn st-btn-primary" onClick={changePassword} disabled={pwSaving||!pwNew||!pwNew2}>{pwSaving?"Updating…":"Update Password"}</button>
            {msg?.field==="pw"&&<span className={`st-msg ${msg.type}`} style={{margin:0}}>{msg.text}</span>}
          </div>
        </div>

        {/* Notifications */}
        <div className="st-section">
          <div className="st-section-head">
            <div className="st-section-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </div>
            <div>
              <div className="st-section-title">Notifications</div>
              <div className="st-section-desc">Choose what you get notified about</div>
            </div>
          </div>
          {[
            { label:"Email notifications", desc:"Get emailed when documents are routed to you", val:notifEmail, set:setNotifEmail },
            { label:"Inbox notifications", desc:"Show badge when new items arrive in your inbox", val:notifInbox, set:setNotifInbox },
          ].map(n=>(
            <div key={n.label} className="st-row">
              <div className="st-row-value">
                <div className="st-toggle">
                  <div className={`st-toggle-track ${n.val?"on":""}`} onClick={()=>n.set(!n.val)}>
                    <div className="st-toggle-thumb"/>
                  </div>
                  <div>
                    <div style={{fontSize:13,fontWeight:500,color:"var(--text)"}}>{n.label}</div>
                    <div style={{fontSize:11,color:"var(--muted)"}}>{n.desc}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Danger zone */}
        <div className="st-section" style={{borderColor:"#fecaca"}}>
          <div className="st-section-head" style={{borderColor:"#fecaca"}}>
            <div className="st-section-icon" style={{background:"#fee2e2",color:"var(--red)"}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div>
              <div className="st-section-title" style={{color:"var(--red)"}}>Danger Zone</div>
              <div className="st-section-desc">Irreversible actions</div>
            </div>
          </div>
          <div className="st-row">
            <div className="st-row-label">Delete Account</div>
            <div className="st-row-value">
              <div style={{fontSize:12.5,color:"var(--muted)",marginBottom:10}}>Permanently delete your account and all associated data. This cannot be undone.</div>
              <button className="st-btn st-btn-danger" onClick={()=>alert("To delete your account, contact support@nkoaha.com")}>Delete My Account</button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}