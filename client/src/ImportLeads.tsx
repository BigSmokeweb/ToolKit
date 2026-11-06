import { useState, useRef } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Plus,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import type { Context } from "./App";
import type { LeadInput } from "./types";
import { CSV_FIELDS, emptyLead, mapCsv, parseCsv, post } from "./lib";
import { Badge, Button, CheckLine, Field, Modal, Select } from "./components";
export default function ImportLeads({
  ctx,
  onClose,
}: {
  ctx: Context;
  onClose: () => void;
}) {
  const [tab, setTab] = useState("csv"),
    [category, setCategory] = useState("dpdp"),
    [text, setText] = useState(""),
    [fileName, setFileName] = useState(""),
    [parsed, setParsed] = useState<ReturnType<typeof parseCsv> | null>(null),
    [preview, setPreview] = useState<LeadInput[] | null>(null),
    [selected, setSelected] = useState<Set<number>>(new Set()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const review = (rows: LeadInput[]) => {
    setPreview(rows);
    setSelected(new Set(rows.map((_, i) => i)));
    setError("");
  };
  async function readFile(f: File) {
    setError("");
    setPreview(null);
    try {
      if (f.size > 2_000_000)
        throw new Error("Use a CSV file smaller than 2 MB.");
      setParsed(parseCsv(await f.text()));
      setFileName(f.name);
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function extract() {
    setBusy(true);
    setError("");
    try {
      const result = await post("/ai/extract-leads", { text });
      if (!result.leads?.length)
        throw new Error(
          "No identifiable people were found. Use a CSV or add a person manually.",
        );
      review(
        result.leads.map((r: any) => ({
          ...emptyLead,
          name: typeof r.name === "string" ? r.name : "",
          title: typeof r.title === "string" ? r.title : "",
          company: typeof r.company === "string" ? r.company : "",
          city: typeof r.city === "string" ? r.city : "",
          linkedInUrl: typeof r.linkedInUrl === "string" ? r.linkedInUrl : "",
          email: typeof r.email === "string" ? r.email : "",
          evidence: typeof r.evidence === "string" ? r.evidence : "",
          source: "Pasted text reviewed by staff",
          categoryId: category,
          checks: {},
        })),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function importRows() {
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      const result = await post(
        "/leads/import",
        preview.filter((_, i) => selected.has(i)),
      );
      await ctx.refresh();
      ctx.notify(
        `${result.imported} leads imported. ${result.duplicates} duplicates skipped. Review each lead before outreach.`,
      );
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      large
      title="Bring your leads together"
      subtitle="Import the details you already have. Review them before they enter your pipeline."
      onClose={onClose}
    >
      <div className="modal-body">
        <Field label="Service category">
          <Select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              if (preview)
                setPreview(
                  preview.map((r) => ({ ...r, categoryId: e.target.value })),
                );
            }}
          >
            {ctx.categories.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="tabs">
          <button
            className={tab === "csv" ? "active" : ""}
            onClick={() => {
              setTab("csv");
              setPreview(null);
              setError("");
            }}
          >
            <FileSpreadsheet size={16} />
            Upload CSV
          </button>
          <button
            className={tab === "paste" ? "active" : ""}
            onClick={() => {
              setTab("paste");
              setPreview(null);
              setError("");
            }}
          >
            <FileText size={16} />
            Paste text
          </button>
          <button
            onClick={() => {
              onClose();
              ctx.addLead();
            }}
          >
            <Plus size={16} />
            Add one person
          </button>
        </div>
        {!preview && tab === "csv" && (
          <>
            <input
              ref={file}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) =>
                e.target.files?.[0] && readFile(e.target.files[0])
              }
            />
            <button
              className="upload-zone"
              onClick={() => file.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                e.dataTransfer.files[0] && readFile(e.dataTransfer.files[0]);
              }}
            >
              <span className="empty-icon">
                <Upload size={26} />
              </span>
              <strong>{fileName || "Choose a CSV or drop it here"}</strong>
              <span>
                Lead Desk capture CSV, LinkedIn Connections.csv or your own export · 500 rows · 2 MB
                max
              </span>
              <small>
                Files are parsed in your browser. Nothing goes to an AI
                provider.
              </small>
            </button>
            {parsed && (
              <div className="mapping">
                <div className="panel-heading">
                  <h3>Match your columns</h3>
                  <Badge tone="green">{parsed.rows.length} rows found</Badge>
                </div>
                <p>
                  Use Full name, or both First name and Last name. Other fields
                  are optional.
                </p>
                <div className="form-grid three">
                  {CSV_FIELDS.map(([key, label]) => (
                    <Field label={label} key={key}>
                      <Select
                        value={parsed.mapping[key] || ""}
                        onChange={(e) =>
                          setParsed({
                            ...parsed,
                            mapping: {
                              ...parsed.mapping,
                              [key]: e.target.value,
                            },
                          })
                        }
                      >
                        <option value="">Skip this field</option>
                        {parsed.headers.map((h) => (
                          <option key={h}>{h}</option>
                        ))}
                      </Select>
                    </Field>
                  ))}
                </div>
                <Button
                  onClick={() => {
                    if (!parsed.mapping.name && !parsed.mapping.firstName) {
                      setError("Map a name column before continuing.");
                      return;
                    }
                    review(
                      mapCsv(
                        parsed.rows,
                        parsed.mapping,
                        category,
                        "CSV import: " + fileName,
                      ),
                    );
                  }}
                >
                  Review imported rows
                  <ArrowRight size={16} />
                </Button>
              </div>
            )}
          </>
        )}
        {!preview && tab === "paste" && (
          <div className="paste-panel">
            <p>
              Copy visible profile results, a post’s comments or a contact list.
              Gemini extracts only the details present in your text.
            </p>
            {!ctx.integrations.geminiConfigured && (
              <div className="info-box">
                <Sparkles size={18} />
                <span>
                  Text extraction needs a Gemini key. You can upload a CSV or
                  add a person manually now.
                </span>
              </div>
            )}
            <textarea
              rows={10}
              maxLength={35000}
              placeholder="Paste copied text here…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="list-subbar">
              <small>{text.length.toLocaleString()} / 35,000 characters</small>
              <Button
                busy={busy}
                disabled={!text.trim() || !ctx.integrations.geminiConfigured}
                onClick={extract}
              >
                <Sparkles size={16} />
                Extract for review
              </Button>
            </div>
            <p className="small-note">
              The pasted text is sent to Google Gemini only when you choose
              Extract. Check the data you share and your Google project’s
              data-use terms.
            </p>
          </div>
        )}
        {preview && (
          <div className="import-review">
            <div className="panel-heading">
              <div>
                <h3>Review before importing</h3>
                <p>
                  Correct details or deselect rows. Imported leads start
                  unapproved.
                </p>
              </div>
              <Button variant="ghost" onClick={() => setPreview(null)}>
                Back
              </Button>
            </div>
            <CheckLine
              checked={selected.size === preview.length}
              onChange={(v) =>
                setSelected(v ? new Set(preview.map((_, i) => i)) : new Set())
              }
            >
              Select all {preview.length} rows
            </CheckLine>
            <div className="table-scroll">
              <table className="import-table">
                <thead>
                  <tr>
                    <th>ADD</th>
                    <th>NAME</th>
                    <th>ROLE</th>
                    <th>COMPANY</th>
                    <th>EMAIL</th>
                    <th>LINKEDIN URL</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={"Import row " + (i + 1)}
                          checked={selected.has(i)}
                          onChange={(e) =>
                            setSelected((s) => {
                              const copy = new Set(s);
                              if (e.target.checked) copy.add(i);
                              else copy.delete(i);
                              return copy;
                            })
                          }
                        />
                      </td>
                      {(
                        [
                          "name",
                          "title",
                          "company",
                          "email",
                          "linkedInUrl",
                        ] as const
                      ).map((k) => (
                        <td key={k}>
                          <input
                            aria-label={`${k} row ${i + 1}`}
                            className={!r.name && k === "name" ? "invalid" : ""}
                            value={r[k]}
                            onChange={(e) =>
                              setPreview((prev) =>
                                prev!.map((x, j) =>
                                  j === i ? { ...x, [k]: e.target.value } : x,
                                ),
                              )
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="info-box">
              <CheckCircle2 size={18} />
              <span>
                Duplicates are skipped by LinkedIn URL, email, or matching name
                and company. New leads still need your verification.
              </span>
            </div>
          </div>
        )}
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
      </div>
      <div className="modal-footer">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        {preview && (
          <Button
            busy={busy}
            disabled={
              !selected.size ||
              preview.some((r, i) => selected.has(i) && !r.name.trim())
            }
            onClick={importRows}
          >
            Import {selected.size} {selected.size === 1 ? "lead" : "leads"}
            <ArrowRight size={16} />
          </Button>
        )}
      </div>
    </Modal>
  );
}
