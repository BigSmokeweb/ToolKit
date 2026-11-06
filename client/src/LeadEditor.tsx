import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Linkedin,
  Mail,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { Context } from "./App";
import type { Lead, LeadInput, Outreach } from "./types";
import {
  api,
  post,
  put,
  del,
  emptyLead,
  toInput,
  CHECKS,
  STAGES,
  SIGNALS,
  date,
  localDateTime,
  followUpUtc,
  safeUrl,
} from "./lib";
import {
  Avatar,
  Badge,
  Button,
  CheckLine,
  External,
  Field,
  Modal,
  Score,
  Select,
  Empty,
} from "./components";
import { loadProfileDraft, profileDraftKey } from "./profileDraft";
export default function LeadEditor({
  ctx,
  id,
  onClose,
}: {
  ctx: Context;
  id: string;
  onClose: () => void;
}) {
  const initial = id === "new" ? null : ctx.leads.find((l) => l.id === id);
  const [lead, setLead] = useState<Lead | null>(initial || null),
    [form, setForm] = useState<LeadInput>(
      initial ? toInput(initial) : { ...emptyLead, ownerId: ctx.user.id },
    ),
    [tab, setTab] = useState("details"),
    [busy, setBusy] = useState(false),
    [draftBusy, setDraftBusy] = useState(false),
    [error, setError] = useState(""),
    [history, setHistory] = useState<{
      outreach: Outreach[];
    } | null>(null),
    [channel, setChannel] = useState("LinkedIn message"),
    [subject, setSubject] = useState(""),
    [message, setMessage] = useState(""),
    [draftType, setDraftType] = useState(""),
    [followup, setFollowup] = useState("");
  const draftAttempts = useRef(new Set<string>());
  const draftSequence = useRef(0);
  const mounted = useRef(true);
  const editRevision = useRef(0);
  const savedMessages = useRef(
    new Map<string, { message: string; subject: string; draftType: string }>(),
  );
  const draftKey = lead ? profileDraftKey(lead.id, lead.version, channel) : "";
  const activeDraftKey = useRef(draftKey);
  activeDraftKey.current = draftKey;
  const editable =
    ctx.user.role === "Admin" || !lead?.ownerId || lead.ownerId === ctx.user.id;
  const change = (key: keyof LeadInput, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));
  useEffect(() => {
    if (id !== "new")
      api<Lead>("/leads/" + id)
        .then((l) => {
          setLead(l);
          setForm(toInput(l));
          setFollowup(localDateTime(l.followUpAt));
        })
        .catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => {
    if (tab === "history" && lead)
      api("/leads/" + lead.id + "/outreach")
        .then(setHistory)
        .catch((e) => setError(e.message));
  }, [tab, lead?.version]);
  async function save(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const l = await (lead
        ? put<Lead>("/leads/" + lead.id, form)
        : post<Lead>("/leads", form));
      setLead(l);
      setForm(toInput(l));
      await ctx.refresh();
      ctx.notify(
        lead
          ? "Lead updated."
          : "Lead added. Review the details before outreach.",
      );
      if (!lead) onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const draft = useCallback(
    async (regenerate = false) => {
      if (
        !lead ||
        lead.doNotContact ||
        lead.isSample ||
        !editable ||
        channel === "Call"
      )
        return;
      const key = profileDraftKey(lead.id, lead.version, channel);
      const sequence = ++draftSequence.current;
      const revision = editRevision.current;
      draftAttempts.current.add(key);
      setDraftBusy(true);
      setError("");
      try {
        const result = await loadProfileDraft(
          key,
          () =>
            post("/ai/draft-message", {
              leadId: lead.id,
              channel,
            }),
          regenerate,
        );
        if (
          !mounted.current ||
          sequence !== draftSequence.current ||
          activeDraftKey.current !== key ||
          editRevision.current !== revision
        )
          return;
        setMessage(result.message || "");
        setSubject(result.subject || "");
        setDraftType("Gemini draft · based on captured profile");
      } catch (e: any) {
        if (
          mounted.current &&
          sequence === draftSequence.current &&
          activeDraftKey.current === key
        )
          setError(e.message);
      } finally {
        if (mounted.current && sequence === draftSequence.current)
          setDraftBusy(false);
      }
    },
    [
      lead?.id,
      lead?.version,
      lead?.doNotContact,
      lead?.isSample,
      editable,
      channel,
    ],
  );
  useEffect(() => {
    if (
      tab === "outreach" &&
      draftKey &&
      channel !== "Call" &&
      ctx.integrations.geminiConfigured &&
      !message.trim() &&
      !savedMessages.current.has(draftKey) &&
      !draftAttempts.current.has(draftKey)
    )
      void draft();
  }, [
    tab,
    draftKey,
    channel,
    ctx.integrations.geminiConfigured,
    message,
    draft,
  ]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function template() {
    if (!lead) return;
    editRevision.current++;
    const cat = ctx.categories.find((c) => c.id === lead.categoryId);
    setSubject("A conversation about " + (cat?.name || "your business needs"));
    setMessage(
      channel === "LinkedIn invite"
        ? `Hi ${lead.name.split(" ")[0]}, I’m with NoLegalPaisa. I’d be glad to connect and learn more about your work at ${lead.company || "your company"}.`
        : `Hi ${lead.name.split(" ")[0]},\n\nI’m with NoLegalPaisa. We support businesses with ${cat?.name || "legal and compliance services"}. If this is relevant to your team at ${lead.company || "your company"}, would you be open to a brief conversation?\n\nNo pressure if the timing isn’t right.\n\nNoLegalPaisa`,
    );
    setDraftType("Editable template · not generated by AI");
  }
  async function record() {
    if (!lead) return;
    setBusy(true);
    setError("");
    try {
      await post("/leads/" + lead.id + "/outreach", {
        channel,
        subject,
        message,
        followUpAt: followUpUtc(followup),
      });
      const l = await api<Lead>("/leads/" + lead.id);
      setLead(l);
      setForm(toInput(l));
      await ctx.refresh();
      setMessage("");
      setSubject("");
      setDraftType("");
      ctx.notify("Outreach recorded. This action did not send a message.");
      setTab("history");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const outreachDisabled =
    !lead || !lead.approved || lead.doNotContact || lead.isSample || !editable;
  const draftingDisabled =
    !lead || lead.doNotContact || lead.isSample || !editable;
  return (
    <Modal
      large
      title={lead ? "A closer look" : "Add a new lead"}
      subtitle={
        lead
          ? "Context first. A useful conversation next."
          : "Start with the facts you have. You can verify the rest as you go."
      }
      onClose={onClose}
    >
      {lead && (
        <>
          <div className="lead-profile">
            <Avatar name={lead.name} />
            <div>
              <h2>
                {lead.name} {lead.isSample && <Badge>Sample</Badge>}
              </h2>
              <p>
                {lead.title || "Role to confirm"}
                {lead.company && " at " + lead.company}
              </p>
              <small>
                {lead.city || "Location to confirm"} · Added{" "}
                {date(lead.createdAt)}
              </small>
            </div>
            <div className="lead-score">
              <span>FIT SCORE</span>
              <Score value={lead.fitScore} />
            </div>
            <div className="lead-score">
              <span>CREDIBILITY</span>
              <strong>
                {lead.credibilityScore}
                <small>/100</small>
              </strong>
            </div>
          </div>
          <div className="tabs padded">
            <button
              className={tab === "details" ? "active" : ""}
              onClick={() => {
                setTab("details");
                setError("");
              }}
            >
              Lead details
            </button>
            <button
              className={tab === "outreach" ? "active" : ""}
              onClick={() => {
                setTab("outreach");
                setError("");
              }}
            >
              Outreach
            </button>
            <button
              className={tab === "history" ? "active" : ""}
              onClick={() => {
                setTab("history");
                setError("");
              }}
            >
              Recorded outreach
            </button>
          </div>
        </>
      )}
      <div className="modal-body">
        {!editable && (
          <div className="info-box">
            <ShieldCheck size={18} />
            This lead is assigned to another team member. An administrator can
            reassign it.
          </div>
        )}
        {tab === "details" && (
          <form id="lead-form" onSubmit={save}>
            <fieldset disabled={!editable || busy}>
              <div className="form-grid">
                <Field label="Full name *">
                  <input
                    required
                    maxLength={160}
                    value={form.name}
                    onChange={(e) => change("name", e.target.value)}
                    placeholder="Person’s name"
                  />
                </Field>
                <Field label="Job title">
                  <input
                    maxLength={250}
                    value={form.title}
                    onChange={(e) => change("title", e.target.value)}
                    placeholder="Founder, CTO…"
                  />
                </Field>
                <Field label="Company">
                  <input
                    maxLength={200}
                    value={form.company}
                    onChange={(e) => change("company", e.target.value)}
                    placeholder="Company name"
                  />
                </Field>
                <Field label="City">
                  <input
                    maxLength={120}
                    value={form.city}
                    onChange={(e) => change("city", e.target.value)}
                    placeholder="Mumbai"
                  />
                </Field>
                <Field label="LinkedIn profile URL">
                  <input
                    type="url"
                    value={form.linkedInUrl}
                    onChange={(e) => change("linkedInUrl", e.target.value)}
                    placeholder="https://www.linkedin.com/in/…"
                  />
                </Field>
                <Field label="Business email">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => change("email", e.target.value)}
                    placeholder="Published business email, if known"
                  />
                </Field>
                <Field label="Service category">
                  <Select
                    value={form.categoryId}
                    onChange={(e) => change("categoryId", e.target.value)}
                  >
                    <option value="">Uncategorized</option>
                    {ctx.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Buying signal">
                  <Select
                    value={form.signal}
                    onChange={(e) => change("signal", e.target.value)}
                  >
                    {SIGNALS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="What you observed"
                  wide
                  hint="Use a direct observation. A score is not proof of need."
                >
                  <textarea
                    rows={2}
                    value={form.evidence}
                    maxLength={5000}
                    onChange={(e) => change("evidence", e.target.value)}
                    placeholder="e.g. Their public post mentions hiring a privacy officer."
                  />
                </Field>
                <Field label="Source">
                  <input
                    value={form.source}
                    onChange={(e) => change("source", e.target.value)}
                    placeholder="LinkedIn search, company website…"
                  />
                </Field>
                <Field label="Source URL">
                  <input
                    type="url"
                    value={form.sourceUrl}
                    onChange={(e) => change("sourceUrl", e.target.value)}
                    placeholder="https://…"
                  />
                </Field>
                <Field label="Stage">
                  <Select
                    value={form.stage}
                    onChange={(e) => change("stage", e.target.value)}
                  >
                    {STAGES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Lead owner">
                  <Select
                    value={form.ownerId}
                    onChange={(e) => change("ownerId", e.target.value)}
                    disabled={ctx.user.role !== "Admin"}
                  >
                    {ctx.user.role === "Admin" && (
                      <option value="">Unassigned</option>
                    )}
                    {ctx.staff
                      .filter((s) => s.active)
                      .map((s) => (
                        <option value={s.id} key={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </Select>
                </Field>
                <Field label="Next follow-up · India time">
                  <input
                    type="datetime-local"
                    value={localDateTime(form.followUpAt)}
                    onChange={(e) =>
                      change("followUpAt", followUpUtc(e.target.value))
                    }
                  />
                </Field>
                <Field label="Internal notes" wide>
                  <textarea
                    rows={3}
                    value={form.notes}
                    maxLength={10000}
                    onChange={(e) => change("notes", e.target.value)}
                    placeholder="Useful context for the next conversation…"
                  />
                </Field>
              </div>
              <section className="verification">
                <div className="section-kicker">
                  <ShieldCheck size={17} />
                  VERIFY THE PERSON, NOT JUST THE SCORE
                </div>
                <p>
                  Tick a check only after looking at the supporting records
                  yourself.
                </p>
                <div className="verification-grid">
                  {CHECKS.map(([key, label, points]) => (
                    <CheckLine
                      key={key}
                      checked={!!form.checks[key]}
                      onChange={(v) =>
                        change("checks", { ...form.checks, [key]: v })
                      }
                    >
                      {label}
                      <small>+{points}</small>
                    </CheckLine>
                  ))}
                </div>
                <div className="approval-row">
                  <CheckLine
                    checked={form.approved}
                    onChange={(v) => change("approved", v)}
                  >
                    I’ve reviewed this lead and approve it for outreach
                  </CheckLine>
                  <Badge tone={form.approved ? "green" : "orange"}>
                    {form.approved ? "Approved" : "Review needed"}
                  </Badge>
                </div>
                <CheckLine
                  checked={form.doNotContact}
                  onChange={(v) => change("doNotContact", v)}
                >
                  Do not contact · block outreach for this person
                </CheckLine>
              </section>
            </fieldset>
          </form>
        )}
        {tab === "outreach" && lead && (
          <div className="outreach-editor">
            {(lead.doNotContact || lead.isSample || !editable) && (
              <p className="outreach-status">
                {lead.doNotContact
                  ? "Do not contact"
                  : lead.isSample
                    ? "Sample lead"
                    : "Read-only lead"}
              </p>
            )}
            <Field label="Channel">
              <Select
                value={channel}
                onChange={(e) => {
                  savedMessages.current.set(draftKey, {
                    message,
                    subject,
                    draftType,
                  });
                  editRevision.current++;
                  const nextKey = lead
                    ? profileDraftKey(lead.id, lead.version, e.target.value)
                    : "";
                  const saved = savedMessages.current.get(nextKey);
                  setMessage(saved?.message || "");
                  setSubject(saved?.subject || "");
                  setDraftType(saved?.draftType || "");
                  setError("");
                  setChannel(e.target.value);
                }}
              >
                {["LinkedIn invite", "LinkedIn message", "Email", "Call"].map(
                  (s) => (
                    <option key={s}>{s}</option>
                  ),
                )}
              </Select>
            </Field>
            {channel !== "Call" && (
              <div className="draft-actions">
                <Button
                  variant="secondary"
                  busy={draftBusy}
                  disabled={
                    !ctx.integrations.geminiConfigured ||
                    draftingDisabled ||
                    busy
                  }
                  onClick={() => void draft(true)}
                >
                  <Sparkles size={16} />
                  {message ? "Regenerate draft" : "Draft with Gemini"}
                </Button>
                <Button
                  variant="ghost"
                  disabled={draftingDisabled || busy}
                  onClick={template}
                >
                  Use editable template
                </Button>
                {!ctx.integrations.geminiConfigured && (
                  <small>Add a Gemini key to enable AI drafting.</small>
                )}
              </div>
            )}
            {draftBusy && (
              <p className="draft-progress" role="status">
                <Sparkles size={15} />
                Gemini is preparing a draft from this person’s captured profile…
              </p>
            )}
            {channel === "Email" && (
              <Field label="Subject">
                <input
                  value={subject}
                  onChange={(e) => {
                    editRevision.current++;
                    setSubject(e.target.value);
                  }}
                  maxLength={250}
                />
              </Field>
            )}
            <Field label={channel === "Call" ? "Call notes" : "Your message"}>
              <textarea
                rows={9}
                value={message}
                maxLength={10000}
                onChange={(e) => {
                  editRevision.current++;
                  setMessage(e.target.value);
                  setDraftType("Edited by you");
                }}
                placeholder={
                  draftBusy
                    ? "Preparing your personalized draft…"
                    : channel === "Call"
                      ? "Add your call notes…"
                      : "Your profile-based draft appears here. You can edit every word."
                }
              />
            </Field>
            <div className="list-subbar">
              <small>
                {draftType ||
                  (draftBusy
                    ? "Preparing Gemini draft…"
                    : message
                      ? "Written by you"
                      : "")}
              </small>
              <small
                className={
                  channel === "LinkedIn invite" && message.length > 200
                    ? "overdue"
                    : ""
                }
              >
                {message.length} characters
                {channel === "LinkedIn invite" ? " · aim for 200 or fewer" : ""}
              </small>
            </div>
            <div className="actions outreach-links">
              <Button
                variant="secondary"
                disabled={!message || draftingDisabled}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(message);
                    ctx.notify("Message copied. Review it before sending.");
                  } catch {
                    ctx.notify(
                      "Clipboard access was unavailable. Select and copy the message manually.",
                      true,
                    );
                  }
                }}
              >
                <Copy size={15} />
                Copy message
              </Button>
              {lead.linkedInUrl && !outreachDisabled && (
                <External className="button secondary" href={lead.linkedInUrl}>
                  Open LinkedIn profile
                </External>
              )}
              {channel === "Email" && lead.email && !outreachDisabled && (
                <a
                  className="button secondary"
                  href={
                    "mailto:" +
                    encodeURIComponent(lead.email) +
                    "?subject=" +
                    encodeURIComponent(subject) +
                    "&body=" +
                    encodeURIComponent(
                      message +
                        "\n\nIf this isn’t relevant, reply “unsubscribe” and we’ll stop contacting you.",
                    )
                  }
                >
                  <Mail size={15} />
                  Open email draft
                </a>
              )}
            </div>
            <Field label="Next follow-up · India time (optional)">
              <input
                type="datetime-local"
                value={followup}
                onChange={(e) => setFollowup(e.target.value)}
              />
            </Field>
            <p className="small-note">
              Recording confirms that you have already sent the message or
              completed the call. Email drafts include an opt-out line; mark
              replies requesting no contact on the Details tab.
            </p>
            <Button
              busy={busy}
              disabled={!message.trim() || outreachDisabled}
              onClick={record}
            >
              <CheckCircle2 size={16} />
              Record already-sent {channel === "Call" ? "call" : "message"}
            </Button>
          </div>
        )}
        {tab === "history" && (
          <div className="lead-history">
            {!history ? (
              <p className="muted">Loading recorded outreach…</p>
            ) : (
              <>
                <h3>Recorded outreach</h3>
                {history.outreach.length ? (
                  history.outreach.map((o) => (
                    <div className="history-note" key={o.id}>
                      <Badge>{o.channel}</Badge>
                      <small>{date(o.sentAt, true)}</small>
                      {o.subject && <strong>{o.subject}</strong>}
                      <p className="preserve-text">{o.message}</p>
                    </div>
                  ))
                ) : (
                  <p className="muted">No outreach recorded yet.</p>
                )}
              </>
            )}
          </div>
        )}
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
      </div>
      <div className="modal-footer">
        <div>
          {lead && editable && (
            <Button
              variant="ghost"
              className="danger-text"
              disabled={busy}
              onClick={async () => {
                if (
                  !confirm("Move this lead to trash? You can restore it later.")
                )
                  return;
                setBusy(true);
                try {
                  await del("/leads/" + lead.id);
                  await ctx.refresh();
                  ctx.notify("Lead moved to trash.");
                  onClose();
                } catch (e: any) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Trash2 size={15} />
              Move to trash
            </Button>
          )}
        </div>
        <div className="actions">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {tab === "details" && editable && (
            <Button type="submit" form="lead-form" busy={busy}>
              <Save size={15} />
              {lead ? "Save changes" : "Add lead"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
