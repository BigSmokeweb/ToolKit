import { useState, useEffect } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Copy,
  Database,
  ExternalLink,
  Linkedin,
  LockKeyhole,
  Plus,
  Radio,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import type { Context } from "./App";
import type { Settings, Staff } from "./types";
import { api, post, put, del, date } from "./lib";
import { Avatar, Badge, Button, External, Field, Select } from "./components";
import BrowserCaptureSettings from "./BrowserCaptureSettings";
export default function SettingsPage({ ctx }: { ctx: Context }) {
  const admin = ctx.user.role === "Admin";
  const [tab, setTab] = useState("integrations"),
    [settings, setSettings] = useState<Settings>({}),
    [values, setValues] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [member, setMember] = useState({
      name: "",
      email: "",
    }),
    [newCategory, setNewCategory] = useState({
      name: "",
      audience: "",
      signal: "",
      titles: "",
      keywords: "",
      phrases: "",
      jobs: "",
    });
  async function load() {
    if (!admin) return;
    const s = await api<Settings>("/settings");
    setSettings(s);
    setValues({
      ...(Object.fromEntries(
        Object.entries(s).filter(([, v]) => typeof v === "string"),
      ) as Record<string, string>),
      geminiKey: "",
      linkedinClientSecret: "",
      braveKey: "",
    });
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  const change = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }));
  async function save(keys: string[]) {
    setBusy("save");
    setError("");
    try {
      const s = await put<Settings>(
        "/settings",
        Object.fromEntries(
          keys
            .filter((k) => values[k] !== undefined)
            .map((k) => [k, values[k]]),
        ),
      );
      setSettings(s);
      setValues((v) => ({
        ...v,
        geminiKey: "",
        linkedinClientSecret: "",
        braveKey: "",
      }));
      await ctx.refresh();
      ctx.notify("Settings saved.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function connect() {
    setBusy("linkedin");
    setError("");
    try {
      const r = await post("/integrations/linkedin/start");
      window.location.assign(r.url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function clearSecret(key: string) {
    if (
      !confirm(
        "Remove this saved API credential? The integration will stop using it.",
      )
    )
      return;
    try {
      await del("/settings/secrets/" + key);
      await load();
      await ctx.refresh();
      ctx.notify("Saved credential removed.");
    } catch (e: any) {
      setError(e.message);
    }
  }
  const account = ctx.integrations.linkedin;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MAKE THE DESK YOURS</div>
          <h1>
            A workspace that works for you<span className="heading-dot">.</span>
          </h1>
          <p>
            Connect your tools, set your preferences and bring your team
            together.
          </p>
        </div>
        <Badge tone="green">
          <ShieldCheck size={13} />
          Shared workspace
        </Badge>
      </div>
      <div className="settings-tabs tabs">
        <button
          className={tab === "integrations" ? "active" : ""}
          onClick={() => setTab("integrations")}
        >
          Integrations
        </button>
        {admin && (
          <>
            <button
              className={tab === "workspace" ? "active" : ""}
              onClick={() => setTab("workspace")}
            >
              Workspace
            </button>
            <button
              className={tab === "team" ? "active" : ""}
              onClick={() => setTab("team")}
            >
              Team
            </button>
            <button
              className={tab === "data" ? "active" : ""}
              onClick={() => setTab("data")}
            >
              Data & privacy
            </button>
          </>
        )}
      </div>
      {error && (
        <div className="error-box settings-error" role="alert">
          {error}
        </div>
      )}
      {tab === "integrations" && (
        <div className="settings-grid">
          <section className="panel integration-settings">
            <div className="panel-heading">
              <div className="integration-title">
                <span className="integration-icon linkedin">
                  <Linkedin size={22} />
                </span>
                <div>
                  <h2>Your personal LinkedIn</h2>
                  <p>Connect your identity. Keep outreach personal.</p>
                </div>
              </div>
              <Badge tone={account && !account.expired ? "green" : "neutral"}>
                {account
                  ? account.expired
                    ? "Reconnect needed"
                    : "Connected"
                  : "Not connected"}
              </Badge>
            </div>
            <div className="padding">
              {account && (
                <div className="connected-account">
                  <Avatar name={account.name} />
                  <div>
                    <strong>{account.name}</strong>
                    <small>
                      {account.email || "Email not provided by LinkedIn"}
                    </small>
                    <small>
                      Token {account.expired ? "expired" : "expires"}{" "}
                      {date(account.expiresAt)}
                    </small>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await del("/integrations/linkedin");
                        await ctx.refresh();
                        ctx.notify(
                          "LinkedIn disconnected from this workspace.",
                        );
                      } catch (e: any) {
                        setError(e.message);
                      }
                    }}
                  >
                    Disconnect
                  </Button>
                </div>
              )}
              <div className="info-box">
                <Linkedin size={19} />
                <span>
                  Search links already open using whichever LinkedIn account
                  you’re signed into. Connecting here links your basic profile; it
                  does not unlock people search, contact harvesting, invites or
                  direct messages.
                </span>
              </div>
              <div className="actions">
                <Button
                  busy={busy === "linkedin"}
                  onClick={connect}
                  disabled={!ctx.integrations.linkedinConfigured}
                >
                  <Linkedin size={16} />
                  {account ? "Reconnect LinkedIn" : "Connect my LinkedIn"}
                </Button>
                <External
                  className="button secondary"
                  href="https://www.linkedin.com/feed/"
                >
                  Open my LinkedIn
                </External>
              </div>
              <details
                className="setup-guide"
                open={!ctx.integrations.linkedinConfigured}
              >
                <summary>How to connect a personal account</summary>
                <ol>
                  <li>
                    Use your LinkedIn account to create an app in the{" "}
                    <External href="https://www.linkedin.com/developers/apps">
                      LinkedIn Developer Portal
                    </External>
                    . App creation may require association with a company page;
                    the account you connect here is still your personal member
                    account.
                  </li>
                  <li>
                    Request{" "}
                    <strong>Sign In with LinkedIn using OpenID Connect</strong>{" "}
                    under Products.
                  </li>
                  <li>
                    Register the exact HTTPS callback shown below under Auth.
                  </li>
                  <li>
                    {admin
                      ? "Enter the app’s Client ID and Client Secret, then save."
                      : "Ask your workspace administrator to add the developer app credentials."}
                  </li>
                  <li>
                    Open this workspace at the callback’s HTTPS origin, select
                    Connect my LinkedIn, and approve the identity permissions on
                    LinkedIn.
                  </li>
                </ol>
                <p>
                  For local testing, follow the HTTPS steps in the project
                  README. Do not bypass browser certificate warnings.
                </p>
                <div className="callback-box">
                  <code>{ctx.integrations.callback}</code>
                  <button
                    className="icon-button"
                    title="Copy callback URL"
                    aria-label="Copy callback URL"
                    onClick={() =>
                      navigator.clipboard
                        .writeText(ctx.integrations.callback)
                        .then(() => ctx.notify("Callback URL copied."))
                        .catch(() =>
                          ctx.notify(
                            "Select and copy the callback URL manually.",
                            true,
                          ),
                        )
                    }
                  >
                    <Copy size={15} />
                  </button>
                </div>
              </details>
              {admin && (
                <div className="integration-form">
                  <Field label="LinkedIn Client ID">
                    <input
                      value={values.linkedinClientId || ""}
                      onChange={(e) =>
                        change("linkedinClientId", e.target.value)
                      }
                      autoComplete="off"
                    />
                  </Field>
                  <Field
                    label="Client Secret"
                    hint={
                      settings.linkedinClientSecretConfigured
                        ? "A secret is saved. Leave blank to keep it."
                        : "Stored encrypted on the server."
                    }
                  >
                    <input
                      type="password"
                      value={values.linkedinClientSecret || ""}
                      onChange={(e) =>
                        change("linkedinClientSecret", e.target.value)
                      }
                      autoComplete="new-password"
                      placeholder={
                        settings.linkedinClientSecretConfigured
                          ? "•••••••• · saved"
                          : "Paste your developer app secret"
                      }
                    />
                  </Field>
                  <Field label="Exact HTTPS callback URL">
                    <input
                      type="url"
                      value={values.linkedinCallback || ""}
                      onChange={(e) =>
                        change("linkedinCallback", e.target.value)
                      }
                    />
                  </Field>
                  <div className="actions">
                    <Button
                      variant="secondary"
                      busy={busy === "save"}
                      onClick={() =>
                        save([
                          "linkedinClientId",
                          "linkedinClientSecret",
                          "linkedinCallback",
                        ])
                      }
                    >
                      <Save size={15} />
                      Save LinkedIn setup
                    </Button>
                    {!!settings.linkedinClientSecretConfigured && (
                      <Button
                        variant="ghost"
                        onClick={() => clearSecret("linkedinClientSecret")}
                      >
                        Remove secret
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
          <section className="panel integration-settings">
            <div className="panel-heading">
              <div className="integration-title">
                <span className="integration-icon gemini">
                  <Sparkles size={23} />
                </span>
                <div>
                  <h2>Gemini AI</h2>
                  <p>A little assistance. Your judgement stays in charge.</p>
                </div>
              </div>
              <Badge
                tone={ctx.integrations.geminiConfigured ? "green" : "neutral"}
              >
                {ctx.integrations.geminiConfigured
                  ? "Key configured"
                  : "Not configured"}
              </Badge>
            </div>
            <div className="padding">
              <div className="feature-pills">
                <span>
                  <SearchIcon />
                  Build search fields
                </span>
                <span>
                  <Users size={14} />
                  Extract leads
                </span>
                <span>
                  <Sparkles size={14} />
                  Draft messages
                </span>
              </div>
              <p className="muted">
                Bring your own Google AI Studio key. Requests happen only when
                you use an AI action. AI-extracted leads and message drafts
                always need your review.
              </p>
              {admin ? (
                <>
                  <Field
                    label="Gemini API key"
                    hint={
                      settings.geminiKeyConfigured
                        ? "A key is saved. Leave blank to keep it."
                        : "The key is encrypted on this server and never returned to the browser."
                    }
                  >
                    <input
                      type="password"
                      value={values.geminiKey || ""}
                      onChange={(e) => change("geminiKey", e.target.value)}
                      autoComplete="new-password"
                      placeholder={
                        settings.geminiKeyConfigured
                          ? "•••••••• · saved"
                          : "Paste your Gemini API key"
                      }
                    />
                  </Field>
                  <div className="form-grid">
                    <Field label="Model identifier">
                      <input
                        value={values.geminiModel || ""}
                        onChange={(e) => change("geminiModel", e.target.value)}
                        placeholder="gemini-3.1-flash-lite"
                      />
                    </Field>
                    <Field label="Daily AI requests · team limit">
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={values.aiDailyLimit || "50"}
                        onChange={(e) => change("aiDailyLimit", e.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="actions">
                    <Button
                      variant="secondary"
                      busy={busy === "save"}
                      onClick={() =>
                        save(["geminiKey", "geminiModel", "aiDailyLimit"])
                      }
                    >
                      <Save size={15} />
                      Save AI setup
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={!ctx.integrations.geminiConfigured || !!busy}
                      onClick={async () => {
                        setBusy("test");
                        setError("");
                        try {
                          await post("/ai/test");
                          ctx.notify("Gemini returned a valid test response.");
                          await ctx.refresh();
                        } catch (e: any) {
                          setError(e.message);
                        } finally {
                          setBusy("");
                        }
                      }}
                      busy={busy === "test"}
                    >
                      Test connection
                    </Button>
                    {!!settings.geminiKeyConfigured && (
                      <button
                        className="icon-button"
                        aria-label="Remove Gemini key"
                        onClick={() => clearSecret("geminiKey")}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <p className="muted">
                  Your administrator manages the shared AI key.
                </p>
              )}
              <div className="usage-meter">
                <span>
                  Today’s usage{" "}
                  <strong>
                    {ctx.overview.aiRequests} / {ctx.overview.aiLimit} requests
                  </strong>
                </span>
                <div className="bar-track">
                  <i
                    style={{
                      width:
                        Math.min(
                          100,
                          (ctx.overview.aiRequests / ctx.overview.aiLimit) *
                            100,
                        ) + "%",
                    }}
                  />
                </div>
                <small>
                  {ctx.overview.aiTokens.toLocaleString()} tokens recorded ·
                  daily counters reset at 00:00 UTC
                </small>
              </div>
              <details className="setup-guide">
                <summary>Get a key when you’re ready</summary>
                <ol>
                  <li>
                    Create a key in{" "}
                    <External href="https://aistudio.google.com/apikey">
                      Google AI Studio
                    </External>
                    .
                  </li>
                  <li>
                    Check model availability and free-tier limits for your
                    Google project.
                  </li>
                  <li>Paste the key above, save, then test the connection.</li>
                </ol>
                <p>
                  Free-tier availability is controlled by Google. Free-tier
                  inputs may be used to improve Google’s products; check the
                  provider’s terms before sharing personal or confidential
                  information. This app logs request counts and tokens, not
                  source prompts.
                </p>
              </details>
            </div>
          </section>
          <BrowserCaptureSettings ctx={ctx} />
          <section className="panel integration-settings wide-panel">
            <div className="panel-heading">
              <div className="integration-title">
                <span className="integration-icon brave">
                  <Radio size={22} />
                </span>
                <div>
                  <h2>Public buying-signal monitoring</h2>
                  <p>Use Brave Search to watch for relevant public events.</p>
                </div>
              </div>
              <Badge
                tone={ctx.integrations.braveConfigured ? "green" : "neutral"}
              >
                {ctx.integrations.braveConfigured
                  ? "Key configured"
                  : "Optional"}
              </Badge>
            </div>
            <div className="padding">
              <p className="muted">
                Save a search with daily monitoring enabled. While this server
                is running, it collects fresh public results once a day for your
                team to review. It does not extract private LinkedIn data.
              </p>
              {admin && (
                <>
                  <Field label="Brave Search API key">
                    <input
                      type="password"
                      value={values.braveKey || ""}
                      onChange={(e) => change("braveKey", e.target.value)}
                      autoComplete="new-password"
                      placeholder={
                        settings.braveKeyConfigured
                          ? "•••••••• · saved"
                          : "Optional provider key"
                      }
                    />
                  </Field>
                  <div className="actions">
                    <Button
                      variant="secondary"
                      busy={busy === "save"}
                      onClick={() => save(["braveKey"])}
                    >
                      Save monitoring setup
                    </Button>
                    <External
                      className="text-button"
                      href="https://api-dashboard.search.brave.com/"
                    >
                      Get a provider key
                    </External>
                    {!!settings.braveKeyConfigured && (
                      <Button
                        variant="ghost"
                        onClick={() => clearSecret("braveKey")}
                      >
                        Remove key
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      )}
      {tab === "workspace" && admin && (
        <div className="settings-grid">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Outreach preferences</h2>
                <p>Small defaults that keep your team consistent.</p>
              </div>
            </div>
            <div className="padding">
              <div className="form-grid">
                <Field label="Sender name">
                  <input
                    value={values.senderName || ""}
                    onChange={(e) => change("senderName", e.target.value)}
                  />
                </Field>
                <Field label="Daily recorded invite limit · per person">
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={values.inviteLimit || "15"}
                    onChange={(e) => change("inviteLimit", e.target.value)}
                  />
                </Field>
                <Field label="Company LinkedIn page">
                  <input
                    type="url"
                    value={values.companyUrl || ""}
                    onChange={(e) => change("companyUrl", e.target.value)}
                    placeholder="https://www.linkedin.com/company/…"
                  />
                </Field>
                <Field label="Sender LinkedIn profile">
                  <input
                    type="url"
                    value={values.senderProfile || ""}
                    onChange={(e) => change("senderProfile", e.target.value)}
                    placeholder="https://www.linkedin.com/in/…"
                  />
                </Field>
                <Field
                  label="Target cities · comma-separated"
                  wide
                  hint="A matching city adds 10 points to the fit score."
                >
                  <textarea
                    rows={3}
                    value={values.targetCities || ""}
                    onChange={(e) => change("targetCities", e.target.value)}
                  />
                </Field>
              </div>
              <p className="small-note">
                The invitation limit tracks invites your team records; it is not
                a statement of LinkedIn’s permitted limits. Counters reset at
                00:00 UTC.
              </p>
              <Button
                busy={busy === "save"}
                onClick={() =>
                  save([
                    "senderName",
                    "inviteLimit",
                    "companyUrl",
                    "senderProfile",
                    "targetCities",
                  ])
                }
              >
                <Save size={15} />
                Save preferences
              </Button>
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Add a service category</h2>
                <p>Build a repeatable search for another offering.</p>
              </div>
            </div>
            <form
              className="padding"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy("category");
                setError("");
                try {
                  await post("/categories", newCategory);
                  await ctx.refresh();
                  setNewCategory({
                    name: "",
                    audience: "",
                    signal: "",
                    titles: "",
                    keywords: "",
                    phrases: "",
                    jobs: "",
                  });
                  ctx.notify("Service category added.");
                } catch (e: any) {
                  setError(e.message);
                } finally {
                  setBusy("");
                }
              }}
            >
              {[
                ["name", "Category name *"],
                ["audience", "Who to find"],
                ["signal", "Buying signal"],
                ["titles", "Job titles · comma-separated"],
                ["keywords", "Industries · comma-separated"],
                ["phrases", "Post phrases · comma-separated"],
                ["jobs", "Hiring keywords"],
              ].map(([key, label]) => (
                <Field key={key} label={label}>
                  <input
                    required={key === "name"}
                    maxLength={key === "name" ? 120 : 1000}
                    value={newCategory[key as keyof typeof newCategory]}
                    onChange={(e) =>
                      setNewCategory((c) => ({ ...c, [key]: e.target.value }))
                    }
                  />
                </Field>
              ))}
              <Button
                variant="secondary"
                type="submit"
                busy={busy === "category"}
              >
                <Plus size={15} />
                Add category
              </Button>
            </form>
          </section>
        </div>
      )}
      {tab === "team" && admin && (
        <div className="settings-grid">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>The people behind the conversations</h2>
                <p>Assign leads to people in this shared workspace.</p>
              </div>
              <Badge>{ctx.staff.filter((s) => s.active).length} active</Badge>
            </div>
            {ctx.staff.map((s) => (
              <div className="team-row" key={s.id}>
                <Avatar name={s.name} />
                <div>
                  <strong>
                    {s.name}
                    {s.id === ctx.user.id && <small> (workspace owner)</small>}
                  </strong>
                  <small>
                    {s.id === ctx.user.id ? "Shared workspace" : s.email}
                  </small>
                </div>
                <Badge tone={s.active ? "green" : "neutral"}>
                  {s.active
                    ? s.id === ctx.user.id
                      ? "Workspace owner"
                      : "Team member"
                    : "Inactive"}
                </Badge>
                {s.id !== ctx.user.id && (
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await post("/staff/" + s.id + "/active", {
                          active: !s.active,
                        });
                        await ctx.refresh();
                        ctx.notify(
                          s.active
                            ? "Team member deactivated."
                            : "Team member reactivated.",
                        );
                      } catch (e: any) {
                        setError(e.message);
                      }
                    }}
                  >
                    {s.active ? "Deactivate" : "Activate"}
                  </Button>
                )}
              </div>
            ))}
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Add a team member</h2>
                <p>
                  Add a person for lead ownership and follow-up assignments.
                </p>
              </div>
              <UserPlus size={20} />
            </div>
            <form
              className="padding"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy("member");
                setError("");
                try {
                  await post("/staff", member);
                  setMember({
                    name: "",
                    email: "",
                  });
                  await ctx.refresh();
                  ctx.notify(
                    "Team member added. You can now assign leads to them.",
                  );
                } catch (e: any) {
                  setError(e.message);
                } finally {
                  setBusy("");
                }
              }}
            >
              <Field label="Name">
                <input
                  required
                  value={member.name}
                  maxLength={160}
                  onChange={(e) =>
                    setMember({ ...member, name: e.target.value })
                  }
                />
              </Field>
              <Field label="Email">
                <input
                  required
                  type="email"
                  value={member.email}
                  onChange={(e) =>
                    setMember({ ...member, email: e.target.value })
                  }
                />
              </Field>
              <Button busy={busy === "member"} type="submit">
                <UserPlus size={16} />
                Add team member
              </Button>
            </form>
          </section>
        </div>
      )}
      {tab === "data" && admin && (
        <div className="settings-grid">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Provenance, retention & deletion</h2>
                <p>Keep only the information your team needs.</p>
              </div>
              <Database size={20} />
            </div>
            <div className="padding">
              <p className="muted">
                Every lead records its source and creation date. Deleting a lead
                first moves it to Trash. An administrator can then permanently
                remove the lead and its related outreach history for a deletion
                request.
              </p>
              <Field
                label="Retention period · days"
                hint="Archiving is manual and reviewable. Data is not silently deleted."
              >
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={values.retentionDays || "365"}
                  onChange={(e) => change("retentionDays", e.target.value)}
                />
              </Field>
              <Button
                variant="secondary"
                busy={busy === "save"}
                onClick={() => save(["retentionDays"])}
              >
                Save retention period
              </Button>
              <div className="retention-box">
                <strong>
                  {ctx.overview.retentionDue} leads exceed the saved retention
                  period
                </strong>
                <p>
                  Archive moves them to Trash, including leads in completed
                  stages. Review before permanent deletion.
                </p>
                <Button
                  variant="secondary"
                  disabled={!ctx.overview.retentionDue}
                  onClick={async () => {
                    if (
                      !confirm(
                        "Move all leads older than your saved retention period to Trash? You can restore them later.",
                      )
                    )
                      return;
                    try {
                      const r = await post("/retention/archive");
                      await ctx.refresh();
                      ctx.notify(r.archived + " leads moved to Trash.");
                    } catch (e: any) {
                      setError(e.message);
                    }
                  }}
                >
                  Archive expired records
                </Button>
              </div>
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Your data, portable</h2>
                <p>Export leads or review removed records.</p>
              </div>
            </div>
            <div className="padding">
              <p className="muted">
                CSV exports include active lead details, sources and notes. Keep
                backups of the database and encryption keys together; the README
                covers both SQLite and MySQL deployment.
              </p>
              <div className="actions">
                <a href="/api/export" className="button secondary" download>
                  Export active leads
                </a>
                <Button
                  variant="ghost"
                  onClick={() => ctx.navigate("pipeline")}
                >
                  Open pipeline & Trash
                  <ArrowUpRight size={15} />
                </Button>
              </div>
              <div className="info-box">
                <LockKeyhole size={18} />
                <span>
                  API keys and LinkedIn tokens are stored server-side using
                  ASP.NET Data Protection. Restrict access to the server’s data
                  directory and backups.
                </span>
              </div>
              <p className="small-note">
                Before live outreach, your organization should finalize its
                privacy notice, permitted outreach approach, retention policy
                and handling of opt-out or deletion requests.
              </p>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
function SearchIcon() {
  return <Sparkles size={14} />;
}
