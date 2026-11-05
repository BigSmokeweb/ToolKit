import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  Search,
  Columns3,
  Radio,
  History,
  Settings as SettingsIcon,
  Plus,
  ArrowRight,
  ArrowUpRight,
  Users,
  Flame,
  Clock,
  Target,
  ChevronRight,
  Menu,
  X,
  ShieldCheck,
  ArrowDownToLine,
  Filter,
  LayoutList,
  MoreHorizontal,
  Inbox,
  Linkedin,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Trash2,
} from "lucide-react";
import type {
  Staff,
  Category,
  Lead,
  Overview,
  Integration,
  Activity,
  Outreach,
} from "./types";
import { api, post, put, del, toInput, date, due, STAGES, band } from "./lib";
import {
  Button,
  Avatar,
  Badge,
  Score,
  Empty,
  Select,
  CheckLine,
  External,
} from "./components";
import Discovery from "./Discovery";
import ImportLeads from "./ImportLeads";
import LeadEditor from "./LeadEditor";
import SettingsPage from "./Settings";
import SignalsPage from "./Signals";

export interface Context {
  publicShare?: boolean;
  user: Staff;
  staff: Staff[];
  categories: Category[];
  leads: Lead[];
  overview: Overview;
  integrations: Integration;
  refresh: () => Promise<void>;
  notify: (text: string, error?: boolean) => void;
  openLead: (id: string) => void;
  addLead: () => void;
  navigate: (page: string) => void;
}
const nav = [
  ["overview", "Overview", LayoutDashboard],
  ["discover", "Find people", Search],
  ["pipeline", "Pipeline", Columns3],
  ["signals", "Buying signals", Radio],
  ["activity", "Activity", History],
  ["settings", "Settings", SettingsIcon],
] as const;
export default function App() {
  const [workspace, setWorkspace] = useState<{ user: Staff; publicShare?: boolean } | null>(null),
    [workspaceError, setWorkspaceError] = useState("");
  const [page, setPage] = useState(location.hash.slice(1) || "overview"),
    [menu, setMenu] = useState(false),
    [data, setData] = useState<Omit<
      Context,
      "user" | "refresh" | "notify" | "openLead" | "addLead" | "navigate"
    > | null>(null);
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(
      null,
    ),
    [editor, setEditor] = useState<string | null>(null),
    [importOpen, setImportOpen] = useState(false),
    [globalQuery, setGlobalQuery] = useState(""),
    [showDue, setShowDue] = useState(false);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);
  const notify = useCallback(
    (text: string, error = false) => setToast({ text, error }),
    [],
  );
  const navigate = useCallback((p: string) => {
    location.hash = p;
    setPage(p);
    setMenu(false);
    setShowDue(false);
  }, []);
  const loadWorkspace = useCallback(
    () =>
      api<{ user: Staff; publicShare?: boolean }>("/workspace")
        .then(setWorkspace)
        .catch((e) => setWorkspaceError(e.message)),
    [],
  );
  useEffect(() => {
    loadWorkspace();
    const hash = () => setPage(location.hash.slice(1) || "overview");
    window.addEventListener("hashchange", hash);
    return () => window.removeEventListener("hashchange", hash);
  }, [loadWorkspace]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 6500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const refresh = useCallback(async () => {
    const [staff, categories, leads, overview, integrations] =
      await Promise.all([
        api<Staff[]>("/staff"),
        api<Category[]>("/categories"),
        api<Lead[]>("/leads"),
        api<Overview>("/overview"),
        api<Integration>("/integrations"),
      ]);
    setData({ staff, categories, leads, overview, integrations });
  }, []);
  useEffect(() => {
    if (workspace?.user) refresh().catch((e) => notify(e.message, true));
  }, [workspace?.user?.id, refresh, notify]);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("lead");
    if (id && data?.leads.some((l) => l.id === id)) {
      setEditor(id);
      history.replaceState(null, "", location.pathname + location.hash);
    }
  }, [data]);
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    if (p.has("linkedin")) {
      notify(
        p.get("linkedin") === "connected"
          ? "LinkedIn account connected."
          : "LinkedIn connection was cancelled.",
      );
      history.replaceState(null, "", location.pathname + location.hash);
    }
  }, [notify]);
  if (workspaceError)
    return (
      <div className="loading-page">
        <AlertCircle />
        <h2>Couldn’t reach Lead Desk</h2>
        <p>{workspaceError}</p>
        <Button
          onClick={() => {
            setWorkspaceError("");
            loadWorkspace();
          }}
        >
          Try again
        </Button>
      </div>
    );
  if (!workspace)
    return (
      <div className="loading-page">
        <div className="brand-mark">
          N<span>p</span>
        </div>
        <p>Opening your workspace…</p>
      </div>
    );
  if (!data)
    return (
      <div className="loading-page">
        <div className="brand-mark">
          N<span>p</span>
        </div>
        <p>{toast?.error ? toast.text : "Preparing your lead desk…"}</p>
        {toast?.error && (
          <Button
            onClick={() => refresh().catch((e) => notify(e.message, true))}
          >
            Try again
          </Button>
        )}
      </div>
    );
  const ctx: Context = {
    ...data,
    user: workspace.user,
    publicShare: workspace.publicShare,
    refresh,
    notify,
    openLead: setEditor,
    addLead: () => setEditor("new"),
    navigate,
  };
  const title = nav.find((n) => n[0] === page)?.[1] || "Overview";
  return (
    <div className="app-shell">
      {menu && <div className="sidebar-shade" onClick={() => setMenu(false)} />}
      <aside className={"sidebar " + (menu ? "visible" : "")}>
        <a className="brand" href="#overview">
          <span className="brand-mark">
            N<span>p</span>
          </span>
          <span>
            NoLegal<span className="brand-green">Paisa</span>
            <small>LEAD DESK</small>
          </span>
        </a>
        <div className="workspace-chip">
          <span className="workspace-icon">N</span>
          <div>
            NoLegalPaisa<small>Team workspace</small>
          </div>
          <ChevronRight size={15} />
        </div>
        <span className="nav-caption">WORKSPACE</span>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => navigate(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === "pipeline" && data.overview.total > 0 && (
                <em>{data.overview.total}</em>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="quiet-card">
            <ShieldCheck size={19} />
            <strong>Thoughtful outreach.</strong>
            <p>
              Real evidence. Human review.
              <br />
              Better conversations.
            </p>
          </div>
          <div className="user-menu">
            <Avatar name={workspace.user.name} small />
            <div>
              <strong>{workspace.user.name}</strong>
              <small>Shared workspace</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-only"
            aria-label="Open navigation"
            onClick={() => setMenu(true)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <form
              className="global-search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate("pipeline");
              }}
            >
              <Search size={15} />
              <input
                aria-label="Search leads"
                placeholder="Search your leads…"
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
              />
              <kbd>↵</kbd>
            </form>
            <button
              className="due-bell"
              onClick={() => {
                navigate("pipeline");
                setGlobalQuery("");
                setShowDue(true);
              }}
              title="View follow-ups"
            >
              <Clock size={18} />
              {data.overview.due > 0 && <i />}
            </button>
            <Avatar name={workspace.user.name} small />
          </div>
        </header>
        <main className="main-content">
          {ctx.publicShare && (
            <div className="sample-banner" role="status">
              <Radio size={15} />
              <span>Live showcase · Shared pipeline and real Gemini. Changes are visible to everyone with this link.</span>
            </div>
          )}
          {data.overview.sampleCount > 0 && (
            <div className="sample-banner">
              <Sparkles size={15} />
              <span>
                You’re exploring with {data.overview.sampleCount} fictional
                sample leads. They cannot be contacted.
              </span>
              <button onClick={() => navigate("pipeline")}>
                View pipeline <ArrowRight size={13} />
              </button>
            </div>
          )}
          {page === "overview" && (
            <Dashboard ctx={ctx} onImport={() => setImportOpen(true)} />
          )}
          {page === "discover" && (
            <Discovery ctx={ctx} onImport={() => setImportOpen(true)} />
          )}
          {page === "pipeline" && (
            <Pipeline
              ctx={ctx}
              onImport={() => setImportOpen(true)}
              query={globalQuery}
              setQuery={setGlobalQuery}
              onlyDue={showDue}
              setOnlyDue={setShowDue}
            />
          )}
          {page === "signals" && <SignalsPage ctx={ctx} />}
          {page === "activity" && <ActivityPage ctx={ctx} />}
          {page === "settings" && (ctx.publicShare ? <SharedIntegrations ctx={ctx} /> : <SettingsPage ctx={ctx} />)}
          {!nav.some((n) => n[0] === page) && (
            <Dashboard ctx={ctx} onImport={() => setImportOpen(true)} />
          )}
        </main>
        <footer className="page-footer">
          <span>NoLegalPaisa Lead Desk</span>
          <span>
            <i />
            {ctx.publicShare ? "Live shared workspace · Hosted by the owner" : "Local workspace · Your data stays on this server"}
          </span>
        </footer>
      </div>
      {editor && (
        <LeadEditor
          key={editor}
          ctx={ctx}
          id={editor}
          onClose={() => setEditor(null)}
        />
      )}
      {importOpen && (
        <ImportLeads ctx={ctx} onClose={() => setImportOpen(false)} />
      )}
      {toast && (
        <div
          className={"toast " + (toast.error ? "error" : "")}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.text}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function SharedIntegrations({ ctx }: { ctx: Context }) {
  const [busy, setBusy] = useState(false);
  const test = async () => {
    setBusy(true);
    try { await post("/ai/test"); ctx.notify("Real Gemini connection succeeded."); await ctx.refresh(); }
    catch (e: any) { ctx.notify(e.message, true); }
    finally { setBusy(false); }
  };
  return <section className="panel integration-settings wide-panel">
    <div className="panel-heading"><div><h2>Live integrations</h2><p>This showcase uses the owner’s connected services.</p></div><Badge tone="green">Live workspace</Badge></div>
    <div className="padding">
      <h3>Gemini · {ctx.integrations.geminiConfigured ? "Configured" : "Not configured"}</h3>
      <p className="muted">Build searches, extract pasted profile text and draft messages using the real Gemini API. Requests share the owner’s daily allowance.</p>
      <Button busy={busy} onClick={test} disabled={!ctx.integrations.geminiConfigured}><Sparkles size={15} /> Test real Gemini</Button>
      <h3>LinkedIn · {ctx.integrations.linkedin && !ctx.integrations.linkedin.expired ? "Connected" : "Not connected"}</h3>
      <p className="muted">LinkedIn confirms the connected account’s identity. People searches open in your own browser session. Profile capture uses explicitly selected text; messages are sent manually.</p>
      <h3>One-click browser capture</h3>
      <p className="muted">Download and extract the extension, then load it in Chrome or Edge using Developer mode → Load unpacked. Enter this showcase URL in the extension setup and ask the owner for a pairing code generated in the local showcase controls. Pairing a different extension replaces the previous showcase pairing.</p>
      <a className="button secondary" href="/downloads/lead-desk-capture.zip" download><ArrowDownToLine size={15} /> Download extension</a>
      <p className="muted">API keys, connection changes and pairing-code controls are available to the owner in the local app.</p>
    </div>
  </section>;
}

function Dashboard({ ctx, onImport }: { ctx: Context; onImport: () => void }) {
  const { overview: o, leads, categories } = ctx;
  const next = [...leads]
    .filter((l) => !["Won", "Lost"].includes(l.stage))
    .sort((a, b) => Number(due(b)) - Number(due(a)) || b.fitScore - a.fitScore)
    .slice(0, 5);
  const stats = [
    {
      label: "Total leads",
      value: o.total,
      icon: Users,
      note: "Across your pipeline",
      color: "green",
    },
    {
      label: "Hot leads",
      value: o.hot,
      icon: Flame,
      note: "Strong fit, ready for review",
      color: "orange",
    },
    {
      label: "Follow-ups due",
      value: o.due,
      icon: Clock,
      note: "Conversations to keep moving",
      color: "purple",
    },
    {
      label: "Clients won",
      value: o.won,
      icon: Target,
      note: "Relationships that converted",
      color: "green",
    },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {new Intl.DateTimeFormat("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: "Asia/Kolkata",
            })
              .format(new Date())
              .toUpperCase()}
          </div>
          <h1>
            Your desk, in focus<span className="heading-dot">.</span>
          </h1>
          <p>A little clarity for your next great client conversation.</p>
        </div>
        <div className="actions">
          <Button variant="secondary" onClick={onImport}>
            <ArrowDownToLine size={16} />
            Import leads
          </Button>
          <Button onClick={ctx.addLead}>
            <Plus size={17} />
            Add lead
          </Button>
        </div>
      </div>
      <section className="welcome-panel">
        <div>
          <Badge tone="light">PURPOSEFUL PROSPECTING</Badge>
          <h2>
            The right people.
            <br />
            <em>The right moment.</em>
          </h2>
          <p>
            Discover decision-makers with a real need for your services.
            <br className="desktop-only" /> Start with a category. Let a good
            conversation follow.
          </p>
          <Button onClick={() => ctx.navigate("discover")}>
            Find your next lead
            <ArrowUpRight size={17} />
          </Button>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="hero-circle c1" />
          <div className="hero-circle c2" />
          <div className="hero-circle c3" />
          <span className="hero-core">
            <Target size={40} strokeWidth={1.3} />
          </span>
          <div className="floating-card fc1">
            <span className="small-icon">
              <ShieldCheck size={19} />
            </span>
            <div>
              <strong>Evidence before outreach</strong>
              <small>A more thoughtful approach</small>
            </div>
            <CheckCircle2 size={16} />
          </div>
          <div className="floating-card fc2">
            <span className="avatar">Aa</span>
            <div>
              <strong>Your next conversation</strong>
              <small>Find · Qualify · Connect</small>
            </div>
            <ArrowUpRight size={17} />
          </div>
          <span className="hero-spark">✧</span>
        </div>
      </section>
      <section className="stats-grid">
        {stats.map(({ label, value, icon: Icon, note, color }) => (
          <article className="stat-card" key={label}>
            <div>
              <span>{label}</span>
              <span className={"stat-icon " + color}>
                <Icon size={18} />
              </span>
            </div>
            <strong>{value.toString().padStart(2, "0")}</strong>
            <small>{note}</small>
          </article>
        ))}
      </section>
      <div className="dashboard-grid">
        <section className="panel daily-panel">
          <div className="panel-heading">
            <div>
              <h2>Worth your attention</h2>
              <p>Follow-ups first. Then your strongest opportunities.</p>
            </div>
            <button
              className="text-button"
              onClick={() => ctx.navigate("pipeline")}
            >
              View pipeline
              <ArrowRight size={14} />
            </button>
          </div>
          {next.length ? (
            <div className="daily-list">
              {next.map((l) => (
                <button
                  key={l.id}
                  className="daily-row"
                  onClick={() => ctx.openLead(l.id)}
                >
                  <Avatar name={l.name} />
                  <div className="person">
                    <strong>
                      {l.name}
                      {l.isSample && (
                        <span className="sample-label">SAMPLE</span>
                      )}
                    </strong>
                    <small>
                      {l.title || "Role to confirm"} ·{" "}
                      {l.company || "Company to confirm"}
                    </small>
                  </div>
                  <div className="daily-meta">
                    <Score value={l.fitScore} />
                    <small className={due(l) ? "overdue" : ""}>
                      {due(l)
                        ? "Follow-up due"
                        : categories.find((c) => c.id === l.categoryId)?.name}
                    </small>
                  </div>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          ) : (
            <Empty
              icon={Inbox}
              title="Your next opportunity starts here"
              action={
                <div className="actions">
                  <Button onClick={() => ctx.navigate("discover")}>
                    Find people
                    <ArrowRight size={15} />
                  </Button>
                  {ctx.user.role === "Admin" && (
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await post("/samples");
                          await ctx.refresh();
                          ctx.notify("Four fictional sample leads added.");
                        } catch (e: any) {
                          ctx.notify(e.message, true);
                        }
                      }}
                    >
                      Explore sample leads
                    </Button>
                  )}
                </div>
              }
            >
              Add your first lead, import a CSV, or explore the pipeline with
              fictional examples.
            </Empty>
          )}
        </section>
        <section className="panel progress-panel">
          <div className="panel-heading">
            <div>
              <h2>Pipeline at a glance</h2>
              <p>Every conversation has a next step.</p>
            </div>
            <Columns3 size={18} />
          </div>
          <div className="stage-bars">
            {o.stages
              .filter((s) => s.stage !== "Lost")
              .map((s, i) => (
                <div key={s.stage}>
                  <span>
                    <i
                      style={{
                        background: [
                          "#5f8d7f",
                          "#8fab9f",
                          "#b4ae87",
                          "#ca9b73",
                          "#8a91b9",
                          "#245e4b",
                        ][i],
                      }}
                    />
                    {s.stage}
                  </span>
                  <div className="bar-track">
                    <i
                      style={{
                        width: `${o.total ? (s.count / o.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <strong>{s.count}</strong>
                </div>
              ))}
          </div>
          <div className="progress-total">
            <span>From first hello to client</span>
            <strong>
              {o.total ? Math.round((o.won / o.total) * 100) : 0}%
              <small> win rate</small>
            </strong>
          </div>
        </section>
      </div>
      <div className="bottom-grid">
        <section className="panel spotlight">
          <div className="section-kicker">
            <ShieldCheck size={17} />
            SERVICE SPOTLIGHT
          </div>
          <h3>RAAJAH DPDP Compliance</h3>
          <p>
            Find SaaS, fintech and healthtech teams with privacy hiring or data
            protection needs.
          </p>
          <button
            className="text-button"
            onClick={() => ctx.navigate("discover")}
          >
            Explore this category
            <ArrowUpRight size={15} />
          </button>
          <span className="spotlight-art">
            <ShieldCheck size={70} strokeWidth={0.8} />
          </span>
        </section>
        <section className="panel connection-panel">
          <div className="panel-heading">
            <div>
              <h2>Your connections</h2>
              <p>Keep your tools ready for the next step.</p>
            </div>
            <button
              className="text-button"
              onClick={() => ctx.navigate("settings")}
            >
              Manage
              <ArrowRight size={14} />
            </button>
          </div>
          <div className="connection-row">
            <span className="integration-icon linkedin">
              <Linkedin size={20} />
            </span>
            <div>
              <strong>Personal LinkedIn</strong>
              <small>
                {ctx.integrations.linkedin?.name ||
                  "Search links work in your own account"}
              </small>
            </div>
            <Badge
              tone={
                ctx.integrations.linkedin && !ctx.integrations.linkedin.expired
                  ? "green"
                  : "neutral"
              }
            >
              {ctx.integrations.linkedin && !ctx.integrations.linkedin.expired
                ? "Connected"
                : "Not connected"}
            </Badge>
          </div>
          <div className="connection-row">
            <span className="integration-icon gemini">
              <Sparkles size={20} />
            </span>
            <div>
              <strong>Gemini AI</strong>
              <small>Search assistance, extraction and message drafts</small>
            </div>
            <Badge
              tone={ctx.integrations.geminiConfigured ? "green" : "neutral"}
            >
              {ctx.integrations.geminiConfigured
                ? "Key configured"
                : "Set up later"}
            </Badge>
          </div>
        </section>
      </div>
    </>
  );
}
function Pipeline({
  ctx,
  onImport,
  query,
  setQuery,
  onlyDue,
  setOnlyDue,
}: {
  ctx: Context;
  onImport: () => void;
  query: string;
  setQuery: (q: string) => void;
  onlyDue: boolean;
  setOnlyDue: (value: boolean) => void;
}) {
  const [view, setView] = useState("table"),
    [category, setCategory] = useState(""),
    [priority, setPriority] = useState(""),
    [stage, setStage] = useState(""),
    [owner, setOwner] = useState(""),
    [cred, setCred] = useState(""),
    [sort, setSort] = useState("fit"),
    [trash, setTrash] = useState(false),
    [trashed, setTrashed] = useState<Lead[]>([]),
    [busy, setBusy] = useState(false);
  const loadTrash = async () => {
    try {
      setTrashed(await api<Lead[]>("/leads?trash=true"));
    } catch (e: any) {
      ctx.notify(e.message, true);
    }
  };
  useEffect(() => {
    if (trash) loadTrash();
  }, [trash]);
  const rows = (trash ? trashed : ctx.leads)
    .filter(
      (l) =>
        (!query ||
          [l.name, l.company, l.title, l.email, l.city]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase())) &&
        (!category || l.categoryId === category) &&
        (!priority || band(l.fitScore) === priority) &&
        (!stage || l.stage === stage) &&
        (!owner || l.ownerId === owner) &&
        (!cred ||
          (cred === "verified"
            ? l.credibilityScore >= 70
            : cred === "partial"
              ? l.credibilityScore > 0 && l.credibilityScore < 70
              : l.credibilityScore === 0)) &&
        (!onlyDue || due(l)),
    )
    .sort((a, b) =>
      sort === "newest"
        ? b.createdAt.localeCompare(a.createdAt)
        : sort === "credibility"
          ? b.credibilityScore - a.credibilityScore
          : b.fitScore - a.fitScore,
    );
  async function move(id: string, target: string) {
    const l = ctx.leads.find((x) => x.id === id);
    if (!l || l.stage === target) return;
    setBusy(true);
    try {
      await put("/leads/" + id, { ...toInput(l), stage: target });
      await ctx.refresh();
      ctx.notify("Moved to " + target + ".");
    } catch (e: any) {
      ctx.notify(e.message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MAKE EVERY CONVERSATION COUNT</div>
          <h1>
            {trash ? "Recently removed" : "Your pipeline"}
            <span className="heading-dot">.</span>
          </h1>
          <p>
            {trash
              ? "Restore a lead or remove its personal data permanently."
              : "From a promising introduction to a lasting client relationship."}
          </p>
        </div>
        <div className="actions">
          <Button variant="secondary" onClick={onImport}>
            <ArrowDownToLine size={16} />
            Import CSV
          </Button>
          <Button onClick={ctx.addLead}>
            <Plus size={16} />
            Add lead
          </Button>
        </div>
      </div>
      <section className="pipeline-summary">
        {ctx.overview.stages.map((s) => (
          <button
            key={s.stage}
            className={stage === s.stage ? "selected" : ""}
            onClick={() => setStage(stage === s.stage ? "" : s.stage)}
          >
            <span>{s.stage}</span>
            <strong>{s.count.toString().padStart(2, "0")}</strong>
            <i />
          </button>
        ))}
      </section>
      <section className="panel pipeline-panel">
        <div className="pipeline-toolbar">
          <div className="tabs compact">
            <button
              className={!trash ? "active" : ""}
              onClick={() => setTrash(false)}
            >
              All leads <span>{ctx.leads.length}</span>
            </button>
            <button
              className={trash ? "active" : ""}
              onClick={() => setTrash(true)}
            >
              <Trash2 size={14} />
              Trash
            </button>
          </div>
          <div className="actions">
            <a className="text-button" href="/api/export" download>
              <ArrowDownToLine size={15} />
              Export
            </a>
            <div className="view-switch">
              <button
                aria-label="Table view"
                className={view === "table" ? "active" : ""}
                onClick={() => setView("table")}
              >
                <LayoutList size={16} />
              </button>
              <button
                aria-label="Board view"
                className={view === "board" ? "active" : ""}
                onClick={() => setView("board")}
                disabled={trash}
              >
                <Columns3 size={16} />
              </button>
            </div>
          </div>
        </div>
        <div className="filter-bar">
          <div className="search-input">
            <Search size={16} />
            <input
              placeholder="Search name, company, role…"
              aria-label="Filter leads"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Select
            aria-label="Filter category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {ctx.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="">All priorities</option>
            {["Hot", "Warm", "Cold"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
          <Select
            aria-label="Filter owner"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
          >
            <option value="">All owners</option>
            {ctx.staff.map((s) => (
              <option value={s.id} key={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter credibility"
            value={cred}
            onChange={(e) => setCred(e.target.value)}
          >
            <option value="">Any credibility</option>
            <option value="verified">Verified (70+)</option>
            <option value="partial">Partly checked</option>
            <option value="none">Unverified</option>
          </Select>
        </div>
        <div className="list-subbar">
          <span>
            {rows.length} {rows.length === 1 ? "lead" : "leads"}
            {stage && (
              <>
                {" "}
                in <button onClick={() => setStage("")}>{stage} ×</button>
              </>
            )}
          </span>
          <CheckLine checked={onlyDue} onChange={setOnlyDue}>
            Follow-ups due
          </CheckLine>
          <label>
            Sort by{" "}
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="fit">Fit score</option>
              <option value="credibility">Credibility</option>
              <option value="newest">Newest first</option>
            </select>
          </label>
        </div>
        {!rows.length ? (
          <Empty
            icon={Users}
            title={
              ctx.leads.length
                ? "No matching leads"
                : "A little space for opportunity"
            }
            action={
              <Button onClick={ctx.addLead}>
                <Plus size={16} />
                Add a lead
              </Button>
            }
          >
            {ctx.leads.length
              ? "Try adjusting your filters or clearing the search."
              : "Your leads will appear here. Start with one person or import a CSV."}
          </Empty>
        ) : view === "board" && !trash ? (
          <div className="kanban" aria-busy={busy}>
            {STAGES.map((s) => (
              <div
                className="kanban-column"
                key={s}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  move(e.dataTransfer.getData("text/plain"), s);
                }}
              >
                <h3>
                  {s}
                  <span>{rows.filter((l) => l.stage === s).length}</span>
                </h3>
                {rows
                  .filter((l) => l.stage === s)
                  .map((l) => (
                    <button
                      className="kanban-card"
                      key={l.id}
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData("text/plain", l.id)
                      }
                      onClick={() => ctx.openLead(l.id)}
                    >
                      <Avatar name={l.name} small />
                      <strong>{l.name}</strong>
                      <small>{l.company || "Company to confirm"}</small>
                      <p>{l.title || "Role to confirm"}</p>
                      <div>
                        <Score value={l.fitScore} />
                        {l.isSample && <Badge>Sample</Badge>}
                      </div>
                    </button>
                  ))}
                <small className="drop-hint">Drop a lead here</small>
              </div>
            ))}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="leads-table">
              <thead>
                <tr>
                  <th>PERSON & COMPANY</th>
                  <th>CATEGORY</th>
                  <th>FIT SCORE</th>
                  <th>CREDIBILITY</th>
                  <th>STAGE</th>
                  <th>FOLLOW-UP</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr
                    key={l.id}
                    onClick={() => !trash && ctx.openLead(l.id)}
                    tabIndex={trash ? -1 : 0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !trash) ctx.openLead(l.id);
                    }}
                  >
                    <td>
                      <div className="person-cell">
                        <Avatar name={l.name} />
                        <div>
                          <strong>
                            {l.name}
                            {l.isSample && (
                              <span className="sample-label">SAMPLE</span>
                            )}
                            {l.doNotContact && (
                              <Badge tone="red">Do not contact</Badge>
                            )}
                          </strong>
                          <small>{l.title || "Role to confirm"}</small>
                          <small className="company-line">
                            {l.company || "Company to confirm"}
                            {l.city && " · " + l.city}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="category-label">
                        {ctx.categories.find((c) => c.id === l.categoryId)
                          ?.name || "Uncategorized"}
                      </span>
                    </td>
                    <td>
                      <Score value={l.fitScore} />
                    </td>
                    <td>
                      <div className="credibility">
                        <ShieldCheck size={14} />
                        {l.credibilityScore}
                        <span>/100</span>
                      </div>
                      <small className="muted">
                        {l.credibilityScore >= 70
                          ? "Verified"
                          : l.credibilityScore > 0
                            ? "Partly checked"
                            : "Unverified"}
                      </small>
                    </td>
                    <td>
                      <Badge
                        tone={
                          l.stage === "Won"
                            ? "green"
                            : l.stage === "Lost"
                              ? "red"
                              : "neutral"
                        }
                      >
                        {l.stage}
                      </Badge>
                    </td>
                    <td>
                      <span className={due(l) ? "overdue" : "muted"}>
                        {l.followUpAt ? date(l.followUpAt) : "—"}
                      </span>
                    </td>
                    <td>
                      {trash ? (
                        <div className="actions">
                          <button
                            className="icon-button"
                            title="Restore lead"
                            aria-label={"Restore " + l.name}
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await post("/leads/" + l.id + "/restore");
                                await ctx.refresh();
                                await loadTrash();
                                ctx.notify("Lead restored.");
                              } catch (e: any) {
                                ctx.notify(e.message, true);
                              }
                            }}
                          >
                            <RotateCcw size={16} />
                          </button>
                          {ctx.user.role === "Admin" && (
                            <button
                              className="icon-button danger-text"
                              aria-label={"Permanently delete " + l.name}
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (
                                  !confirm(
                                    "Permanently delete this lead, their contact details and outreach history? This cannot be undone.",
                                  )
                                )
                                  return;
                                try {
                                  await del("/leads/" + l.id + "/purge");
                                  await loadTrash();
                                  ctx.notify(
                                    "Lead and related personal data permanently deleted.",
                                  );
                                } catch (e: any) {
                                  ctx.notify(e.message, true);
                                }
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ) : (
                        <ChevronRight size={16} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="page-hint">
        <ShieldCheck size={14} />
        Fit reflects potential relevance. Credibility reflects checks completed
        by your team.
      </div>
    </>
  );
}
function ActivityPage({ ctx }: { ctx: Context }) {
  const [logs, setLogs] = useState<Activity[]>([]),
    [outreach, setOutreach] = useState<Outreach[]>([]),
    [tab, setTab] = useState("history"),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([api<Activity[]>("/activity"), api<Outreach[]>("/outreach")])
      .then(([a, o]) => {
        setLogs(a);
        setOutreach(o);
      })
      .catch((e) => ctx.notify(e.message, true))
      .finally(() => setLoading(false));
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">A SHARED RECORD</div>
          <h1>
            Every step, remembered<span className="heading-dot">.</span>
          </h1>
          <p>See how your team is moving conversations forward.</p>
        </div>
      </div>
      <section className="panel">
        <div className="tabs">
          <button
            className={tab === "history" ? "active" : ""}
            onClick={() => setTab("history")}
          >
            Workspace history
          </button>
          <button
            className={tab === "outreach" ? "active" : ""}
            onClick={() => setTab("outreach")}
          >
            Recorded outreach
          </button>
        </div>
        {loading ? (
          <p className="padding muted">Loading activity…</p>
        ) : tab === "history" ? (
          <div className="activity-list">
            {logs.map((a) => (
              <article key={a.id}>
                <span className="activity-dot">
                  <History size={15} />
                </span>
                <div>
                  <strong>{a.action}</strong>
                  {a.detail && <p>{a.detail}</p>}
                  <small>
                    {ctx.staff.find((s) => s.id === a.staffId)?.name ||
                      "Team member"}{" "}
                    · {date(a.at, true)}
                  </small>
                </div>
                {a.leadId && ctx.leads.some((l) => l.id === a.leadId) && (
                  <button
                    className="text-button"
                    onClick={() => ctx.openLead(a.leadId)}
                  >
                    View lead
                    <ArrowUpRight size={14} />
                  </button>
                )}
              </article>
            ))}
          </div>
        ) : outreach.length ? (
          <div className="activity-list">
            {outreach.map((o) => (
              <article key={o.id}>
                <span className="activity-dot">
                  <Linkedin size={15} />
                </span>
                <div>
                  <strong>
                    {o.channel} ·{" "}
                    {ctx.leads.find((l) => l.id === o.leadId)?.name ||
                      "Archived lead"}
                  </strong>
                  <p className="preserve-text">{o.message}</p>
                  <small>
                    {ctx.staff.find((s) => s.id === o.staffId)?.name} ·{" "}
                    {date(o.sentAt, true)}
                  </small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty icon={History} title="Your conversations will leave a trail">
            After sending a message yourself, record it on the lead’s Outreach
            tab.
          </Empty>
        )}
      </section>
    </>
  );
}
