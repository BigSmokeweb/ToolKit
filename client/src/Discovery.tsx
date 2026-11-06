import { useState, useEffect } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  CheckCircle2,
  ChevronRight,
  Compass,
  ExternalLink,
  FileInput,
  Linkedin,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import type { Context } from "./App";
import type { Criteria, SavedSearch, SearchLink } from "./types";
import { api, post, del, emptyCriteria } from "./lib";
import {
  Badge,
  Button,
  CheckLine,
  Field,
  Select,
  External,
} from "./components";
export default function Discovery({
  ctx,
  onImport,
}: {
  ctx: Context;
  onImport: () => void;
}) {
  const [criteria, setCriteria] = useState<Criteria>(() => {
      const c =
        ctx.categories.find((c) => c.id === "dpdp") || ctx.categories[0];
      return { ...emptyCriteria, ...c, categoryId: c.id };
    }),
    [links, setLinks] = useState<SearchLink[]>([]),
    [saved, setSaved] = useState<SavedSearch[]>([]),
    [prompt, setPrompt] = useState(""),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [searchName, setSearchName] = useState(""),
    [linkError, setLinkError] = useState("");
  const change = (k: keyof Criteria, v: string | boolean) =>
    setCriteria((c) => ({ ...c, [k]: v }));
  const category =
    ctx.categories.find((c) => c.id === criteria.categoryId) ||
    ctx.categories[0];
  useEffect(() => {
    api<SavedSearch[]>("/searches")
      .then(setSaved)
      .catch((e) => ctx.notify(e.message, true));
  }, []);
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      post<SearchLink[]>("/discovery", criteria)
        .then((l) => {
          if (alive) {
            setLinks(l);
            setLinkError("");
          }
        })
        .catch((e) => {
          if (alive) setLinkError(e.message);
        });
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [criteria]);
  async function build() {
    setBusy(true);
    try {
      const result = await post("/ai/build-search", { text: prompt });
      setCriteria((c) => ({ ...c, ...result }));
      ctx.notify(
        "Search fields prepared. Review them before opening a search.",
      );
    } catch (e: any) {
      ctx.notify(e.message, true);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setSaving(true);
    try {
      const s = await post<SavedSearch>("/searches", {
        name: searchName || category.name + " · " + criteria.city,
        criteria,
      });
      setSaved((x) => [...x, s]);
      setSearchName("");
      ctx.notify("Search saved.");
    } catch (e: any) {
      ctx.notify(e.message, true);
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">DISCOVER WITH INTENT</div>
          <h1>
            Find the right people<span className="heading-dot">.</span>
          </h1>
          <p>A real business need is the beginning of a better conversation.</p>
        </div>
        <div className="actions">
          <a className="button primary" href="/?setup=capture#settings">
            Set up one-click capture
            <ArrowUpRight size={15} />
          </a>
          <Button variant="secondary" onClick={onImport}>
            <FileInput size={16} />
            Paste text or import CSV
          </Button>
        </div>
      </div>
      <div className="discovery-layout">
        <aside className="panel category-sidebar">
          <div className="category-heading">
            <span className="step">01</span>
            <div>
              <h2>Choose your service</h2>
              <p>Who can you help?</p>
            </div>
          </div>
          {ctx.categories.map((c) => (
            <button
              className={
                "category-option " +
                (c.id === criteria.categoryId ? "selected" : "")
              }
              key={c.id}
              onClick={() =>
                setCriteria({
                  ...emptyCriteria,
                  titles: c.titles,
                  keywords: c.keywords,
                  phrases: c.phrases,
                  jobs: c.jobs,
                  categoryId: c.id,
                })
              }
            >
              <span className="category-radio">
                {c.id === criteria.categoryId && <span />}
              </span>
              <div>
                <strong>{c.name}</strong>
                <small>{c.audience}</small>
              </div>
              <ChevronRight size={14} />
            </button>
          ))}
          <div className="category-note">
            <Compass size={17} />
            <p>Start with a category. Fine-tune the search for your market.</p>
          </div>
        </aside>
        <div className="discovery-main">
          <section className="panel search-builder">
            <div className="panel-heading">
              <div className="step-heading">
                <span className="step">02</span>
                <div>
                  <h2>Shape your search</h2>
                  <p>{category.name}</p>
                </div>
              </div>
              <Badge tone="green">
                {ctx.integrations.geminiConfigured
                  ? "Gemini ready"
                  : "Manual search ready"}
              </Badge>
            </div>
            <div className="buying-signal">
              <Target size={19} />
              <div>
                <strong>LOOK FOR THIS SIGNAL</strong>
                <p>{category.signal}</p>
              </div>
            </div>
            <div className="ai-search">
              <Sparkles size={19} />
              <div>
                <label htmlFor="ai-prompt">
                  Describe who you’re looking for
                </label>
                <div>
                  <input
                    id="ai-prompt"
                    placeholder="e.g. Fintech founders in Mumbai hiring a privacy officer"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    maxLength={2000}
                  />
                  <Button
                    variant="secondary"
                    busy={busy}
                    disabled={
                      !prompt.trim() || !ctx.integrations.geminiConfigured
                    }
                    onClick={build}
                  >
                    Build with AI
                    <ArrowUpRight size={14} />
                  </Button>
                </div>
                <small>
                  {ctx.integrations.geminiConfigured
                    ? "Gemini turns your description into editable fields below."
                    : "Add a Gemini key in Settings when you’re ready. You can edit every field below now."}
                </small>
              </div>
            </div>
            <div className="form-grid">
              <Field label="Job titles" hint="Separate titles with commas">
                <input
                  value={criteria.titles}
                  onChange={(e) => change("titles", e.target.value)}
                  placeholder="Founder, CTO, Head of Compliance"
                />
              </Field>
              <Field label="Industries or keywords">
                <input
                  value={criteria.keywords}
                  onChange={(e) => change("keywords", e.target.value)}
                  placeholder="SaaS, fintech, healthtech"
                />
              </Field>
              <Field label="Phrases in posts">
                <input
                  value={criteria.phrases}
                  onChange={(e) => change("phrases", e.target.value)}
                  placeholder="DPDP compliance, privacy officer"
                />
              </Field>
              <Field label="Roles companies are hiring for">
                <input
                  value={criteria.jobs}
                  onChange={(e) => change("jobs", e.target.value)}
                  placeholder="privacy counsel OR data protection officer"
                />
              </Field>
              <Field label="City or location">
                <input
                  value={criteria.city}
                  onChange={(e) => change("city", e.target.value)}
                  placeholder="India"
                  list="cities"
                />
                <datalist id="cities">
                  {[
                    "India",
                    "Mumbai",
                    "Delhi",
                    "Gurugram",
                    "Bengaluru",
                    "Pune",
                    "Hyderabad",
                    "Chennai",
                    "Jaipur",
                    "Ahmedabad",
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </datalist>
              </Field>
              <Field label="Your network">
                <Select
                  value={criteria.network}
                  onChange={(e) => change("network", e.target.value)}
                >
                  <option value="">Everyone</option>
                  <option value="F">1st degree</option>
                  <option value="S">2nd degree · warm introductions</option>
                  <option value="O">3rd degree and beyond</option>
                </Select>
              </Field>
              <Field label="Recent activity">
                <Select
                  value={criteria.time}
                  onChange={(e) => change("time", e.target.value)}
                >
                  <option value="day">Last 24 hours</option>
                  <option value="week">Last 7 days</option>
                  <option value="month">Last 30 days</option>
                </Select>
              </Field>
              <Field label="Company type">
                <Select
                  value={criteria.companyType}
                  onChange={(e) => change("companyType", e.target.value)}
                >
                  <option value="">Any type</option>
                  {[
                    "Private limited",
                    "LLP",
                    "Startup",
                    "MSME",
                    "Family business",
                  ].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Company size"
                hint="Applies to the Companies search"
              >
                <Select
                  value={criteria.size}
                  onChange={(e) => change("size", e.target.value)}
                >
                  <option value="">Any size</option>
                  {[
                    ["B", "1–10"],
                    ["C", "11–50"],
                    ["D", "51–200"],
                    ["E", "201–500"],
                    ["F", "501–1,000"],
                    ["G", "1,001–5,000"],
                  ].map(([v, t]) => (
                    <option value={v} key={v}>
                      {t} employees
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Also exclude" hint="Comma-separated terms">
                <input
                  value={criteria.exclude}
                  onChange={(e) => change("exclude", e.target.value)}
                  placeholder="e.g. recruitment, consulting"
                />
              </Field>
            </div>
            <div className="quality-filters">
              <span>
                <ShieldCheck size={16} />
                Keep the search relevant
              </span>
              <CheckLine
                checked={criteria.removeSeekers}
                onChange={(v) => change("removeSeekers", v)}
              >
                Exclude students and job seekers
              </CheckLine>
              <CheckLine
                checked={criteria.removeSellers}
                onChange={(v) => change("removeSellers", v)}
              >
                Exclude agencies and recruiters
              </CheckLine>
            </div>
            <div className="save-search">
              <input
                aria-label="Saved search name"
                placeholder="Name this search (optional)"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                maxLength={120}
              />
              <Button variant="secondary" busy={saving} onClick={save}>
                <Bookmark size={15} />
                Save search
              </Button>
            </div>
          </section>
          <section className="panel search-results">
            <div className="panel-heading">
              <div className="step-heading">
                <span className="step">03</span>
                <div>
                  <h2>Open a search. Start exploring.</h2>
                  <p>
                    Start with People. If LinkedIn shows no matches, use People · broader search.
                    People searches use your first role and keyword to avoid LinkedIn’s Boolean limits;
                    apply additional filters inside LinkedIn. Review profiles before importing.
                  </p>
                </div>
              </div>
            </div>
            {linkError && <div className="error-box">{linkError}</div>}
            {["LinkedIn", "Google", "Sources"].map((group) => (
              <div className="search-group" key={group}>
                <div className="section-kicker">
                  {group === "LinkedIn" ? (
                    <Linkedin size={14} />
                  ) : group === "Google" ? (
                    <Search size={14} />
                  ) : (
                    <Compass size={14} />
                  )}{" "}
                  {group === "Sources"
                    ? "INDIA BUSINESS SOURCES"
                    : group.toUpperCase()}
                </div>
                <div className="search-link-grid">
                  {links
                    .filter((l) => l.type === group)
                    .map((l) => (
                      <article className="search-link-card" key={l.name}>
                        <div>
                          <h3>{l.name}</h3>
                          <p>{l.description}</p>
                        </div>
                        <External className="open-search" href={l.url}>
                          Open
                        </External>
                        <details>
                          <summary>View search query</summary>
                          <code>
                            {l.query ||
                              "Add keywords above to narrow this search."}
                          </code>
                        </details>
                      </article>
                    ))}
                </div>
              </div>
            ))}
            <div className="import-next">
              <div>
                <FileInput size={21} />
                <div>
                  <strong>Found someone worth a conversation?</strong>
                  <p>
                    Bring their details back here to review, qualify and follow
                    up.
                  </p>
                </div>
              </div>
              <Button onClick={onImport}>
                Add the people you found
                <ArrowRight size={15} />
              </Button>
            </div>
          </section>
          {saved.length > 0 && (
            <section className="panel saved-searches">
              <div className="panel-heading">
                <div>
                  <h2>Your saved searches</h2>
                  <p>A useful starting point, ready whenever you are.</p>
                </div>
                <Bookmark size={18} />
              </div>
              {saved.map((s) => (
                <div className="saved-search-row" key={s.id}>
                  <Bookmark size={16} />
                  <div>
                    <strong>{s.name}</strong>
                    <small>
                      Saved search
                    </small>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      try {
                        const raw = JSON.parse(s.criteria);
                        setCriteria(
                          Object.fromEntries(
                            Object.entries(raw).map(([k, v]) => [
                              k[0].toLowerCase() + k.slice(1),
                              v,
                            ]),
                          ) as unknown as Criteria,
                        );
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      } catch {
                        ctx.notify(
                          "This saved search could not be loaded.",
                          true,
                        );
                      }
                    }}
                  >
                    Use search
                    <ArrowUpRight size={14} />
                  </Button>
                  {(s.staffId === ctx.user.id || ctx.user.role === "Admin") && (
                    <button
                      className="icon-button"
                      aria-label={"Delete search " + s.name}
                      onClick={async () => {
                        if (
                          !confirm(
                            "Delete this saved search?",
                          )
                        )
                          return;
                        try {
                          await del("/searches/" + s.id);
                          setSaved((v) => v.filter((x) => x.id !== s.id));
                        } catch (e: any) {
                          ctx.notify(e.message, true);
                        }
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
