export type ProfileDraft = { subject: string; message: string };
const drafts = new Map<string, Promise<ProfileDraft>>();
export const profileDraftKey = (id: string, version: number, channel: string) =>
  `${id}:${version}:${channel}`;

// Cache only within this open app session. Reopening a lead does not consume
// another AI request; Regenerate explicitly starts a new one.
export function loadProfileDraft(
  key: string,
  generate: () => Promise<ProfileDraft>,
  regenerate = false,
) {
  const existing = drafts.get(key);
  if (existing && !regenerate) return existing;
  const pending = generate()
    .then((result) => {
      if (
        !result ||
        typeof result.message !== "string" ||
        !result.message.trim()
      )
        throw new Error("Gemini returned an empty draft. Please regenerate.");
      return {
        subject: typeof result.subject === "string" ? result.subject : "",
        message: result.message,
      };
    })
    .catch((error) => {
      if (drafts.get(key) === pending) drafts.delete(key);
      throw error;
    });
  drafts.set(key, pending);
  if (drafts.size > 100) drafts.delete(drafts.keys().next().value!);
  return pending;
}
