import { useState, useEffect, useRef } from "react";

// ── EmailJS loader ─────────────────────────────────────────
function useEmailJS() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (window.emailjs) { setReady(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
    s.onload = () => setReady(true);
    document.head.appendChild(s);
  }, []);
  return ready;
}

// ── Claude streaming ────────────────────────────────────────
async function callClaude(systemPrompt, userMessage, onChunk) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 900,
      stream: true,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n"); buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") return;
      try {
        const p = JSON.parse(data);
        if (p.type === "content_block_delta" && p.delta?.text) onChunk(p.delta.text);
      } catch {}
    }
  }
}

async function generatePlan(client, day) {
  const isGymDay = client.gymDays.includes(day);
  let result = "";
  await callClaude(
    `You are Coach Geoff, head coach at Fit4Life Gym. Write personalized daily fitness emails on behalf of Coach Geoff. Be warm, specific, motivating and personal. Use the client's name naturally. Structure clearly with emoji sections. Keep it under 400 words. Plain text only — no markdown, no asterisks. Use line breaks between sections.`,
    `Write a complete daily fitness email for:
Name: ${client.name}
Age: ${client.age || "unspecified"}
Goal: ${client.goal}
Level: ${client.level}
Diet: ${client.diet}
Today: ${day} ${isGymDay ? "(GYM DAY 💪)" : "(REST/RECOVERY DAY)"}
Gym Days: ${client.gymDays.join(", ") || "flexible"}
Focus Muscles: ${client.muscles.join(", ") || "full body"}
Context: ${client.motivation || "wants to stay consistent"}

Include:
${isGymDay ? `1. 🌅 Warm personal morning greeting
2. 💪 Today's workout — 4-5 specific exercises, sets, reps (matched to level and muscles)
3. 🥗 Nutrition tip tailored to ${client.diet} diet
4. 🧠 One mindset tip for the day
5. 🔥 A powerful emotional motivation message tied to their goal (${client.goal})
6. ✅ One small achievable win challenge` :
`1. 🌅 Warm personal morning greeting
2. 🧘 Active recovery plan for today
3. 🥗 Rest day nutrition tip for ${client.diet} diet
4. 🔋 Why rest is making them stronger — motivational angle
5. 🔥 Emotional re-engagement for tomorrow's session
6. ✅ One small wellness action for today`}

Sign off as "Coach Geoff — Fit4Life Gym"`,
    (chunk) => { result += chunk; }
  );
  return result;
}

// ── Constants ──────────────────────────────────────────────
const GOALS = ["Lose Weight", "Build Muscle", "Endurance", "Flexibility", "Athletic Performance", "General Fitness"];
const LEVELS = ["Complete Beginner", "Some Experience", "Intermediate", "Advanced"];
const DIETS = ["No Restrictions", "Vegetarian", "Vegan", "Keto", "High Protein", "Gluten Free"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MUSCLES = ["Chest", "Back", "Shoulders", "Arms", "Core/Abs", "Legs", "Glutes", "Calves", "Full Body", "Cardio"];
const GRAD = ["from-lime-500 to-emerald-500", "from-blue-500 to-cyan-500", "from-purple-500 to-pink-500", "from-amber-500 to-orange-500", "from-rose-500 to-red-500"];
const TABS = [
  { id: "clients", label: "👥 Clients" },
  { id: "send", label: "📧 Send Emails" },
  { id: "scheduler", label: "⏰ Scheduler" },
  { id: "chat", label: "💬 Coach Geoff" },
  { id: "setup", label: "⚙️ Setup" },
];

// ── Tiny components ────────────────────────────────────────
const Pill = ({ c = "lime", children }) => {
  const m = { lime: "bg-lime-500/20 text-lime-300", blue: "bg-blue-500/20 text-blue-300", amber: "bg-amber-500/20 text-amber-300", red: "bg-red-500/20 text-red-300", purple: "bg-purple-500/20 text-purple-300", green: "bg-green-500/20 text-green-300", zinc: "bg-zinc-700 text-zinc-400" };
  return <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${m[c]}`}>{children}</span>;
};

const Btn = ({ children, onClick, v = "primary", disabled, full, small }) => {
  const base = `font-black rounded-xl transition-all ${small ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm"} ${full ? "w-full text-center block" : ""} ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer active:scale-95"}`;
  const vs = { primary: "bg-lime-400 text-black hover:bg-lime-300", ghost: "bg-zinc-800 text-zinc-300 hover:bg-zinc-700", blue: "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30", red: "bg-red-500/20 text-red-300 hover:bg-red-500/30", amber: "bg-amber-500/20 text-amber-300" };
  return <button className={`${base} ${vs[v]}`} onClick={onClick} disabled={disabled}>{children}</button>;
};

const Avatar = ({ name, idx = 0 }) => (
  <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${GRAD[idx % GRAD.length]} flex items-center justify-center text-white font-black text-sm flex-shrink-0`}>
    {name?.[0]?.toUpperCase() || "?"}
  </div>
);

const Input = ({ label, value, onChange, placeholder, type = "text" }) => (
  <div>
    {label && <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1.5">{label}</div>}
    <input type={type} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-lime-500 placeholder-zinc-600" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
  </div>
);

// ── Default clients ────────────────────────────────────────
const DEFAULT_CLIENTS = [
  { id: 1, name: "Marcus J.", email: "", age: "27", goal: "Build Muscle", level: "Some Experience", diet: "High Protein", gymDays: ["Monday", "Wednesday", "Friday", "Saturday"], muscles: ["Chest", "Back", "Arms"], motivation: "Wants bigger arms and chest for summer. Sometimes skips Mondays." },
  { id: 2, name: "Amara K.", email: "", age: "31", goal: "Lose Weight", level: "Complete Beginner", diet: "No Restrictions", gymDays: ["Tuesday", "Thursday", "Saturday"], muscles: ["Core/Abs", "Glutes", "Legs"], motivation: "Nervous beginner. Needs encouragement. Wedding in 4 months." },
];

// ── Add Client Modal ───────────────────────────────────────
function AddClientModal({ onSave, onClose }) {
  const [f, setF] = useState({ name: "", email: "", age: "", goal: GOALS[0], level: LEVELS[0], diet: DIETS[0], gymDays: [], muscles: [], motivation: "" });
  const s = (k, v) => setF(p => ({ ...p, [k]: v }));
  const tog = (arr, val) => arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
  const valid = f.name && f.email && f.email.includes("@");

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <div className="bg-zinc-950 border border-zinc-700 rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-zinc-950 px-5 pt-5 pb-4 border-b border-zinc-800 z-10">
          <div className="text-white font-black text-lg">Add New Client</div>
          <div className="text-zinc-600 text-xs mt-0.5">Email is required to send reminders</div>
        </div>
        <div className="p-5 space-y-4">
          <Input label="Full Name *" value={f.name} onChange={v => s("name", v)} placeholder="e.g. Marcus Johnson" />
          <Input label="Client Email * (for reminders)" type="email" value={f.email} onChange={v => s("email", v)} placeholder="client@email.com" />
          <Input label="Age" value={f.age} onChange={v => s("age", v)} placeholder="e.g. 28" />
          {[
            ["Primary Goal", GOALS, "goal", "lime"],
            ["Fitness Level", LEVELS, "level", "blue"],
            ["Diet / Nutrition", DIETS, "diet", "amber"],
          ].map(([lbl, opts, key, color]) => (
            <div key={key}>
              <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-2">{lbl}</div>
              <div className="flex flex-wrap gap-1.5">
                {opts.map(o => (
                  <button key={o} onClick={() => s(key, o)} className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${f[key] === o ? `bg-${color}-400 text-black` : "bg-zinc-800 text-zinc-500 hover:text-white"}`}>{o}</button>
                ))}
              </div>
            </div>
          ))}
          <div>
            <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-2">Gym Days</div>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map(d => <button key={d} onClick={() => s("gymDays", tog(f.gymDays, d))} className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${f.gymDays.includes(d) ? "bg-purple-400 text-black" : "bg-zinc-800 text-zinc-500 hover:text-white"}`}>{d.slice(0, 3)}</button>)}
            </div>
          </div>
          <div>
            <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-2">Target Muscles</div>
            <div className="flex flex-wrap gap-1.5">
              {MUSCLES.map(m => <button key={m} onClick={() => s("muscles", tog(f.muscles, m))} className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${f.muscles.includes(m) ? "bg-red-400 text-black" : "bg-zinc-800 text-zinc-500 hover:text-white"}`}>{m}</button>)}
            </div>
          </div>
          <div>
            <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1.5">What motivates them? (Optional)</div>
            <textarea className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-lime-500 resize-none" rows={2} placeholder="e.g. wedding in 3 months, struggles on Mondays..." value={f.motivation} onChange={e => s("motivation", e.target.value)} />
          </div>
        </div>
        <div className="sticky bottom-0 bg-zinc-950 p-4 border-t border-zinc-800 flex gap-3">
          <Btn v="ghost" onClick={onClose} full>Cancel</Btn>
          <Btn onClick={() => valid && onSave(f)} disabled={!valid} full>Save Client ✓</Btn>
        </div>
      </div>
    </div>
  );
}

// ── Send Emails Tab ────────────────────────────────────────
function SendTab({ clients, creds }) {
  const ejsReady = useEmailJS();
  const todayIdx = new Date().getDay();
  const todayName = DAYS[todayIdx === 0 ? 6 : todayIdx - 1];
  const [day, setDay] = useState(todayName);
  const [statuses, setStatuses] = useState({});
  const [previews, setPreviews] = useState({});
  const [generating, setGenerating] = useState({});
  const [sending, setSending] = useState({});
  const [batchRunning, setBatchRunning] = useState(false);

  const credsMissing = !creds.serviceId || !creds.templateId || !creds.publicKey;

  const setStatus = (id, st) => setStatuses(p => ({ ...p, [id]: st }));

  const sendEmail = async (client, message) => {
    if (!ejsReady || credsMissing) throw new Error("EmailJS not configured");
    window.emailjs.init(creds.publicKey);
    const res = await window.emailjs.send(creds.serviceId, creds.templateId, {
      to_name: client.name,
      to_email: client.email,
      subject: `💪 Your ${day} Fitness Plan — Let's Go!`,
      message: message,
      from_name: "Coach Geoff — Fit4Life Gym",
      day: day,
      goal: client.goal,
    });
    if (res.status !== 200) throw new Error("Send failed");
  };

  const handleSingle = async (client) => {
    if (!client.email) { setStatus(client.id, { type: "error", msg: "No email address set" }); return; }
    setGenerating(p => ({ ...p, [client.id]: true }));
    setStatus(client.id, { type: "generating", msg: "Generating plan..." });
    try {
      const msg = await (async () => { let r = ""; await callClaude(`You are Coach Geoff, head coach at Fit4Life Gym. Write personalized daily fitness emails as Coach Geoff. Plain text only, no markdown. Warm, specific, motivating. Sign off as: Coach Geoff — Fit4Life Gym.`,
        `Write a complete daily ${day} fitness email for: Name: ${client.name}, Age: ${client.age || "unspecified"}, Goal: ${client.goal}, Level: ${client.level}, Diet: ${client.diet}, Today: ${day} ${client.gymDays.includes(day) ? "(GYM DAY)" : "(REST DAY)"}, Focus: ${client.muscles.join(", ")}. Context: ${client.motivation || "stay consistent"}. Include greeting, workout or recovery plan, nutrition tip, mindset tip, motivational message, and one small win challenge. Under 350 words.`,
        c => { r += c; }); return r; })();
      setPreviews(p => ({ ...p, [client.id]: msg }));
      setStatus(client.id, { type: "preview", msg: "Preview ready — send?" });
    } catch { setStatus(client.id, { type: "error", msg: "Generation failed" }); }
    setGenerating(p => ({ ...p, [client.id]: false }));
  };

  const confirmSend = async (client) => {
    const msg = previews[client.id];
    if (!msg) return;
    setSending(p => ({ ...p, [client.id]: true }));
    setStatus(client.id, { type: "sending", msg: "Sending..." });
    try {
      await sendEmail(client, msg);
      setStatus(client.id, { type: "sent", msg: `✓ Sent at ${new Date().toLocaleTimeString()}` });
    } catch (e) { setStatus(client.id, { type: "error", msg: `Failed: ${e.message}` }); }
    setSending(p => ({ ...p, [client.id]: false }));
  };

  const sendAll = async () => {
    const eligible = clients.filter(c => c.email);
    if (!eligible.length) return;
    setBatchRunning(true);
    for (const client of eligible) {
      setStatus(client.id, { type: "generating", msg: "Generating..." });
      try {
        const msg = await (async () => { let r = ""; await callClaude(`You are Coach Geoff, head coach at Fit4Life Gym. Write personalized daily fitness emails as Coach Geoff. Plain text only, no markdown. Warm, specific, motivating. Sign off as: Coach Geoff — Fit4Life Gym.`,
          `Write a complete daily ${day} fitness email for: Name: ${client.name}, Goal: ${client.goal}, Level: ${client.level}, Diet: ${client.diet}, Today: ${day} ${client.gymDays.includes(day) ? "(GYM DAY)" : "(REST DAY)"}, Focus: ${client.muscles.join(", ")}. Under 350 words.`,
          c => { r += c; }); return r; })();
        setStatus(client.id, { type: "sending", msg: "Sending..." });
        await sendEmail(client, msg);
        setStatus(client.id, { type: "sent", msg: `✓ ${new Date().toLocaleTimeString()}` });
      } catch (e) { setStatus(client.id, { type: "error", msg: e.message }); }
      await new Promise(r => setTimeout(r, 800));
    }
    setBatchRunning(false);
  };

  const withEmail = clients.filter(c => c.email);
  const noEmail = clients.filter(c => !c.email);

  return (
    <div className="space-y-4">
      {credsMissing && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
          <div className="text-amber-300 font-black text-sm mb-1">⚠️ EmailJS Not Configured</div>
          <div className="text-amber-400/70 text-xs">Go to the Setup tab and enter your EmailJS credentials before sending emails.</div>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <div className="text-white font-black mb-3">Select Day to Generate Plans For</div>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {DAYS.map(d => <button key={d} onClick={() => setDay(d)} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${day === d ? "bg-lime-400 text-black" : "bg-zinc-800 text-zinc-500 hover:text-white"}`}>{d.slice(0, 3)}</button>)}
        </div>
        <Btn onClick={sendAll} disabled={batchRunning || !withEmail.length || credsMissing} full>
          {batchRunning ? "⚡ Sending to all clients..." : `🚀 Generate & Send to All ${withEmail.length} Client${withEmail.length !== 1 ? "s" : ""}`}
        </Btn>
      </div>

      {noEmail.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
          <div className="text-zinc-500 text-xs font-bold mb-1">⚠️ Missing email — add in Clients tab:</div>
          {noEmail.map(c => <div key={c.id} className="text-zinc-600 text-xs">• {c.name}</div>)}
        </div>
      )}

      <div className="space-y-3">
        {withEmail.map((client, idx) => {
          const st = statuses[client.id];
          const preview = previews[client.id];
          const isGym = client.gymDays.includes(day);
          return (
            <div key={client.id} className={`bg-zinc-900 border rounded-2xl p-4 transition-colors ${st?.type === "sent" ? "border-lime-500/30" : st?.type === "error" ? "border-red-500/30" : "border-zinc-800"}`}>
              <div className="flex items-center gap-3 mb-3">
                <Avatar name={client.name} idx={idx} />
                <div className="flex-1 min-w-0">
                  <div className="text-white font-black text-sm">{client.name}</div>
                  <div className="text-zinc-600 text-xs truncate">{client.email}</div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <Pill c={isGym ? "lime" : "zinc"}>{isGym ? "💪 Gym" : "🧘 Rest"}</Pill>
                  {st && <Pill c={st.type === "sent" ? "green" : st.type === "error" ? "red" : st.type === "generating" || st.type === "sending" ? "amber" : "blue"}>{st.msg}</Pill>}
                </div>
              </div>

              {preview && st?.type === "preview" && (
                <div className="bg-zinc-800 rounded-xl p-3 mb-3 text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto border border-zinc-700">
                  {preview}
                </div>
              )}

              <div className="flex gap-2">
                {(!st || st.type === "error") && (
                  <Btn small v="ghost" onClick={() => handleSingle(client)} disabled={generating[client.id] || credsMissing} full>
                    {generating[client.id] ? "Generating..." : "✨ Generate Plan"}
                  </Btn>
                )}
                {st?.type === "preview" && (
                  <>
                    <Btn small v="ghost" onClick={() => handleSingle(client)} full>↺ Regenerate</Btn>
                    <Btn small onClick={() => confirmSend(client)} disabled={sending[client.id]} full>
                      {sending[client.id] ? "Sending..." : "📧 Send Email"}
                    </Btn>
                  </>
                )}
                {st?.type === "generating" && <div className="text-xs text-amber-400 py-1.5 w-full text-center">⚡ Writing plan...</div>}
                {st?.type === "sending" && <div className="text-xs text-blue-400 py-1.5 w-full text-center">📬 Sending email...</div>}
                {st?.type === "sent" && (
                  <div className="flex gap-2 w-full">
                    <div className="text-xs text-lime-400 py-1.5 flex-1 text-center">✓ Email delivered!</div>
                    <Btn small v="ghost" onClick={() => { setStatuses(p => ({ ...p, [client.id]: null })); setPreviews(p => ({ ...p, [client.id]: null })); }}>Send Again</Btn>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Scheduler Tab ──────────────────────────────────────────
function SchedulerTab({ clients, creds, schedule, setSchedule }) {
  const ejsReady = useEmailJS();
  const [log, setLog] = useState([]);
  const [active, setActive] = useState(false);
  const timerRef = useRef(null);
  const lastSentRef = useRef(null);

  const addLog = (msg, type = "info") => setLog(p => [{ msg, type, time: new Date().toLocaleTimeString() }, ...p].slice(0, 20));

  const runScheduledSend = async () => {
    const eligible = clients.filter(c => c.email);
    if (!eligible.length) { addLog("No clients with emails found", "warn"); return; }
    const todayIdx = new Date().getDay();
    const todayName = DAYS[todayIdx === 0 ? 6 : todayIdx - 1];
    addLog(`Starting scheduled send for ${todayName} — ${eligible.length} clients`, "info");
    for (const client of eligible) {
      addLog(`Generating plan for ${client.name}...`, "info");
      try {
        let msg = "";
        await callClaude(
          `You are Coach Geoff, head coach at Fit4Life Gym. Write personalized daily fitness emails as Coach Geoff. Plain text only, no markdown. Warm, specific, motivating. Sign off as: Coach Geoff — Fit4Life Gym.`,
          `Write a complete daily ${todayName} fitness email for: Name: ${client.name}, Goal: ${client.goal}, Level: ${client.level}, Diet: ${client.diet}, Today: ${todayName} ${client.gymDays.includes(todayName) ? "(GYM DAY)" : "(REST DAY)"}, Focus: ${client.muscles.join(", ")}. Under 350 words.`,
          c => { msg += c; }
        );
        if (ejsReady && creds.serviceId && creds.templateId && creds.publicKey) {
          window.emailjs.init(creds.publicKey);
          await window.emailjs.send(creds.serviceId, creds.templateId, {
            to_name: client.name, to_email: client.email,
            subject: `💪 Your ${todayName} Fitness Plan — Let's Go!`,
            message: msg, from_name: "Coach Geoff — Fit4Life Gym", day: todayName, goal: client.goal,
          });
          addLog(`✓ Email sent to ${client.name} (${client.email})`, "success");
        } else {
          addLog(`⚠️ EmailJS not configured — skipped ${client.name}`, "warn");
        }
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) { addLog(`✗ Failed for ${client.name}: ${e.message}`, "error"); }
    }
    addLog("Scheduled send complete", "success");
  };

  useEffect(() => {
    if (!active) { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      const now = new Date();
      const h = now.getHours().toString().padStart(2, "0");
      const m = now.getMinutes().toString().padStart(2, "0");
      const key = `${now.toDateString()}-${h}:${m}`;
      if (`${h}:${m}` === schedule.time && lastSentRef.current !== key) {
        lastSentRef.current = key;
        addLog(`⏰ Scheduled time hit — starting send`, "info");
        runScheduledSend();
      }
    }, 15000);
    return () => clearInterval(timerRef.current);
  }, [active, schedule.time, clients, creds]);

  const now = new Date();
  const nowStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-lime-500/10 to-transparent border border-lime-500/20 rounded-2xl p-5">
        <div className="text-lime-400 font-black text-sm mb-1">⏰ Daily Auto-Send Scheduler</div>
        <div className="text-zinc-400 text-xs">Set a time and this app will automatically generate and send personalized emails to all clients every day at that time. Keep this tab open in your browser.</div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
        <div>
          <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-2">Send Time (daily)</div>
          <div className="flex gap-3 items-center">
            <input type="time" className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-lime-500 flex-1" value={schedule.time} onChange={e => setSchedule(p => ({ ...p, time: e.target.value }))} />
            <div className="text-zinc-600 text-xs">Current: {nowStr}</div>
          </div>
        </div>

        <div className={`rounded-xl p-4 border ${active ? "bg-lime-500/10 border-lime-500/30" : "bg-zinc-800 border-zinc-700"}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className={`font-black text-sm ${active ? "text-lime-400" : "text-zinc-400"}`}>
                {active ? "🟢 Scheduler Running" : "⚫ Scheduler Off"}
              </div>
              <div className="text-xs text-zinc-600 mt-0.5">
                {active ? `Will send at ${schedule.time} daily` : "Toggle to activate"}
              </div>
            </div>
            <button onClick={() => { setActive(!active); addLog(active ? "Scheduler stopped" : `Scheduler started — will send at ${schedule.time}`, active ? "warn" : "success"); }}
              className={`w-14 h-7 rounded-full transition-all ${active ? "bg-lime-400" : "bg-zinc-700"}`}>
              <div className={`w-6 h-6 rounded-full bg-white transition-all m-0.5 ${active ? "translate-x-7" : "translate-x-0"}`} />
            </button>
          </div>
        </div>

        <Btn onClick={runScheduledSend} full v="ghost">
          🧪 Test Send Now (All Clients)
        </Btn>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <div className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-3">Activity Log</div>
        {log.length === 0 ? (
          <div className="text-zinc-700 text-xs text-center py-4">No activity yet</div>
        ) : (
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {log.map((l, i) => (
              <div key={i} className="flex gap-2 text-xs">
                <span className="text-zinc-700 flex-shrink-0">{l.time}</span>
                <span className={l.type === "success" ? "text-lime-400" : l.type === "error" ? "text-red-400" : l.type === "warn" ? "text-amber-400" : "text-zinc-400"}>{l.msg}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <div className="text-white font-black text-sm mb-2">📌 How Scheduling Works</div>
        <div className="space-y-1.5 text-xs text-zinc-500">
          <div className="flex gap-2"><span className="text-lime-400">1.</span> Set your desired send time above (e.g. 6:30 AM)</div>
          <div className="flex gap-2"><span className="text-lime-400">2.</span> Toggle the scheduler ON</div>
          <div className="flex gap-2"><span className="text-lime-400">3.</span> Keep this browser tab open — emails fire automatically at that time</div>
          <div className="flex gap-2"><span className="text-lime-400">4.</span> For true background scheduling (no browser needed), use Make.com or Zapier — see below</div>
        </div>
        <div className="mt-4 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300">
          <div className="font-black mb-1">🔁 True Auto-Scheduling (Runs Without Browser Open):</div>
          <div className="text-blue-400/70">Make.com → Free plan → Create a Scenario → Schedule trigger (daily 7am) → HTTP module calling this app's AI → Gmail/Outlook module sending the email. Takes 20 minutes to set up. Your clients get emails even when your phone is off.</div>
        </div>
      </div>
    </div>
  );
}

// ── Setup Tab ──────────────────────────────────────────────
function SetupTab({ creds, setCreds }) {
  const [show, setShow] = useState(false);
  const configured = creds.serviceId && creds.templateId && creds.publicKey;

  return (
    <div className="space-y-4">
      <div className={`border rounded-2xl p-4 ${configured ? "bg-lime-500/10 border-lime-500/30" : "bg-amber-500/10 border-amber-500/30"}`}>
        <div className={`font-black text-sm mb-1 ${configured ? "text-lime-400" : "text-amber-300"}`}>
          {configured ? "✓ EmailJS Connected" : "⚠️ EmailJS Not Set Up Yet"}
        </div>
        <div className="text-zinc-400 text-xs">{configured ? "Your emails will send correctly." : "Follow the steps below to connect your Gmail and start sending."}</div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800">
          <div className="text-white font-black text-sm">Step-by-Step EmailJS Setup</div>
          <div className="text-zinc-500 text-xs mt-0.5">Free · No backend · 200 emails/month free · Takes 10 minutes</div>
        </div>
        <div className="p-5 space-y-4">
          {[
            ["1", "Create Free Account", "Go to emailjs.com → Sign Up Free. Connect your Gmail account under Email Services → Add New Service → Gmail → Connect Account.", "lime"],
            ["2", "Create Email Template", `In EmailJS dashboard → Email Templates → Create New Template. Set it up with these exact variable names:\n\nSubject field: {{subject}}\n\nBody (HTML or text):\nHi {{to_name}},\n\n{{message}}\n\n---\nSent by your Fit4Life Gym — Coach Geoff`, "blue"],
            ["3", "Copy Your Credentials", "From the EmailJS dashboard copy:\n• Service ID (from Email Services)\n• Template ID (from Email Templates)\n• Public Key (from Account → API Keys)", "amber"],
            ["4", "Paste Below", "Enter your credentials in the fields below and hit Save. Then add client email addresses in the Clients tab.", "purple"],
          ].map(([n, title, desc, color]) => (
            <div key={n} className="flex gap-3">
              <div className={`w-7 h-7 rounded-lg bg-${color}-500/20 text-${color}-300 font-black text-xs flex items-center justify-center flex-shrink-0`}>{n}</div>
              <div>
                <div className="text-white font-bold text-sm">{title}</div>
                <div className="text-zinc-500 text-xs mt-0.5 whitespace-pre-line leading-relaxed">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <div className="text-white font-black text-sm">Your EmailJS Credentials</div>
        <Input label="Service ID" value={creds.serviceId} onChange={v => setCreds(p => ({ ...p, serviceId: v }))} placeholder="service_xxxxxxx" />
        <Input label="Template ID" value={creds.templateId} onChange={v => setCreds(p => ({ ...p, templateId: v }))} placeholder="template_xxxxxxx" />
        <div>
          <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1.5">Public Key</div>
          <div className="flex gap-2">
            <input type={show ? "text" : "password"} className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-lime-500" placeholder="xxxxxxxxxxxxxxxxxxxxxx" value={creds.publicKey} onChange={e => setCreds(p => ({ ...p, publicKey: e.target.value }))} />
            <button onClick={() => setShow(!show)} className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 text-zinc-400 text-xs hover:text-white">{show ? "Hide" : "Show"}</button>
          </div>
        </div>
        {configured && (
          <div className="bg-lime-500/10 border border-lime-500/20 rounded-xl p-3 text-lime-400 text-xs font-bold text-center">
            ✓ All credentials saved — you're ready to send!
          </div>
        )}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <div className="text-white font-black text-sm mb-3">📧 EmailJS Template Variables Reference</div>
        <div className="text-zinc-500 text-xs mb-2">Use these variable names in your EmailJS template:</div>
        <div className="space-y-1.5">
          {[["{{to_name}}", "Client's name"], ["{{to_email}}", "Client's email (To field)"], ["{{subject}}", "Email subject line"], ["{{message}}", "The full AI-generated plan"], ["{{from_name}}", "Coach Geoff — Fit4Life Gym"], ["{{day}}", "Day of the week"], ["{{goal}}", "Client's fitness goal"]].map(([v, d]) => (
            <div key={v} className="flex gap-3 text-xs">
              <code className="text-lime-400 bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] flex-shrink-0">{v}</code>
              <span className="text-zinc-500">{d}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Chat Tab ───────────────────────────────────────────────
function ChatTab({ client }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);
  useEffect(() => {
    if (client) setMsgs([{ role: "assistant", content: `Hey! I'm Coach Geoff at Fit4Life Gym — here for ${client.name}. Ask me anything — demotivated, missed sessions, comeback plans, nutrition, mindset. I'll write you messages to send directly. 💪` }]);
  }, [client?.id]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const txt = input.trim(); setInput("");
    setMsgs(m => [...m, { role: "user", content: txt }]);
    setLoading(true);
    const sys = client ? `You are Coach Geoff, head coach at Fit4Life Gym. Client profile:
Name: ${client.name}, Goal: ${client.goal}, Level: ${client.level}, Diet: ${client.diet}, Gym Days: ${client.gymDays.join(", ")}, Muscles: ${client.muscles.join(", ")}, Context: ${client.motivation}.
When asked for a message to send, write it ready to copy-paste. Be specific, warm, emotional when needed. Use emojis. Reference their actual goal and context.` : `You are Coach Geoff, head coach at Fit4Life Gym. Be helpful, practical and motivating.`;
    let reply = "";
    await callClaude(sys, txt, chunk => {
      reply += chunk;
      setMsgs(m => { const last = m[m.length - 1]; if (last?.role === "assistant" && last?.streaming) return [...m.slice(0, -1), { role: "assistant", content: reply, streaming: true }]; return [...m, { role: "assistant", content: reply, streaming: true }]; });
    });
    setMsgs(m => m.map((x, i) => i === m.length - 1 ? { ...x, streaming: false } : x));
    setLoading(false);
  };

  const quick = client ? [`${client.name} hasn't trained in 2 weeks — write a comeback email`, `${client.name} wants to quit — write an emotional motivational message`, `${client.name} crushed their workout — write a hype message`, `Write a Monday fire-up email for ${client.name}`, `${client.name} says the gym feels pointless — how to respond?`] : [];

  if (!client) return <div className="flex flex-col items-center justify-center h-64 text-center px-8"><div className="text-4xl mb-3">💬</div><div className="text-white font-bold mb-1">Select a Client First</div><div className="text-zinc-500 text-sm">Go to Clients tab → tap a client</div></div>;

  return (
    <div className="flex flex-col h-[68vh]">
      <div className="flex-1 overflow-y-auto space-y-3 pb-3">
        {msgs.length <= 1 && quick.map((q, i) => <button key={i} onClick={() => setInput(q)} className="w-full text-left bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors">{q}</button>)}
        {msgs.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            {m.role === "assistant" && <div className="w-7 h-7 rounded-full bg-gradient-to-br from-lime-400 to-emerald-500 flex items-center justify-center text-black text-[10px] font-black flex-shrink-0 mt-1">GF</div>}
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "bg-lime-400 text-black font-medium" : "bg-zinc-900 border border-zinc-800 text-zinc-300"}`}>
              {m.content}{m.streaming && <span className="inline-block w-1 h-3 bg-lime-400 ml-1 animate-pulse rounded-sm" />}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="pt-3 border-t border-zinc-800">
        <div className="flex gap-2">
          <input className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-lime-500 placeholder-zinc-600" placeholder={`Ask about ${client.name}...`} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} disabled={loading} />
          <button onClick={send} disabled={loading || !input.trim()} className="bg-lime-400 text-black font-black rounded-xl px-4 disabled:opacity-40 text-sm active:scale-95">→</button>
        </div>
      </div>
    </div>
  );
}

// ── Clients Tab ────────────────────────────────────────────
function ClientsTab({ clients, setClients, selected, setSelected, setTab }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editEmail, setEditEmail] = useState({});

  const save = (form) => { const c = { ...form, id: Date.now() }; setClients(p => [...p, c]); setSelected(c); setShowAdd(false); setTab("send"); };
  const del = (id) => { setClients(p => p.filter(x => x.id !== id)); if (selected?.id === id) setSelected(null); };
  const updateEmail = (id, email) => { setClients(p => p.map(c => c.id === id ? { ...c, email } : c)); setEditEmail(p => ({ ...p, [id]: false })); };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-white font-black text-base">Clients ({clients.length})</div>
        <Btn small onClick={() => setShowAdd(true)}>+ Add Client</Btn>
      </div>

      {clients.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">👥</div>
          <div className="text-white font-bold mb-1">No clients yet</div>
          <Btn onClick={() => setShowAdd(true)}>+ Add First Client</Btn>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((c, idx) => (
            <div key={c.id} className={`bg-zinc-900 border rounded-2xl p-4 transition-colors ${selected?.id === c.id ? "border-lime-500/50" : "border-zinc-800"}`}>
              <div className="flex items-center gap-3 mb-3">
                <Avatar name={c.name} idx={idx} />
                <div className="flex-1 min-w-0">
                  <div className="text-white font-black text-sm">{c.name}</div>
                  <div className="text-zinc-600 text-xs">{c.goal} · {c.level}</div>
                </div>
                <div className="flex gap-2">
                  <Btn small v="blue" onClick={() => { setSelected(c); setTab("send"); }}>Send</Btn>
                  <button onClick={() => del(c.id)} className="text-zinc-700 hover:text-red-400 text-xl leading-none transition-colors">×</button>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-zinc-800 rounded-xl px-3 py-2">
                {editEmail[c.id] ? (
                  <>
                    <input autoFocus className="flex-1 bg-transparent text-white text-xs focus:outline-none placeholder-zinc-600" placeholder="client@email.com" defaultValue={c.email} onKeyDown={e => e.key === "Enter" && updateEmail(c.id, e.target.value)} onBlur={e => updateEmail(c.id, e.target.value)} />
                    <span className="text-zinc-600 text-xs">↵ Enter</span>
                  </>
                ) : (
                  <>
                    <span className="text-sm">📧</span>
                    <span className={`flex-1 text-xs ${c.email ? "text-zinc-300" : "text-zinc-600"}`}>{c.email || "No email — tap to add"}</span>
                    <button onClick={() => setEditEmail(p => ({ ...p, [c.id]: true }))} className="text-zinc-600 hover:text-lime-400 text-xs transition-colors">{c.email ? "Edit" : "Add"}</button>
                  </>
                )}
              </div>

              <div className="flex flex-wrap gap-1 mt-2">
                {c.muscles.slice(0, 4).map(m => <span key={m} className="text-[10px] bg-zinc-800 text-zinc-600 px-1.5 py-0.5 rounded-full">{m}</span>)}
                <span className="text-[10px] bg-zinc-800 text-zinc-600 px-1.5 py-0.5 rounded-full">{c.gymDays.length} gym days/wk</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {showAdd && <AddClientModal onSave={save} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

// ── Root App ───────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("setup");
  const [clients, setClients] = useState(DEFAULT_CLIENTS);
  const [selected, setSelected] = useState(DEFAULT_CLIENTS[0]);
  const [creds, setCreds] = useState({ serviceId: "", templateId: "", publicKey: "" });
  const [schedule, setSchedule] = useState({ time: "07:00" });
  const configured = creds.serviceId && creds.templateId && creds.publicKey;

  return (
    <div style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", background: "#060606", minHeight: "100vh", color: "white" }}>
      <div className="px-4 pt-5 pb-4 border-b border-zinc-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-lime-400 to-emerald-500 flex items-center justify-center text-black text-xl font-black flex-shrink-0">💪</div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-black text-base leading-none">Coach Geoff — Fit4Life Gym</div>
            <div className="text-zinc-600 text-xs mt-0.5">{clients.length} clients · {clients.filter(c => c.email).length} with email · <span className={configured ? "text-lime-500" : "text-amber-500"}>{configured ? "✓ Email connected" : "⚠ Setup needed"}</span></div>
          </div>
          {!configured && <Btn small v="amber" onClick={() => setTab("setup")}>Setup →</Btn>}
        </div>
      </div>

      <div className="flex overflow-x-auto border-b border-zinc-900 scrollbar-hide">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 min-w-max px-3 py-3 text-xs font-black whitespace-nowrap border-b-2 transition-colors ${tab === t.id ? "border-lime-400 text-lime-400" : "border-transparent text-zinc-600 hover:text-zinc-300"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-5 max-w-xl mx-auto">
        {tab === "clients" && <ClientsTab clients={clients} setClients={setClients} selected={selected} setSelected={setSelected} setTab={setTab} />}
        {tab === "send" && <SendTab clients={clients} creds={creds} />}
        {tab === "scheduler" && <SchedulerTab clients={clients} creds={creds} schedule={schedule} setSchedule={setSchedule} />}
        {tab === "chat" && <ChatTab client={selected} />}
        {tab === "setup" && <SetupTab creds={creds} setCreds={setCreds} />}
      </div>
    </div>
  );
}
