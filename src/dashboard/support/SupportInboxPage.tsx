import { useEffect, useState, useRef } from "react";
import { supabase } from "../../lib/supabase";
import AdminLayout from "../../admin/AdminLayout";

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
  :root{
    --purple:#7c3aed;--purple-light:#ede9fe;--purple-dark:#5b21b6;
    --green:#16a34a;--green-bg:#dcfce7;--red:#dc2626;--red-bg:#fee2e2;
    --surface:#fff;--border:#e7e4df;--bg:#f5f3ef;--text:#1c1917;--muted:#78716c;
    --font:'DM Sans',sans-serif;--mono:'DM Mono',monospace;
  }
  .si-root{display:flex;height:calc(100vh - 56px);font-family:var(--font);color:var(--text);overflow:hidden}

  /* ── Left panel: conversation list ── */
  .si-list{width:320px;flex-shrink:0;border-right:1px solid var(--border);background:var(--surface);display:flex;flex-direction:column;overflow:hidden}
  .si-list-head{padding:20px 18px 14px;border-bottom:1px solid var(--border);flex-shrink:0}
  .si-list-title{font-size:17px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:8px}
  .si-badge{background:var(--red);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;font-family:var(--mono)}
  .si-search{margin-top:10px;position:relative}
  .si-search input{width:100%;padding:8px 12px 8px 32px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--font);font-size:13px;color:var(--text);outline:none;background:var(--bg);box-sizing:border-box}
  .si-search input:focus{border-color:var(--purple);background:#fff}
  .si-search-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--muted);pointer-events:none}
  .si-convos{flex:1;overflow-y:auto;padding:6px}
  .si-convo{padding:12px 12px;border-radius:10px;cursor:pointer;transition:background .12s;margin-bottom:2px;border:1.5px solid transparent}
  .si-convo:hover{background:var(--bg)}
  .si-convo.active{background:var(--purple-light);border-color:#c4b5fd}
  .si-convo.unread .si-convo-name{font-weight:700}
  .si-convo-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:3px}
  .si-convo-name{font-size:13px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px}
  .si-convo-time{font-size:10px;color:var(--muted);font-family:var(--mono);flex-shrink:0}
  .si-convo-preview{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .si-convo-meta{display:flex;align-items:center;gap:5px;margin-top:4px;flex-wrap:wrap}
  .si-plan-badge{font-size:10px;padding:1px 7px;border-radius:20px;background:var(--purple-light);color:var(--purple);font-weight:600}
  .si-role-badge{font-size:10px;padding:1px 7px;border-radius:20px;background:#f0fdf4;color:#16a34a;font-weight:600}
  .si-unread-dot{width:8px;height:8px;border-radius:50%;background:var(--purple);flex-shrink:0;margin-left:auto}

  /* ── Right panel: chat view ── */
  .si-chat{flex:1;display:flex;flex-direction:column;overflow:hidden;background:var(--bg)}
  .si-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--muted)}
  .si-empty-icon{font-size:48px;opacity:.3}
  .si-chat-head{background:var(--surface);border-bottom:1px solid var(--border);padding:14px 20px;display:flex;align-items:center;gap:12px;flex-shrink:0}
  .si-chat-avatar{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .si-chat-info{flex:1;min-width:0}
  .si-chat-name{font-size:14px;font-weight:600;color:var(--text)}
  .si-chat-sub{font-size:11.5px;color:var(--muted);display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:1px}
  .si-messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:10px}
  .si-msg-wrap{display:flex;flex-direction:column}
  .si-msg-wrap.user{align-items:flex-start}
  .si-msg-wrap.support{align-items:flex-end}
  .si-msg{max-width:70%;padding:10px 14px;border-radius:14px;font-size:13.5px;line-height:1.6}
  .si-msg.user{background:var(--surface);color:var(--text);border-bottom-left-radius:3px;border:1px solid var(--border)}
  .si-msg.support{background:var(--purple);color:#fff;border-bottom-right-radius:3px}
  .si-msg-meta{font-size:10px;color:var(--muted);margin-top:3px;padding:0 2px}
  .si-reply-bar{background:var(--surface);border-top:1px solid var(--border);padding:12px 16px;flex-shrink:0}
  .si-reply-input{width:100%;padding:10px 14px;border:1.5px solid var(--border);border-radius:10px;font-family:var(--font);font-size:13px;color:var(--text);outline:none;resize:none;min-height:80px;max-height:160px;box-sizing:border-box;transition:border-color .15s;line-height:1.5}
  .si-reply-input:focus{border-color:var(--purple)}
  .si-reply-actions{display:flex;align-items:center;justify-content:space-between;margin-top:8px}
  .si-reply-hint{font-size:11px;color:var(--muted)}
  .si-send-btn{background:var(--purple);color:#fff;border:none;border-radius:8px;padding:9px 20px;font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;transition:background .15s}
  .si-send-btn:hover{background:var(--purple-dark)}
  .si-send-btn:disabled{opacity:.5;cursor:not-allowed}
  .si-sent-badge{font-size:11px;color:var(--green);background:var(--green-bg);padding:4px 10px;border-radius:6px;font-weight:600}

  /* Scrollbar */
  .si-convos::-webkit-scrollbar,.si-messages::-webkit-scrollbar{width:4px}
  .si-convos::-webkit-scrollbar-thumb,.si-messages::-webkit-scrollbar-thumb{background:#d4d0cb;border-radius:4px}
`;

interface Conversation {
  userId:    string;
  email:     string;
  name:      string;
  role:      string;
  plan:      string;
  messages:  Message[];
  lastTime:  string;
  unread:    boolean;
}

interface Message {
  id:     string;
  text:   string;
  sender: "user" | "support";
  time:   string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m`;
  if (h < 24) return `${h}h`;
  return `${d}d`;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function planLabel(plan: string) {
  if (!plan || plan === "free") return "Free";
  return plan.replace("org_","Org ").replace("ind_","Ind ")
    .replace(/_/g," ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function SupportInboxPage() {
  const [convos, setConvos]           = useState<Conversation[]>([]);
  const [authorized, setAuthorized]   = useState<boolean | null>(null);
  const [selected, setSelected]       = useState<string | null>(null);
  const [reply, setReply]             = useState("");
  const [sending, setSending]         = useState(false);
  const [sentFlash, setSentFlash]     = useState(false);
  const [search, setSearch]           = useState("");
  const [loading, setLoading]         = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = "si-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style"); el.id = id; el.textContent = STYLES;
      document.head.appendChild(el);
    }
    // Guard: only organization role can access this page
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setAuthorized(false); return; }
      const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", user.id).single();
      setAuthorized(profile?.role === "admin" || profile?.role === "organization");
    });

    loadConversations();
  }, []);

  // Realtime: refresh when new support_message or support_reply arrives
  useEffect(() => {
    const channel = supabase.channel("support-inbox")
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "activity_logs",
      }, (payload) => {
        if (["support_message","support_reply"].includes(payload.new.action)) {
          loadConversations();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected, convos]);

  async function loadConversations() {
    setLoading(true);
    const { data } = await supabase
      .from("activity_logs")
      .select("id, user_id, action, metadata, created_at")
      .in("action", ["support_message", "support_reply"])
      .order("created_at", { ascending: true });

    if (!data) { setLoading(false); return; }

    // Group by user_id
    const map: Record<string, any> = {};
    for (const row of data) {
      const uid = row.user_id;
      if (!map[uid]) {
        map[uid] = {
          userId:   uid,
          email:    row.metadata?.from_email || "",
          name:     row.metadata?.user_name  || row.metadata?.from_email?.split("@")[0] || "User",
          role:     row.metadata?.user_role  || "individual",
          plan:     row.metadata?.plan       || "free",
          messages: [],
          lastTime: row.created_at,
          unread:   false,
        };
      }
      map[uid].messages.push({
        id:     row.id,
        text:   row.metadata?.message || "",
        sender: row.action === "support_message" ? "user" : "support",
        time:   row.created_at,
      });
      map[uid].lastTime = row.created_at;
      // Mark unread if latest message is from user
      if (row.action === "support_message") map[uid].unread = true;
      if (row.action === "support_reply")   map[uid].unread = false;
      // Carry forward profile info from message rows
      if (row.action === "support_message") {
        if (row.metadata?.from_email) map[uid].email = row.metadata.from_email;
        if (row.metadata?.user_name)  map[uid].name  = row.metadata.user_name;
        if (row.metadata?.user_role)  map[uid].role  = row.metadata.user_role;
        if (row.metadata?.plan)       map[uid].plan  = row.metadata.plan;
      }
    }

    const list = Object.values(map).sort((a: any, b: any) =>
      new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime()
    ) as Conversation[];

    setConvos(list);
    setLoading(false);
  }

  async function sendReply() {
    if (!reply.trim() || !selected || sending) return;
    const text = reply.trim();
    setReply("");
    setSending(true);

    const convo = convos.find(c => c.userId === selected);
    if (!convo) { setSending(false); return; }

    // 1. Save to activity_logs as support_reply → user sees it in chat
    const { data: inserted } = await supabase.from("activity_logs").insert({
      user_id: selected,
      action:  "support_reply",
      metadata: {
        message:    text,
        from_email: "support@nkoaha.space",
        sent_at:    new Date().toISOString(),
        read:       false,
      },
    }).select().single();

    // 2. Send email to user via the support-message edge function pathway
    // We call support-reply edge function directly
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-reply`, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          to:   convo.email,
          from: "support@nkoaha.space",
          text,
        }),
      });
    } catch (e) {
      console.error("Email send failed:", e);
    }

    // Update local state
    setConvos(prev => prev.map(c => {
      if (c.userId !== selected) return c;
      return {
        ...c,
        unread: false,
        lastTime: new Date().toISOString(),
        messages: [...c.messages, {
          id:     inserted?.id || Date.now().toString(),
          text,
          sender: "support",
          time:   new Date().toISOString(),
        }],
      };
    }));

    setSending(false);
    setSentFlash(true);
    setTimeout(() => setSentFlash(false), 2000);
  }

  const selectedConvo = convos.find(c => c.userId === selected) || null;
  const filtered = convos.filter(c =>
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.name.toLowerCase().includes(search.toLowerCase())
  );
  const unreadCount = convos.filter(c => c.unread).length;

  // Block access for non-organization roles
  if (authorized === false) {
    return (
      <AdminLayout title="Support Inbox">
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"60vh",gap:10,color:"#78716c"}}>
          <div style={{fontSize:36}}>🔒</div>
          <div style={{fontSize:16,fontWeight:600,color:"#1c1917"}}>Access Restricted</div>
          <div style={{fontSize:13}}>This page is only available to NkoAha administrators.</div>
        </div>
      </AdminLayout>
    );
  }

  if (authorized === null) return null; // still checking

  return (
    <AdminLayout title="Support Inbox">
      <div className="si-root">

        {/* ── Left: conversation list ── */}
        <div className="si-list">
          <div className="si-list-head">
            <div className="si-list-title">
              Support Inbox
              {unreadCount > 0 && <span className="si-badge">{unreadCount}</span>}
            </div>
            <div className="si-search">
              <svg className="si-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                placeholder="Search users…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="si-convos">
            {loading && (
              <div style={{padding:"24px",textAlign:"center",color:"var(--muted)",fontSize:13}}>
                Loading…
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div style={{padding:"24px",textAlign:"center",color:"var(--muted)",fontSize:13}}>
                No support messages yet
              </div>
            )}
            {filtered.map(c => (
              <div
                key={c.userId}
                className={`si-convo${selected === c.userId ? " active" : ""}${c.unread ? " unread" : ""}`}
                onClick={() => setSelected(c.userId)}
              >
                <div className="si-convo-top">
                  <div className="si-convo-name">{c.name}</div>
                  <div className="si-convo-time">{timeAgo(c.lastTime)}</div>
                </div>
                <div className="si-convo-preview">{c.email}</div>
                <div className="si-convo-meta">
                  <span className="si-role-badge">{c.role.replace("_"," ")}</span>
                  <span className="si-plan-badge">{planLabel(c.plan)}</span>
                  {c.unread && <span className="si-unread-dot"/>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: chat view ── */}
        <div className="si-chat">
          {!selectedConvo ? (
            <div className="si-empty">
              <div className="si-empty-icon">💬</div>
              <div style={{fontSize:15,fontWeight:600,color:"#44403c"}}>Select a conversation</div>
              <div style={{fontSize:13,color:"var(--muted)"}}>Choose a user from the list to view their messages</div>
            </div>
          ) : (<>
            {/* Header */}
            <div className="si-chat-head">
              <div className="si-chat-avatar">
                {selectedConvo.name[0]?.toUpperCase() || "?"}
              </div>
              <div className="si-chat-info">
                <div className="si-chat-name">{selectedConvo.name}</div>
                <div className="si-chat-sub">
                  <span>{selectedConvo.email}</span>
                  <span style={{color:"var(--border)"}}>·</span>
                  <span className="si-role-badge">{selectedConvo.role.replace("_"," ")}</span>
                  <span className="si-plan-badge">{planLabel(selectedConvo.plan)}</span>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="si-messages">
              {selectedConvo.messages.map(m => (
                <div key={m.id} className={`si-msg-wrap ${m.sender}`}>
                  <div className={`si-msg ${m.sender}`}>{m.text}</div>
                  <div className="si-msg-meta">
                    {m.sender === "user" ? selectedConvo.name : "You (Support)"} · {fmt(m.time)}
                  </div>
                </div>
              ))}
              <div ref={bottomRef}/>
            </div>

            {/* Reply bar */}
            <div className="si-reply-bar">
              <textarea
                className="si-reply-input"
                placeholder={`Reply to ${selectedConvo.name}… (Ctrl+Enter to send)`}
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
              />
              <div className="si-reply-actions">
                <div className="si-reply-hint">
                  Reply goes to user's <strong>chat</strong> and <strong>email</strong> simultaneously
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  {sentFlash && <span className="si-sent-badge">✓ Sent</span>}
                  <button
                    className="si-send-btn"
                    onClick={sendReply}
                    disabled={sending || !reply.trim()}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    {sending ? "Sending…" : "Send Reply"}
                  </button>
                </div>
              </div>
            </div>
          </>)}
        </div>

      </div>
    </AdminLayout>
  );
}