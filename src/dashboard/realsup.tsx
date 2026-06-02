import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";

const SUPPORT_EMAIL = "support@nkoaha.com";

const STYLES = `
  .sc-fab{position:fixed;bottom:24px;right:24px;z-index:1000;display:flex;flex-direction:column;align-items:flex-end;gap:10px}
  .sc-fab-btn{width:52px;height:52px;border-radius:50%;background:#7c3aed;color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(124,58,237,.45);transition:all .2s;font-size:22px}
  .sc-fab-btn:hover{background:#6d28d9;transform:scale(1.07)}
  .sc-fab-btn.open{background:#1c1917}
  .sc-window{width:340px;background:#fff;border-radius:18px;box-shadow:0 16px 56px rgba(0,0,0,.18);border:1px solid #e7e4df;overflow:hidden;animation:sc-in .2s ease;display:flex;flex-direction:column;max-height:520px}
  @keyframes sc-in{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
  .sc-header{background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:16px 18px;display:flex;align-items:center;gap:10px;flex-shrink:0}
  .sc-header-avatar{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
  .sc-header-info{flex:1}
  .sc-header-name{font-size:14px;font-weight:700;color:#fff}
  .sc-header-status{font-size:11px;color:rgba(255,255,255,.7);display:flex;align-items:center;gap:4px}
  .sc-status-dot{width:6px;height:6px;border-radius:50%;background:#4ade80}
  .sc-close{background:none;border:none;color:rgba(255,255,255,.7);cursor:pointer;font-size:20px;line-height:1;padding:0}
  .sc-close:hover{color:#fff}
  .sc-messages{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:#faf9f8}
  .sc-msg{max-width:82%;padding:9px 13px;border-radius:14px;font-size:13px;line-height:1.5;font-family:'DM Sans',sans-serif}
  .sc-msg.user{background:#7c3aed;color:#fff;align-self:flex-end;border-bottom-right-radius:3px}
  .sc-msg.support{background:#fff;color:#1c1917;align-self:flex-start;border-bottom-left-radius:3px;border:1px solid #e7e4df}
  .sc-msg-time{font-size:10px;opacity:.6;margin-top:3px;text-align:right}
  .sc-input-row{display:flex;gap:8px;padding:10px 12px;border-top:1px solid #e7e4df;background:#fff;flex-shrink:0}
  .sc-input{flex:1;padding:9px 12px;border:1.5px solid #e7e4df;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:13px;color:#1c1917;outline:none;resize:none;max-height:80px;transition:border-color .15s;line-height:1.4}
  .sc-input:focus{border-color:#7c3aed}
  .sc-send{background:#7c3aed;color:#fff;border:none;border-radius:10px;padding:9px 14px;cursor:pointer;font-size:13px;font-weight:600;transition:background .15s;white-space:nowrap;flex-shrink:0}
  .sc-send:hover{background:#6d28d9}.sc-send:disabled{opacity:.5;cursor:not-allowed}
  .sc-email-banner{padding:20px 18px;text-align:center}
  .sc-email-icon{font-size:36px;margin-bottom:10px}
  .sc-email-title{font-size:14px;font-weight:700;color:#1c1917;margin-bottom:6px}
  .sc-email-desc{font-size:12.5px;color:#78716c;line-height:1.6;margin-bottom:14px}
  .sc-email-addr{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:#ede9fe;color:#7c3aed;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:none;font-family:'DM Sans',sans-serif;transition:background .15s}
  .sc-email-addr:hover{background:#ddd6fe}
  .sc-copied{font-size:11px;color:#16a34a;margin-top:8px}
`;

interface SupportChatProps {
  hasPremium: boolean; // true for growth, enterprise, ind_monthly, ind_yearly
}

export default function SupportChat({ hasPremium }: SupportChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{id:string;text:string;sender:"user"|"support";time:Date}[]>([
    { id:"0", text:"👋 Hi! How can we help you today?", sender:"support", time: new Date() }
  ]);
  const [input, setInput]   = useState("");
  const [sending, setSending] = useState(false);
  const [copied, setCopied]   = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = "sc-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style"); el.id=id; el.textContent=STYLES;
      document.head.appendChild(el);
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    // Add to UI immediately
    const msgId = Date.now().toString();
    setMessages(prev => [...prev, { id:msgId, text, sender:"user", time: new Date() }]);

    // Send to support via Supabase (stores in activity_logs for now)
    // In production: replace with Resend/Sendgrid API call to send email
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("activity_logs").insert({
      user_id:  user?.id || null,
      action:   "support_message",
      metadata: {
        message:    text,
        from_email: userEmail,
        sent_at:    new Date().toISOString(),
        status:     "pending",
      },
    });

    // Auto-reply to confirm receipt
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: `Thanks for reaching out! We've received your message and will reply to ${userEmail || "your email"} shortly. Our typical response time is under 2 hours.`,
        sender: "support",
        time: new Date(),
      }]);
      setSending(false);
    }, 800);
  }

  function copyEmail() {
    navigator.clipboard.writeText(SUPPORT_EMAIL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function fmt(d: Date) {
    return d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
  }

  return (
    <div className="sc-fab">
      {open && (
        <div className="sc-window">
          <div className="sc-header">
            <div className="sc-header-avatar">💬</div>
            <div className="sc-header-info">
              <div className="sc-header-name">NkoAha Support</div>
              <div className="sc-header-status">
                <div className="sc-status-dot"/>
                {hasPremium ? "Live chat · Typically replies in ~2h" : "Contact us"}
              </div>
            </div>
            <button className="sc-close" onClick={() => setOpen(false)}>×</button>
          </div>

          {hasPremium ? (<>
            <div className="sc-messages">
              {messages.map(m => (
                <div key={m.id} style={{display:"flex",flexDirection:"column",alignItems:m.sender==="user"?"flex-end":"flex-start"}}>
                  <div className={`sc-msg ${m.sender}`}>{m.text}</div>
                  <div className="sc-msg-time" style={{alignSelf:m.sender==="user"?"flex-end":"flex-start"}}>{fmt(m.time)}</div>
                </div>
              ))}
              <div ref={bottomRef}/>
            </div>
            <div className="sc-input-row">
              <textarea
                className="sc-input"
                rows={1}
                placeholder="Type your message…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();} }}
              />
              <button className="sc-send" onClick={sendMessage} disabled={sending||!input.trim()}>
                {sending ? "…" : "Send"}
              </button>
            </div>
          </>) : (
            <div className="sc-email-banner">
              <div className="sc-email-icon">✉️</div>
              <div className="sc-email-title">Contact Us</div>
              <div className="sc-email-desc">
                Send us an email and we'll get back to you within 24 hours.<br/>
                Upgrade to Growth or Enterprise for live chat support.
              </div>
              <button className="sc-email-addr" onClick={copyEmail}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                {SUPPORT_EMAIL}
              </button>
              {copied && <div className="sc-copied">✓ Email address copied!</div>}
            </div>
          )}
        </div>
      )}
      <button className={`sc-fab-btn ${open?"open":""}`} onClick={() => setOpen(o => !o)} title="Support">
        {open ? "×" : "💬"}
      </button>
    </div>
  );
}