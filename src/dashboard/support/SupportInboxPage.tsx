import { useEffect, useState, useRef } from "react";
import { supabase } from "../../lib/supabase";
import AdminLayout from "../../admin/AdminLayout";

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
  .si-root{display:flex;height:calc(100vh - 52px);font-family:'DM Sans',sans-serif;color:#1c1917;overflow:hidden}
  .si-list{width:300px;flex-shrink:0;border-right:1px solid #e7e4df;background:#fff;display:flex;flex-direction:column;overflow:hidden}
  .si-list-head{padding:16px 14px 12px;border-bottom:1px solid #e7e4df;flex-shrink:0}
  .si-list-title{font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px}
  .si-badge{background:#dc2626;color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:20px}
  .si-tabs{display:flex;gap:3px;background:#f5f3ef;border-radius:7px;padding:2px;margin-top:10px}
  .si-tab{flex:1;padding:5px;border-radius:5px;border:none;background:transparent;font-size:11px;font-weight:600;cursor:pointer;color:#78716c;font-family:inherit;transition:all .12s}
  .si-tab.active{background:#fff;color:#7c3aed;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  .si-search{margin-top:8px;position:relative}
  .si-search input{width:100%;padding:7px 10px 7px 28px;border:1.5px solid #e7e4df;border-radius:7px;font-size:12px;font-family:inherit;color:#1c1917;outline:none;box-sizing:border-box;background:#faf9f8}
  .si-search input:focus{border-color:#7c3aed;background:#fff}
  .si-search-ic{position:absolute;left:9px;top:50%;transform:translateY(-50%);color:#a8a29e;pointer-events:none}
  .si-convos{flex:1;overflow-y:auto;padding:6px}
  .si-convo{padding:10px 10px;border-radius:9px;cursor:pointer;transition:background .12s;margin-bottom:2px;border:1.5px solid transparent}
  .si-convo:hover{background:#faf9f8}
  .si-convo.active{background:#ede9fe;border-color:#c4b5fd}
  .si-convo-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:2px}
  .si-convo-name{font-size:12.5px;font-weight:500;color:#1c1917;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px}
  .si-convo-time{font-size:10px;color:#a8a29e;font-family:'DM Mono',monospace;flex-shrink:0}
  .si-convo-preview{font-size:11.5px;color:#78716c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .si-convo-foot{display:flex;align-items:center;gap:4px;margin-top:4px;flex-wrap:wrap}
  .si-plan-badge{font-size:9.5px;padding:1px 6px;border-radius:20px;background:#ede9fe;color:#7c3aed;font-weight:600}
  .si-role-badge{font-size:9.5px;padding:1px 6px;border-radius:20px;background:#dcfce7;color:#16a34a;font-weight:600}
  .si-status-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;margin-left:auto}
  .si-status-dot.open{background:#7c3aed}
  .si-status-dot.closed{background:#a8a29e}
  .si-unread-dot{width:7px;height:7px;border-radius:50%;background:#dc2626;flex-shrink:0}
  .si-chat{flex:1;display:flex;flex-direction:column;overflow:hidden;background:#f5f3ef}
  .si-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#78716c}
  .si-chat-head{background:#fff;border-bottom:1px solid #e7e4df;padding:12px 18px;display:flex;align-items:center;gap:10px;flex-shrink:0}
  .si-chat-avatar{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .si-chat-info{flex:1;min-width:0}
  .si-chat-name{font-size:13.5px;font-weight:600;color:#1c1917}
  .si-chat-sub{font-size:11px;color:#78716c;display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:1px}
  .si-chat-actions{display:flex;gap:8px;flex-shrink:0}
  .si-end-btn{padding:5px 12px;border-radius:7px;border:1px solid #fecaca;background:transparent;color:#dc2626;font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s}
  .si-end-btn:hover{background:#fee2e2}
  .si-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}
  .si-msg-group{display:flex;flex-direction:column}
  .si-msg-group.user{align-items:flex-start}
  .si-msg-group.support{align-items:flex-end}
  .si-msg-sender{font-size:10.5px;font-weight:600;color:#78716c;margin-bottom:3px;padding:0 2px}
  .si-msg{max-width:68%;padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.6}
  .si-msg.user{background:#fff;color:#1c1917;border-bottom-left-radius:3px;border:1px solid #e7e4df}
  .si-msg.support{background:#7c3aed;color:#fff;border-bottom-right-radius:3px}
  .si-msg-time{font-size:10px;color:#a8a29e;margin-top:3px;padding:0 2px}
  .si-ended-banner{padding:9px 18px;background:#fef3c7;border-top:1px solid #fde68a;text-align:center;font-size:12px;color:#b45309;font-style:italic;flex-shrink:0}
  .si-reply-bar{background:#fff;border-top:1px solid #e7e4df;padding:10px 14px;flex-shrink:0}
  .si-reply-input{width:100%;padding:9px 13px;border:1.5px solid #e7e4df;border-radius:9px;font-family:inherit;font-size:13px;color:#1c1917;outline:none;resize:none;min-height:72px;max-height:140px;box-sizing:border-box;transition:border-color .15s;line-height:1.5}
  .si-reply-input:focus{border-color:#7c3aed}
  .si-reply-input:disabled{background:#faf9f8;color:#a8a29e}
  .si-reply-foot{display:flex;align-items:center;justify-content:space-between;margin-top:7px}
  .si-reply-hint{font-size:11px;color:#a8a29e}
  .si-send-btn{background:#7c3aed;color:#fff;border:none;border-radius:7px;padding:8px 18px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit;transition:background .15s;display:flex;align-items:center;gap:5px}
  .si-send-btn:hover{background:#5b21b6}
  .si-send-btn:disabled{opacity:.5;cursor:not-allowed}
  .si-sent{font-size:11px;color:#16a34a;background:#dcfce7;padding:3px 9px;border-radius:6px;font-weight:600}
`;

interface Msg {
  id: string; text: string; sender: "user"|"support";
  time: string; senderName?: string;
}
interface Convo {
  sessionId: string; userId: string; email: string; name: string;
  role: string; plan: string; messages: Msg[]; lastTime: string;
  unread: boolean; status: "open"|"closed";
}

function timeAgo(iso: string) {
  const d = (Date.now()-new Date(iso).getTime())/1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d/60)}m`;
  if (d < 86400) return `${Math.floor(d/3600)}h`;
  return `${Math.floor(d/86400)}d`;
}
function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
}
function planLabel(p: string) {
  if (!p||p==="free") return "Free";
  return p.replace("org_","Org ").replace("ind_","Ind ")
    .replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
}

export default function SupportInboxPage() {
  const [convos, setConvos]         = useState<Convo[]>([]);
  const [selected, setSelected]     = useState<string|null>(null);
  const [reply, setReply]           = useState("");
  const [sending, setSending]       = useState(false);
  const [sentFlash, setSentFlash]   = useState(false);
  const [search, setSearch]         = useState("");
  // "all" is UI-only — not a Convo status value, so kept separate
  const [tabFilter, setTabFilter]   = useState<"open"|"all"|"closed">("open");
  const [loading, setLoading]       = useState(true);
  const [adminId, setAdminId]       = useState("");
  const [adminName, setAdminName]   = useState("Support Team");
  const [authorized, setAuthorized] = useState<boolean|null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = "si-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style"); el.id=id; el.textContent=STYLES;
      document.head.appendChild(el);
    }
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setAuthorized(false); return; }
      const { data: profile } = await supabase
        .from("profiles").select("role,email").eq("id",user.id).single();
      const isAdmin = profile?.role==="admin"||profile?.role==="organization";
      setAuthorized(isAdmin);
      if (!isAdmin) return;
      setAdminId(user.id);
      setAdminName(profile?.email?.split("@")[0]||"Support");
      loadConversations();
    });
  }, []);

  // Realtime
  useEffect(() => {
    if (!authorized) return;
    const ch = supabase.channel("si-realtime")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"activity_logs"},
        (p) => {
          if (["support_message","support_reply"].includes(p.new.action)) loadConversations();
        })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"support_chats"},
        () => loadConversations())
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"support_chats"},
        () => loadConversations())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [authorized]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [selected, convos]);

  async function loadConversations() {
    setLoading(true);
    const { data: sessions } = await supabase
      .from("support_chats")
      .select("id,user_id,status,started_at,ended_at,ended_by")
      .order("started_at",{ascending:false});

    if (!sessions?.length) { setConvos([]); setLoading(false); return; }

    const sessionIds = sessions.map((s:any)=>s.id);
    const { data: logs } = await supabase
      .from("activity_logs")
      .select("id,user_id,action,metadata,created_at,chat_session_id")
      .in("chat_session_id", sessionIds)
      .in("action",["support_message","support_reply"])
      .order("created_at",{ascending:true});

    const userIds = [...new Set(sessions.map((s:any)=>s.user_id))];
    const { data: profiles } = await supabase
      .from("profiles").select("id,email,role").in("id", userIds);
    const { data: subs } = await supabase
      .from("subscriptions").select("user_id,plan_id").eq("status","active");

    const profileMap: Record<string,any> = {};
    for (const p of (profiles||[])) profileMap[p.id] = p;
    const subMap: Record<string,string> = {};
    for (const s of (subs||[])) subMap[s.user_id] = s.plan_id;

    const msgMap: Record<string,Msg[]> = {};
    for (const log of (logs||[])) {
      if (!msgMap[log.chat_session_id]) msgMap[log.chat_session_id] = [];
      msgMap[log.chat_session_id].push({
        id:         log.id,
        text:       log.metadata?.message||"",
        sender:     log.action==="support_message"?"user":"support",
        time:       log.created_at,
        senderName: log.action==="support_reply"
          ? (log.metadata?.admin_name||"Support")
          : (log.metadata?.user_name||profileMap[log.user_id]?.email?.split("@")[0]||"User"),
      });
    }

    const list: Convo[] = sessions.map((s:any) => {
      const profile = profileMap[s.user_id] || {};
      const msgs = msgMap[s.id] || [];
      const lastMsg = msgs[msgs.length-1];
      const lastUserMsg = [...msgs].reverse().find(m=>m.sender==="user");
      const lastSupportMsg = [...msgs].reverse().find(m=>m.sender==="support");
      const unread = !!lastUserMsg && (!lastSupportMsg ||
        new Date(lastUserMsg.time) > new Date(lastSupportMsg.time));
      // Normalise status: treat any unknown value as "open"
      const status: "open"|"closed" = s.status === "closed" ? "closed" : "open";
      return {
        sessionId: s.id,
        userId:    s.user_id,
        email:     profile.email||"unknown",
        name:      profile.email?.split("@")[0]||"User",
        role:      profile.role||"individual",
        plan:      planLabel(subMap[s.user_id]),
        messages:  msgs,
        lastTime:  lastMsg?.time||s.started_at,
        unread,
        status,
      };
    });

    setConvos(list);
    setLoading(false);
  }

  async function sendReply() {
    if (!reply.trim() || !selected || sending) return;
    const text = reply.trim();
    const convo = convos.find(c => c.sessionId === selected);
    if (!convo) return;
    setReply("");
    setSending(true);

    const { data: inserted } = await supabase.from("activity_logs").insert({
      user_id:         convo.userId,
      action:          "support_reply",
      chat_session_id: selected,
      admin_id:        adminId || null,
      admin_name:      adminName,
      metadata: {
        message:    text,
        from_email: "support@nkoaha.space",
        admin_name: adminName,
        sent_at:    new Date().toISOString(),
        read:       false,
      },
    }).select().single();

    setConvos(prev => prev.map(c => {
      if (c.sessionId !== selected) return c;
      return {
        ...c, unread: false, lastTime: new Date().toISOString(),
        messages: [...c.messages, {
          id:         inserted?.id||Date.now().toString(),
          text,
          sender:     "support",
          time:       new Date().toISOString(),
          senderName: adminName,
        }],
      };
    }));

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (authSession?.access_token) {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-reply`, {
          method:"POST",
          headers:{
            "Content-Type":"application/json",
            "Authorization":`Bearer ${authSession.access_token}`,
          },
          body:JSON.stringify({ to:convo.email, from:"support@nkoaha.space", text }),
        }).catch(()=>{});
      }
    } catch(_) {}

    setSending(false);
    setSentFlash(true);
    setTimeout(()=>setSentFlash(false), 2000);
  }

  async function endChat(sessionId: string) {
    if (!confirm("End this chat session?")) return;
    await supabase.from("support_chats")
      .update({ status:"closed", ended_at:new Date().toISOString(), ended_by:"admin" })
      .eq("id", sessionId);
    loadConversations();
  }

  if (authorized === false) return (
    <AdminLayout title="Support Inbox">
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"60vh",gap:10,color:"#78716c"}}>
        <div style={{fontSize:36}}>🔒</div>
        <div style={{fontSize:16,fontWeight:600,color:"#1c1917"}}>Access Restricted</div>
        <div style={{fontSize:13}}>This page is only available to admins.</div>
      </div>
    </AdminLayout>
  );
  if (authorized === null) return null;

  const selectedConvo = convos.find(c=>c.sessionId===selected)||null;
  const unreadCount = convos.filter(c=>c.unread&&c.status==="open").length;

  const filtered = convos.filter(c => {
    const matchSearch =
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase());
    // FIX: tabFilter "all" is handled explicitly; only compare c.status when
    // tabFilter is a concrete Convo status value ("open" | "closed").
    const matchTab = tabFilter === "all" || c.status === tabFilter;
    return matchSearch && matchTab;
  });

  return (
    <AdminLayout title="Support Inbox">
      <div className="si-root">
        {/* Left panel */}
        <div className="si-list">
          <div className="si-list-head">
            <div className="si-list-title">
              Inbox
              {unreadCount>0 && <span className="si-badge">{unreadCount}</span>}
            </div>
            <div className="si-tabs">
              {(["open","all","closed"] as const).map(t=>(
                <button key={t} className={`si-tab${tabFilter===t?" active":""}`}
                  onClick={()=>setTabFilter(t)}>
                  {t==="open"?"Open":t==="all"?"All":"Closed"}
                </button>
              ))}
            </div>
            <div className="si-search">
              <svg className="si-search-ic" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input placeholder="Search users…" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
          </div>

          <div className="si-convos">
            {loading && <div style={{padding:20,textAlign:"center",color:"#78716c",fontSize:13}}>Loading…</div>}
            {!loading && filtered.length===0 && <div style={{padding:20,textAlign:"center",color:"#a8a29e",fontSize:13}}>No chats</div>}
            {filtered.map(c=>(
              <div key={c.sessionId}
                className={`si-convo${selected===c.sessionId?" active":""}`}
                onClick={()=>setSelected(c.sessionId)}>
                <div className="si-convo-top">
                  <div className="si-convo-name">{c.name}</div>
                  <div className="si-convo-time">{timeAgo(c.lastTime)}</div>
                </div>
                <div className="si-convo-preview">{c.messages[c.messages.length-1]?.text||c.email}</div>
                <div className="si-convo-foot">
                  <span className="si-role-badge">{c.role.replace("_"," ")}</span>
                  <span className="si-plan-badge">{c.plan}</span>
                  <span className={`si-status-dot ${c.status}`}/>
                  {c.unread && <span className="si-unread-dot"/>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: chat */}
        <div className="si-chat">
          {!selectedConvo ? (
            <div className="si-empty">
              <div style={{fontSize:40,opacity:.3}}>💬</div>
              <div style={{fontSize:14,fontWeight:600,color:"#44403c"}}>Select a conversation</div>
            </div>
          ) : (<>
            <div className="si-chat-head">
              <div className="si-chat-avatar">{selectedConvo.name[0]?.toUpperCase()||"?"}</div>
              <div className="si-chat-info">
                <div className="si-chat-name">{selectedConvo.name}</div>
                <div className="si-chat-sub">
                  <span>{selectedConvo.email}</span>
                  <span style={{color:"#e7e4df"}}>·</span>
                  <span className="si-role-badge">{selectedConvo.role.replace("_"," ")}</span>
                  <span className="si-plan-badge">{selectedConvo.plan}</span>
                  <span style={{fontSize:10,padding:"1px 6px",borderRadius:20,fontWeight:700,
                    background:selectedConvo.status==="open"?"#dcfce7":"#f5f3ef",
                    color:selectedConvo.status==="open"?"#16a34a":"#78716c"}}>
                    {selectedConvo.status}
                  </span>
                </div>
              </div>
              <div className="si-chat-actions">
                {selectedConvo.status==="open" && (
                  <button className="si-end-btn" onClick={()=>endChat(selectedConvo.sessionId)}>
                    End Chat
                  </button>
                )}
              </div>
            </div>

            <div className="si-messages">
              {selectedConvo.messages.map(m=>(
                <div key={m.id} className={`si-msg-group ${m.sender}`}>
                  <div className="si-msg-sender">{m.senderName}</div>
                  <div className={`si-msg ${m.sender}`}>{m.text}</div>
                  <div className="si-msg-time" style={{alignSelf:m.sender==="support"?"flex-end":"flex-start"}}>
                    {fmt(m.time)}
                  </div>
                </div>
              ))}
              {selectedConvo.messages.length===0 && (
                <div style={{textAlign:"center",color:"#a8a29e",fontSize:13,padding:20}}>
                  No messages yet
                </div>
              )}
              <div ref={bottomRef}/>
            </div>

            {selectedConvo.status==="closed" ? (
              <div className="si-ended-banner">This chat was closed</div>
            ) : (
              <div className="si-reply-bar">
                <textarea
                  className="si-reply-input"
                  placeholder={`Reply to ${selectedConvo.name}… (Ctrl+Enter to send)`}
                  value={reply}
                  onChange={e=>setReply(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();sendReply();}}}
                  disabled={(selectedConvo.status as string)==="closed"}
                />
                <div className="si-reply-foot">
                  <span className="si-reply-hint">Replying as <strong>{adminName}</strong> · Ctrl+Enter to send</span>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    {sentFlash && <span className="si-sent">✓ Sent</span>}
                    <button className="si-send-btn" onClick={sendReply}
                      disabled={sending||!reply.trim()||(selectedConvo.status as string)==="closed"}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      {sending?"Sending…":"Send Reply"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>)}
        </div>
      </div>
    </AdminLayout>
  );
}