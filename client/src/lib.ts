import Papa from "papaparse";
import type { Criteria, Lead, LeadInput } from "./types";
export const STAGES = [
  "New",
  "Qualified",
  "Contacted",
  "Replied",
  "Meeting",
  "Won",
  "Lost",
];
export const SIGNALS = [
  "None",
  "Asked for help",
  "Closing or exiting",
  "Raised funding",
  "Hiring",
  "New company",
  "Posted on topic",
];
export const CHECKS = [
  ["identity", "Identity matches the profile", 25],
  ["role", "Current role confirmed", 20],
  ["company", "Company record checked", 20],
  ["contact", "Contact details verified", 15],
  ["signal", "Buying signal supported by a source", 20],
] as const;
export const emptyCriteria: Criteria = {
  titles: "",
  keywords: "",
  phrases: "",
  jobs: "",
  city: "India",
  network: "",
  time: "week",
  companyType: "",
  size: "",
  exclude: "",
  removeSeekers: true,
  removeSellers: true,
  categoryId: "dpdp",
};
export const emptyLead: LeadInput = {
  name: "",
  title: "",
  company: "",
  city: "",
  linkedInUrl: "",
  email: "",
  categoryId: "dpdp",
  signal: "None",
  evidence: "",
  source: "Manual entry",
  sourceUrl: "",
  notes: "",
  stage: "New",
  ownerId: "",
  followUpAt: null,
  approved: false,
  doNotContact: false,
  isSample: false,
  version: 0,
  checks: {},
};
export function toInput(l: Lead): LeadInput {
  return {
    ...l,
    checks: Object.fromEntries(l.checks.map((c) => [c.kind, c.verified])),
  };
}
export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const r = await fetch("/api" + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Lead-Desk": "1",
      ...options.headers,
    },
    credentials: "same-origin",
  });
  let data: any;
  try {
    data = await r.json();
  } catch {
    throw new Error(
      r.status === 429
        ? "Too many requests. Please wait a moment."
        : "The server did not return a valid response. Check that it is running.",
    );
  }
  if (!r.ok) {
    throw new Error(
      data.error || data.title || "The request could not be completed.",
    );
  }
  return data;
}
export const post = <T = any>(path: string, body: unknown = {}) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const put = <T = any>(path: string, body: unknown) =>
  api<T>(path, { method: "PUT", body: JSON.stringify(body) });
export const del = (path: string) => api(path, { method: "DELETE" });
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
export const band = (score: number) =>
  score >= 70 ? "Hot" : score >= 40 ? "Warm" : "Cold";
export const date = (s: string | null, withTime = false) =>
  s
    ? new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
        ...(withTime
          ? { hour: "numeric", minute: "2-digit" }
          : { year: "numeric" }),
      }).format(new Date(s))
    : "Not scheduled";
export const due = (l: Lead) =>
  !!l.followUpAt &&
  new Date(l.followUpAt).getTime() <= Date.now() &&
  !["Won", "Lost"].includes(l.stage);
export function localDateTime(s: string | null) {
  if (!s) return "";
  return new Date(new Date(s).getTime() + 5.5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);
}
export function followUpUtc(value: string) {
  return value ? new Date(value + ":00+05:30").toISOString() : null;
}
export function safeUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" ? u.href : undefined;
  } catch {
    return undefined;
  }
}
const normalized = (s: string) => s.replace(/[^a-z0-9]/gi, "").toLowerCase();
export const CSV_FIELDS = [
  ["name", "Full name"],
  ["firstName", "First name"],
  ["lastName", "Last name"],
  ["title", "Job title"],
  ["company", "Company"],
  ["city", "City"],
  ["linkedInUrl", "LinkedIn URL"],
  ["email", "Email"],
  ["sourceUrl", "Source URL"],
  ["notes", "Notes"],
] as const;
export const ALIASES: Record<string, string[]> = {
  name: ["name", "fullname", "contactname"],
  firstName: ["firstname", "givenname"],
  lastName: ["lastname", "surname", "familyname"],
  title: ["jobtitle", "title", "position", "headline"],
  company: ["company", "companyname", "organization"],
  city: ["city", "location"],
  linkedInUrl: [
    "linkedinurl",
    "linkedinprofile",
    "linkedinprofileurl",
    "profileurl",
    "url",
  ],
  email: ["email", "emailaddress", "businessemail"],
  sourceUrl: ["sourceurl"],
  notes: ["notes"],
};
export function parseCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const header = lines.findIndex((l) =>
    /^\s*"?(first name|name|full name)"?[,;\t]/i.test(l),
  );
  const result = Papa.parse<Record<string, string>>(
    header > 0 ? lines.slice(header).join("\n") : text,
    {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
    },
  );
  if (result.errors.some((e) => e.type === "Quotes"))
    throw new Error(
      "This CSV has unmatched quotes. Export it again and retry.",
    );
  const headers = result.meta.fields || [];
  if (headers.length < 2 || !result.data.length)
    throw new Error(
      "No lead rows were found. Choose a CSV with column headers.",
    );
  if (result.data.length > 500)
    throw new Error("Please split the file into batches of at most 500 leads.");
  const mapping: Record<string, string> = {};
  for (const [key, aliases] of Object.entries(ALIASES))
    mapping[key] = headers.find((h) => aliases.includes(normalized(h))) || "";
  return { headers, rows: result.data, mapping };
}
export function mapCsv(
  rows: Record<string, string>[],
  mapping: Record<string, string>,
  categoryId: string,
  source: string,
): LeadInput[] {
  return rows.map((r) => {
    const get = (key: string) => (r[mapping[key]] || "").trim();
    return {
      ...emptyLead,
      name:
        get("name") ||
        [get("firstName"), get("lastName")].filter(Boolean).join(" "),
      title: get("title"),
      company: get("company"),
      city: get("city"),
      linkedInUrl: get("linkedInUrl"),
      email: get("email"),
      sourceUrl: get("sourceUrl"),
      notes: get("notes"),
      categoryId,
      source,
      checks: {},
    };
  });
}
