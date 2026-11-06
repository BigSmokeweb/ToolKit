import { describe, it, expect, vi } from "vitest";
import { loadProfileDraft, profileDraftKey } from "./profileDraft";
describe("profile draft requests", () => {
  it("reuses a pending or completed draft when a lead is reopened", async () => {
    const generate = vi.fn(async () => ({
      subject: "Hello",
      message: "Hi Asha, I noticed your web development work.",
    }));
    const key = profileDraftKey("dedupe", 1, "LinkedIn message");
    const first = loadProfileDraft(key, generate),
      second = loadProfileDraft(key, generate);
    expect(first).toBe(second);
    await first;
    await loadProfileDraft(key, generate);
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it("uses fresh context after a profile edit, channel change or explicit regeneration", async () => {
    const generate = vi.fn(async () => ({
      subject: "",
      message: "A real draft",
    }));
    await loadProfileDraft(
      profileDraftKey("context", 1, "LinkedIn message"),
      generate,
    );
    await loadProfileDraft(
      profileDraftKey("context", 2, "LinkedIn message"),
      generate,
    );
    await loadProfileDraft(profileDraftKey("context", 2, "Email"), generate);
    await loadProfileDraft(
      profileDraftKey("context", 2, "Email"),
      generate,
      true,
    );
    expect(generate).toHaveBeenCalledTimes(4);
  });
  it("allows retry after provider failure or an empty response", async () => {
    const key = profileDraftKey("retry", 1, "Email");
    await expect(
      loadProfileDraft(key, async () => {
        throw new Error("Unavailable");
      }),
    ).rejects.toThrow("Unavailable");
    await expect(
      loadProfileDraft(key, async () => ({ subject: "", message: "" })),
    ).rejects.toThrow("empty draft");
    expect(
      await loadProfileDraft(key, async () => ({
        subject: "",
        message: "Recovered",
      })),
    ).toEqual({ subject: "", message: "Recovered" });
  });
});
