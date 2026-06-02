import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";

const STYLES = `
  .sc-fab{position:fixed;bottom:24px;right:24px;z-index:1000;display:flex;flex-direction:column;align-items:flex-end;gap:10px}
  .sc-fab-btn{width:52px;height:52px;border-radius:50%;background:#7c3aed;color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(124,58,237,.45);transition:all .2s;font-size:22px;position:relative}
  .sc-fab-btn:hover{background:#6d28d9;transform:scale(1.07)}
  .sc-fab-btn.open{background:#1c1917}
  .sc-fab-badge{position:absolute;top:-5px;right:-5px;min-width:18px;height:18px;border-radius:20px;background:#dc2626;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 4px;pointer-events:none;border:2px solid #fff}
  .sc-window{width:340px;background:#fff;border-radius:18px;box-shadow:0 16px 56px rgba(0,0,0,.18);border:1px solid #e7e4df;overflow:hidden;animation:sc-in .2s ease;display:flex;flex-direction:column;max-height:560px}
  @keyframes sc-in{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
  .sc-header{background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:14px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0}
  .sc-header-avatar{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
  .sc-header-info{flex:1}
  .sc-header-name{font-size:13px;font-weight:700;color:#fff}
  .sc-header-status{font-size:10px;color:rgba(255,255,255,.7);display:flex;align-items:center;gap:4px;margin-top:1px}
  .sc-status-dot{width:5px;height:5px;border-radius:50%;background:#4ade80;flex-shrink:0}
  .sc-header-actions{display:flex;gap:6px}
  .sc-close{background:none;border:none;color:rgba(255,255,255,.6);cursor:pointer;font-size:18px;line-height:1;padding:2px 4px;border-radius:4px;transition:all .15s}
  .sc-close:hover{color:#fff;background:rgba(255,255,255,.15)}
  .sc-end-btn{background:rgba(220,38,38,.3);border:1px solid rgba(220,38,38,.5);color:#fca5a5;cursor:pointer;font-size:10px;font-weight:600;padding:3px 8px;border-radius:6px;font-family:'DM Sans',sans-serif;transition:all .15s;white-space:nowrap}
  .sc-end-btn:hover{background:rgba(220,38,38,.5);color:#fff}
  .sc-messages{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:#faf9f8}
  .sc-msg-group{display:flex;flex-direction:column}
  .sc-msg-group.user{align-items:flex-end}
  .sc-msg-group.support{align-items:flex-start}
  .sc-msg-sender{font-size:10px;font-weight:600;color:#78716c;margin-bottom:3px;padding:0 2px}
  .sc-msg{max-width:82%;padding:9px 13px;border-radius:14px;font-size:13px;line-height:1.5}
  .sc-msg.user{background:#7c3aed;color:#fff;border-bottom-right-radius:3px}
  .sc-msg.support{background:#fff;color:#1c1917;border-bottom-left-radius:3px;border:1px solid #e7e4df}
  .sc-msg.support.unread{border-color:#7c3aed;background:#faf8ff}
  .sc-msg-time{font-size:10px;opacity:.55;margin-top:3px;padding:0 2px}
  .sc-ended-banner{padding:10px 14px;background:#fef3c7;border-top:1px solid #fde68a;text-align:center;font-size:12px;color:#b45309;font-style:italic;flex-shrink:0}
  .sc-new-chat-btn{width:calc(100% - 24px);margin:10px 12px;padding:9px;background:#7c3aed;color:#fff;border:none;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background .15s;flex-shrink:0}
  .sc-new-chat-btn:hover{background:#6d28d9}
  .sc-input-row{display:flex;gap:8px;padding:10px 12px;border-top:1px solid #e7e4df;background:#fff;flex-shrink:0}
  .sc-input{flex:1;padding:9px 12px;border:1.5px solid #e7e4df;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:13px;color:#1c1917;outline:none;resize:none;max-height:80px;transition:border-color .15s;line-height:1.4}
  .sc-input:focus{border-color:#7c3aed}
  .sc-send{background:#7c3aed;color:#fff;border:none;border-radius:10px;padding:9px 14px;cursor:pointer;font-size:13px;font-weight:600;transition:background .15s;white-space:nowrap;flex-shrink:0}
  .sc-send:hover{background:#6d28d9}.sc-send:disabled{opacity:.5;cursor:not-allowed}
  .sc-notice{font-size:11px;color:#78716c;text-align:center;padding:5px 14px 7px;font-style:italic;background:#fff;flex-shrink:0}
  .sc-history-btn{display:block;width:100%;padding:9px;background:#f5f3ef;border:none;border-top:1px solid #e7e4df;font-size:12px;color:#7c3aed;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background .15s;flex-shrink:0}
  .sc-history-btn:hover{background:#ede9fe}
  .sc-no-session{padding:20px 16px;text-align:center;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px}
  .sc-start-btn{background:#7c3aed;color:#fff;border:none;border-radius:10px;padding:10px 20px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:background .15s;margin-top:4px}
  .sc-start-btn:hover{background:#6d28d9}
`;

interface Msg {
  id: string; text: string; sender: "user" | "support";
  time: string; read: boolean; senderName?: string;
}

interface ChatSession {
  id: string; status: "open" | "closed";
  startedAt: string; endedAt?: string; endedBy?: string;
}

interface SupportChatProps { hasPremium?: boolean; }

export default function SupportChat({ hasPremium: _hasPremium }: SupportChatProps) {
  const [open, setOpen]               = useState(false);
  const [messages, setMessages]       = useState<Msg[]>([]);
  const [session, setSession]         = useState<ChatSession | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [pastSessions, setPastSessions] = useState<ChatSession[]>([]);
  const [input, setInput]             = useState("");
  const [sending, setSending]         = useState(false);
  const [userId, setUserId]           = useState("");
  const [userEmail, setUserEmail]     = useState("");
  const [userName, setUserName]       = useState("");
  const [userRole, setUserRole]       = useState("individual");
  const [userPlan, setUserPlan]       = useState("Free");
  const bottomRef   = useRef<HTMLDivElement>(null);
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTimeRef = useRef<string>("");
  const sessionRef  = useRef<ChatSession | null>(null); // stable ref for poll closure

  // Keep sessionRef in sync
  useEffect(() => { sessionRef.current = session; }, [session]);

  const unreadCount = messages.filter(m => m.sender === "support" && !m.read).length;

  // ── Load user on mount ──
  useEffect(() => {
    const id = "sc-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style"); el.id=id; el.textContent=STYLES;
      document.head.appendChild(el);
    }
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      setUserEmail(user.email || "");
      setUserName(user.email?.split("@")[0] || "User");

      const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", user.id).single();
      setUserRole(profile?.role || "individual");

      const { data: sub } = await supabase
        .from("subscriptions").select("plan_id")
        .eq("user_id", user.id).eq("status","active")
        .order("created_at",{ascending:false}).limit(1).maybeSingle();
      const plan = sub?.plan_id || "free";
      setUserPlan(
        plan === "free" ? "Free" :
        plan.replace("org_","Org ").replace("ind_","Ind ")
          .replace(/_/g," ").replace(/\b\w/g, c => c.toUpperCase())
      );
      await loadActiveSession(user.id);
    });
  }, []);

  // ── Mark read when opened ──
  useEffect(() => {
    if (open) setMessages(prev => prev.map(m => ({ ...m, read: true })));
  }, [open]);

  // ── Scroll to bottom ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Polling: fetch new messages every 3s (guaranteed fallback) ──
  const poll = useCallback(async () => {
    const s = sessionRef.current;
    if (!s?.id || !userId) return;

    // Fetch messages newer than last known
    const q = supabase
      .from("activity_logs")
      .select("id,action,metadata,created_at,chat_session_id")
      .eq("user_id", userId)
      .eq("chat_session_id", s.id)
      .in("action", ["support_message","support_reply"])
      .order("created_at", { ascending: true });
    if (lastTimeRef.current) q.gt("created_at", lastTimeRef.current);

    const { data } = await q;
    if (data?.length) {
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const newMsgs = data
          .filter((r: any) => !existingIds.has(r.id))
          .map((r: any) => ({
            id:         r.id,
            text:       r.metadata?.message || "",
            sender:     (r.action === "support_message" ? "user" : "support") as "user" | "support",
            time:       r.created_at,
            read:       open,
            senderName: r.action === "support_reply"
              ? (r.metadata?.admin_name || "NkoAha Support")
              : (r.metadata?.user_name || "You"),
          }));
        if (newMsgs.length) lastTimeRef.current = newMsgs[newMsgs.length - 1].time;
        return newMsgs.length ? [...prev, ...newMsgs] : prev;
      });
    }

    // Check if session was closed by admin
    if (s.status === "open") {
      const { data: sc } = await supabase
        .from("support_chats").select("status,ended_at,ended_by")
        .eq("id", s.id).single();
      if (sc?.status === "closed") {
        setSession(prev => prev
          ? { ...prev, status: "closed", endedAt: sc.ended_at, endedBy: sc.ended_by }
          : null
        );
      }
    }
  }, [userId, open]);

  // Start/stop poll when session changes
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!session?.id || !userId) return;
    poll(); // immediate first poll
    pollRef.current = setInterval(poll, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [session?.id, userId, poll]);

  // ── Realtime (primary, instant delivery) ──
  useEffect(() => {
    if (!userId || !session?.id) return;
    const channel = supabase
      .channel(`sc-rt-${session.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "activity_logs",
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const row = payload.new as any;
        if (row.chat_session_id !== session.id) return;
        if (!["support_message","support_reply"].includes(row.action)) return;
        setMessages(prev => {
          if (prev.find(m => m.id === row.id)) return prev;
          const msg: Msg = {
            id:         row.id,
            text:       row.metadata?.message || "",
            sender:     row.action === "support_reply" ? "support" : "user",
            time:       row.created_at,
            read:       open,
            senderName: row.action === "support_reply"
              ? (row.metadata?.admin_name || "NkoAha Support")
              : (row.metadata?.user_name || "You"),
          };
          if (msg.time > lastTimeRef.current) lastTimeRef.current = msg.time;
          return [...prev, msg];
        });
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "support_chats",
        filter: `id=eq.${session.id}`,
      }, (payload) => {
        const sc = payload.new as any;
        if (sc.status === "closed") {
          setSession(prev => prev
            ? { ...prev, status: "closed", endedAt: sc.ended_at, endedBy: sc.ended_by }
            : null
          );
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, session?.id]);

  async function loadActiveSession(uid: string) {
    const { data } = await supabase
      .from("support_chats")
      .select("id,status,started_at,ended_at,ended_by")
      .eq("user_id", uid).eq("status","open")
      .order("started_at",{ascending:false}).limit(1).maybeSingle();
    if (data) {
      const s: ChatSession = { id:data.id, status:"open", startedAt:data.started_at };
      setSession(s);
      await loadMessages(data.id, uid);
    }
  }

  async function loadMessages(sessionId: string, uid: string) {
    const { data } = await supabase
      .from("activity_logs")
      .select("id,action,metadata,created_at")
      .eq("user_id", uid).eq("chat_session_id", sessionId)
      .in("action", ["support_message","support_reply"])
      .order("created_at",{ascending:true});
    if (data?.length) {
      const msgs = data.map((r: any) => ({
        id:         r.id,
        text:       r.metadata?.message || "",
        sender:     (r.action === "support_message" ? "user" : "support") as "user" | "support",
        time:       r.created_at,
        read:       true,
        senderName: r.action === "support_reply"
          ? (r.metadata?.admin_name || "NkoAha Support")
          : (r.metadata?.user_name || "You"),
      }));
      setMessages(msgs);
      lastTimeRef.current = msgs[msgs.length - 1]?.time || "";
    }
  }

  async function startNewChat() {
    if (!userId) return;
    const { data, error } = await supabase
      .from("support_chats")
      .insert({ user_id: userId, status: "open" })
      .select("id,status,started_at").single();
    if (error || !data) { console.error(error); return; }
    const s: ChatSession = { id:data.id, status:"open", startedAt:data.started_at };
    setSession(s);
    setMessages([{
      id: "welcome", text: "👋 Hi! How can we help you today?",
      sender: "support", time: new Date().toISOString(), read: true,
      senderName: "NkoAha Support",
    }]);
    lastTimeRef.current = "";
    setShowHistory(false);
  }

  async function sendMessage() {
    if (!input.trim() || sending || !userId || !session?.id) return;
    // Only send if session is open (avoids TypeScript narrowing issue inside JSX)
    const text = input.trim();
    setInput(""); setSending(true);

    const { data: inserted, error } = await supabase.from("activity_logs").insert({
      user_id:         userId,
      action:          "support_message",
      chat_session_id: session.id,
      metadata: {
        message:    text, from_email: userEmail,
        user_name:  userName, user_role:  userRole,
        plan:       userPlan, sent_at: new Date().toISOString(),
      },
    }).select("id,created_at").single();

    if (!error && inserted) {
      setMessages(prev => {
        if (prev.find(m => m.id === inserted.id)) return prev;
        return [...prev, { id:inserted.id, text, sender:"user", time:inserted.created_at, read:true, senderName:"You" }];
      });
      lastTimeRef.current = inserted.created_at;
    } else if (error) {
      console.error("Send failed:", error.message);
    }

    // Best-effort email notification
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (authSession?.access_token) {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-message`, {
          method: "POST",
          headers: { "Content-Type":"application/json", "Authorization":`Bearer ${authSession.access_token}` },
          body: JSON.stringify({ userId, message: text, userEmail, userName }),
        }).catch(() => {});
      }
    } catch (_) {}

    setSending(false);
  }

  async function endChat() {
    if (!session?.id || !confirm("End this support chat?")) return;
    await supabase.from("support_chats")
      .update({ status:"closed", ended_at:new Date().toISOString(), ended_by:"user" })
      .eq("id", session.id);
    setSession(prev => prev ? { ...prev, status:"closed", endedBy:"user" } : null);
  }

  async function loadHistory() {
    const { data } = await supabase
      .from("support_chats").select("id,status,started_at,ended_at,ended_by")
      .eq("user_id", userId).order("started_at",{ascending:false}).limit(10);
    setPastSessions((data||[]).map((d: any) => ({
      id:d.id, status:d.status as "open"|"closed",
      startedAt:d.started_at, endedAt:d.ended_at, endedBy:d.ended_by,
    })));
    setShowHistory(true);
  }

  function fmt(iso: string) {
    return new Date(iso).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  }
  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString([],{month:"short",day:"numeric",year:"numeric"});
  }

  const isOpen = session?.status === "open";

  return (
    <div className="sc-fab">
      {open && (
        <div className="sc-window">
          {/* Header */}
          <div className="sc-header">
            <div className="sc-header-avatar">💬</div>
            <div className="sc-header-info">
              <div className="sc-header-name">NkoAha Support</div>
              <div className="sc-header-status">
                <div className="sc-status-dot"/>
                {isOpen ? "Live chat · ~2h response" : session ? "Chat ended" : "Start a conversation"}
              </div>
            </div>
            <div className="sc-header-actions">
              {isOpen && (
                <button className="sc-end-btn" onClick={endChat} title="End chat">End</button>
              )}
              <button className="sc-close" onClick={() => setOpen(false)}>×</button>
            </div>
          </div>

          {/* No active session */}
          {!session && !showHistory && (
            <div className="sc-no-session">
              <div style={{fontSize:36}}>💬</div>
              <div style={{fontSize:14,fontWeight:600,color:"#1c1917"}}>Start a conversation</div>
              <div style={{fontSize:12,color:"#78716c",textAlign:"center",maxWidth:220}}>
                Our team typically replies within 2 hours
              </div>
              <button className="sc-start-btn" onClick={startNewChat}>Start New Chat</button>
            </div>
          )}

          {/* Active / ended chat */}
          {session && !showHistory && (<>
            <div className="sc-messages">
              {messages.length === 0 && (
                <div style={{textAlign:"center",color:"#a8a29e",fontSize:12,padding:16}}>
                  Send a message to start the conversation
                </div>
              )}
              {messages.map(m => (
                <div key={m.id} className={`sc-msg-group ${m.sender}`}>
                  {m.senderName && <div className="sc-msg-sender">{m.senderName}</div>}
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

            {/* Ended state */}
            {!isOpen && (
              <>
                <div className="sc-ended-banner">
                  Chat ended by {session.endedBy === "user" ? "you" : "our team"}.
                  {session.endedAt && ` · ${fmtDate(session.endedAt)}`}
                </div>
                <button className="sc-new-chat-btn" onClick={startNewChat}>
                  Start New Chat
                </button>
              </>
            )}

            {/* Open state — input */}
            {isOpen && (
              <>
                <div className="sc-input-row">
                  <textarea
                    className="sc-input"
                    rows={1}
                    placeholder="Type your message…"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();} }}
                  />
                  <button className="sc-send" onClick={sendMessage}
                    disabled={sending || !input.trim()}>
                    {sending ? "…" : "Send"}
                  </button>
                </div>
                <div className="sc-notice">Replies appear here and in your email</div>
              </>
            )}
          </>)}

          {/* History */}
          {showHistory && (
            <div style={{flex:1,overflow:"auto",padding:14}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                <button onClick={()=>setShowHistory(false)}
                  style={{background:"none",border:"none",color:"#7c3aed",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>
                  ← Back
                </button>
                <span style={{fontSize:13,fontWeight:600,color:"#1c1917"}}>Chat History</span>
              </div>
              {pastSessions.map(s => (
                <div key={s.id}
                  onClick={async () => { await loadMessages(s.id, userId); setSession(s); setShowHistory(false); }}
                  style={{padding:"10px 12px",border:"1px solid #e7e4df",borderRadius:9,marginBottom:8,cursor:"pointer",background:"#faf9f8",transition:"background .12s"}}
                  onMouseEnter={e=>(e.currentTarget.style.background="#ede9fe")}
                  onMouseLeave={e=>(e.currentTarget.style.background="#faf9f8")}
                >
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:12,fontWeight:600,color:"#1c1917"}}>{fmtDate(s.startedAt)}</span>
                    <span style={{fontSize:10,padding:"1px 7px",borderRadius:20,fontWeight:700,
                      background:s.status==="open"?"#dcfce7":"#f5f3ef",
                      color:s.status==="open"?"#16a34a":"#78716c"}}>
                      {s.status}
                    </span>
                  </div>
                  {s.endedAt && (
                    <div style={{fontSize:11,color:"#78716c",marginTop:2}}>
                      Ended {fmtDate(s.endedAt)} by {s.endedBy}
                    </div>
                  )}
                </div>
              ))}
              {pastSessions.length === 0 && (
                <div style={{textAlign:"center",color:"#a8a29e",fontSize:13,padding:20}}>No past chats</div>
              )}
            </div>
          )}

          {!showHistory && (
            <button className="sc-history-btn" onClick={loadHistory}>📋 View chat history</button>
          )}
        </div>
      )}

      <button className={`sc-fab-btn ${open?"open":""}`} onClick={()=>setOpen(o=>!o)} title="Support">
        {open ? "×" : "💬"}
        {!open && unreadCount > 0 && (
          <span className="sc-fab-badge">{unreadCount>9?"9+":unreadCount}</span>
        )}
      </button>
    </div>
  );
}