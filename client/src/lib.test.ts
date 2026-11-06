import { describe, it, expect } from "vitest";
import {
  parseCsv,
  mapCsv,
  safeUrl,
  band,
  emptyLead,
  toInput,
  localDateTime,
  followUpUtc,
} from "./lib";
describe("CSV ingestion", () => {
  it("imports the browser capture CSV headings without manual mapping", () => {
    const csv='\uFEFF"Name","Job title","Company","City","LinkedIn URL","Source URL","Notes"\r\n"Asha Test","Website Developer","","Mumbai, India","https://www.linkedin.com/in/asha","https://www.linkedin.com/search/results/people/","Displayed result\nPast: Developer at Example Company"';
    const parsed=parseCsv(csv);const [row]=mapCsv(parsed.rows,parsed.mapping,"general","Lead Desk capture CSV");
    expect(row.name).toBe("Asha Test");expect(row.title).toBe("Website Developer");expect(row.city).toBe("Mumbai, India");expect(row.linkedInUrl).toBe("https://www.linkedin.com/in/asha");expect(row.sourceUrl).toBe("https://www.linkedin.com/search/results/people/");expect(row.notes).toContain("Past: Developer");expect(row.email).toBe("");expect(row.approved).toBe(false);expect(row.signal).toBe("None");
  });
  it("reads LinkedIn exports including their introductory notes", () => {
    const text =
      "Notes:\nExport of connections\n\nFirst Name,Last Name,URL,Email Address,Company,Position,Connected On\nJane,Doe,https://www.linkedin.com/in/jane,,Acme,Founder,01 Nov 2026";
    const r = parseCsv(text);
    const rows = mapCsv(r.rows, r.mapping, "dpdp", "LinkedIn export");
    expect(rows[0].name).toBe("Jane Doe");
    expect(rows[0].title).toBe("Founder");
    expect(rows[0].linkedInUrl).toBe("https://www.linkedin.com/in/jane");
    expect(rows[0].approved).toBe(false);
  });
  it("handles quoted commas and multiline notes", () => {
    const r = parseCsv(
      'Name,Company,Notes\r\n"Jane Doe","Acme, Ltd","Met at event\nFollow up next week"',
    );
    const [row] = mapCsv(r.rows, r.mapping, "dpdp", "CSV");
    expect(row.company).toBe("Acme, Ltd");
    expect(row.notes).toContain("\n");
  });
  it("does not fabricate missing contact data", () => {
    const r = parseCsv("Name,Company\nJane Doe,Acme");
    const [row] = mapCsv(r.rows, r.mapping, "dpdp", "CSV");
    expect(row.email).toBe("");
    expect(row.linkedInUrl).toBe("");
    expect(row.signal).toBe("None");
  });
  it("recognizes common Sales Navigator headings", () => {
    const r = parseCsv(
      "full_name,job_title,company_name,linkedin_profile_url,email\nJane Doe,CTO,Acme,https://www.linkedin.com/in/jane,jane@example.test",
    );
    expect(r.mapping.name).toBe("full_name");
    expect(r.mapping.linkedInUrl).toBe("linkedin_profile_url");
  });
  it("rejects malformed and empty inputs", () => {
    expect(() => parseCsv("not a csv")).toThrow();
    expect(() => parseCsv('Name,Company\n"unclosed,Company')).toThrow();
  });
  it("enforces a bounded import size", () => {
    expect(() =>
      parseCsv(
        "Name,Company\n" +
          Array.from({ length: 501 }, (_, i) => `Person ${i},Acme`).join("\n"),
      ),
    ).toThrow("500");
  });
});
describe("display and safe links", () => {
  it("only permits HTTPS external links", () => {
    expect(safeUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeUrl("https://www.linkedin.com/feed/")).toBe(
      "https://www.linkedin.com/feed/",
    );
  });
  it("uses correct priority boundaries", () => {
    expect([39, 40, 69, 70].map(band)).toEqual(["Cold", "Warm", "Warm", "Hot"]);
  });
});
describe("India follow-up times", () => {
  it("round-trips India input without relying on the execution host timezone", () => {
    const utc = followUpUtc("2026-11-05T10:30");
    expect(utc).toBe("2026-11-05T05:00:00.000Z");
    expect(localDateTime(utc)).toBe("2026-11-05T10:30");
  });
});
