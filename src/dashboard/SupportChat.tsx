import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";

const STYLES = `
  .sc-fab{position:fixed;bottom:24px;right:24px;z-index:1000;display:flex;flex-direction:column;align-items:flex-end;gap:10px}
  .sc-fab-btn{width:52px;height:52px;border-radius:50%;background:#7c3aed;color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(124,58,237,.45);transition:all .2s;font-size:22px;position:relative}
  .sc-fab-btn:hover{background:#6d28d9;transform:scale(1.07)}
  .sc-fab-btn.open{background:#1c1917}
  .sc-fab-badge{position:absolute;top:-5px;right:-5px;min-width:18px;height:18px;border-radius:20px;background:#dc2626;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 4px;font-family:monospace;pointer-events:none;border:2px solid #fff}
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
  .sc-msg.support.unread{border-color:#7c3aed;background:#faf8ff}
  .sc-msg-time{font-size:10px;opacity:.6;margin-top:3px}
  .sc-input-row{display:flex;gap:8px;padding:10px 12px;border-top:1px solid #e7e4df;background:#fff;flex-shrink:0}
  .sc-input{flex:1;padding:9px 12px;border:1.5px solid #e7e4df;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:13px;color:#1c1917;outline:none;resize:none;max-height:80px;transition:border-color .15s;line-height:1.4}
  .sc-input:focus{border-color:#7c3aed}
  .sc-send{background:#7c3aed;color:#fff;border:none;border-radius:10px;padding:9px 14px;cursor:pointer;font-size:13px;font-weight:600;transition:background .15s;white-space:nowrap;flex-shrink:0}
  .sc-send:hover{background:#6d28d9}.sc-send:disabled{opacity:.5;cursor:not-allowed}
  .sc-notice{font-size:11px;color:#78716c;text-align:center;padding:6px 14px 8px;font-style:italic}
`;

interface Msg {
  id:     string;
  text:   string;
  sender: "user" | "support";
  time:   string;
  read:   boolean;
}

interface SupportChatProps {
  hasPremium?: boolean;
}

export default function SupportChat({ hasPremium: _hasPremium }: SupportChatProps) {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { id:"0", text:"👋 Hi! How can we help you today?", sender:"support", time:new Date().toISOString(), read:true }
  ]);
  const [input, setInput]       = useState("");
  const [sending, setSending]   = useState(false);
  const [userId, setUserId]     = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName]   = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Unread count = support messages the user hasn't seen yet (chat was closed)
  const unreadCount = messages.filter(m => m.sender === "support" && !m.read).length;

  // Load user on mount
  useEffect(() => {
    const id = "sc-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style"); el.id=id; el.textContent=STYLES;
      document.head.appendChild(el);
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      setUserEmail(user.email || "");
      setUserName(user.email?.split("@")[0] || "");
    });
  }, []);

  // Mark all support messages as read when chat is opened
  useEffect(() => {
    if (open) {
      setMessages(prev => prev.map(m => ({ ...m, read: true })));
    }
  }, [open]);

  // Realtime: listen for support_reply rows in activity_logs
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`support-replies-${userId}`)
      .on("postgres_changes", {
        event:  "INSERT",
        schema: "public",
        table:  "activity_logs",
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        if (payload.new.action !== "support_reply") return;
        const meta = payload.new.metadata || {};
        setMessages(prev => [...prev, {
          id:     payload.new.id || Date.now().toString(),
          text:   meta.message || "",
          sender: "support",
          time:   meta.sent_at || new Date().toISOString(),
          read:   open, // mark read immediately if chat is already open
        }]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    setMessages(prev => [...prev, {
      id:     Date.now().toString(),
      text,
      sender: "user",
      time:   new Date().toISOString(),
      read:   true,
    }]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-message`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ userId, message: text, userEmail, userName }),
      });
    } catch (e) {
      console.error("Support message failed:", e);
    }

    setTimeout(() => {
      setMessages(prev => [...prev, {
        id:     Date.now().toString(),
        text:   `Got it! We'll reply to ${userEmail || "your email"} and it'll appear here too. Typical response time is under 2 hours.`,
        sender: "support",
        time:   new Date().toISOString(),
        read:   true, // auto-confirmation is immediately read
      }]);
      setSending(false);
    }, 800);
  }

  function fmt(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
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
                Live chat · Typically replies in ~2h
              </div>
            </div>
            <button className="sc-close" onClick={() => setOpen(false)}>×</button>
          </div>

          <div className="sc-messages">
            {messages.map(m => (
              <div key={m.id} style={{display:"flex",flexDirection:"column",alignItems:m.sender==="user"?"flex-end":"flex-start"}}>
                <div className={`sc-msg ${m.sender}${m.sender==="support"&&!m.read?" unread":""}`}>
                  {m.text}
                </div>
                <div className="sc-msg-time" style={{alignSelf:m.sender==="user"?"flex-end":"flex-start"}}>
                  {fmt(m.time)}
                </div>
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
          <div className="sc-notice">Replies from our team will appear here</div>
        </div>
      )}

      {/* FAB button with unread badge */}
      <button
        className={`sc-fab-btn ${open?"open":""}`}
        onClick={() => setOpen(o => !o)}
        title="Support"
      >
        {open ? "×" : "💬"}
        {!open && unreadCount > 0 && (
          <span className="sc-fab-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>
    </div>
  );
}