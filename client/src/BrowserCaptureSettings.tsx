import { useEffect, useState } from "react";
import { Copy, Download, Link2, MousePointerClick, Unplug } from "lucide-react";
import type { Context } from "./App";
import { api, post, del, date } from "./lib";
import { Badge, Button } from "./components";
type CaptureStatus = {
  paired: boolean;
  extensionId: string | null;
  pairedAt: string | null;
};
export default function BrowserCaptureSettings({ ctx }: { ctx: Context }) {
  const [status, setStatus] = useState<CaptureStatus | null>(null),
    [code, setCode] = useState(""),
    [expires, setExpires] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = () =>
    api<CaptureStatus>("/browser-capture")
      .then(setStatus)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
    if (new URLSearchParams(location.search).get("setup") === "capture") {
      document
        .getElementById("browser-capture")
        ?.scrollIntoView({ block: "start" });
    }
  }, []);
  async function generate() {
    setBusy(true);
    setError("");
    try {
      const r = await post("/browser-capture/pairing-code");
      setCode(r.code);
      setExpires(r.expiresAt);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="panel integration-settings wide-panel"
      id="browser-capture"
    >
      <div className="panel-heading">
        <div className="integration-title">
          <span className="integration-icon">
            <MousePointerClick size={22} />
          </span>
          <div>
            <h2>Browser capture · one-click save</h2>
            <p>Bring selected LinkedIn text straight into your pipeline.</p>
          </div>
        </div>
        <Badge tone={status?.paired ? "green" : "neutral"}>
          {status?.paired ? "Extension paired" : "Setup once"}
        </Badge>
      </div>
      <div className="padding">
        <p className="muted">
          Select the person’s name, headline and relevant post in LinkedIn.
          Click the pinned LD icon or right-click → Save selected text to Lead
          Desk. Gemini suggests buyer/partner status and category; the app fills
          the fields, checks duplicates and saves an unapproved lead for review.
        </p>
        <ol className="capture-steps">
          <li>
            Download the extension ZIP and extract it. In Chrome, open{" "}
            <code>chrome://extensions</code> (Edge:{" "}
            <code>edge://extensions</code>), enable Developer mode, choose{" "}
            <strong>Load unpacked</strong> and select the extracted folder
            containing <code>manifest.json</code>.
          </li>
          <li>
            Generate a one-time code here. In the extension’s setup page, choose
            this local app’s address, paste the code and select{" "}
            <strong>Pair extension</strong>.
          </li>
          <li>
            Pin the LD icon. Open a LinkedIn profile or individual post, select
            the relevant text, then click LD to capture. Review the saved lead
            before any outreach.
          </li>
        </ol>
        <div className="actions">
          <a
            href="/downloads/lead-desk-capture.zip"
            className="button secondary"
            download
          >
            <Download size={15} />
            Download extension
          </a>
          <Button variant="secondary" busy={busy} onClick={generate}>
            <Link2 size={15} />
            Generate pairing code
          </Button>
          <Button variant="ghost" onClick={load}>
            Refresh status
          </Button>
          {status?.paired && (
            <Button
              variant="ghost"
              onClick={async () => {
                try {
                  await del("/browser-capture/pairing");
                  setCode("");
                  await load();
                  ctx.notify("Browser capture access revoked.");
                } catch (e: any) {
                  setError(e.message);
                }
              }}
            >
              <Unplug size={15} />
              Revoke access
            </Button>
          )}
        </div>
        {code && (
          <div className="pairing-code">
            <strong>
              One-time code · expires {date(expires, true)} India time
            </strong>
            <div className="callback-box">
              <code>{code}</code>
              <button
                className="icon-button"
                aria-label="Copy pairing code"
                onClick={() =>
                  navigator.clipboard
                    .writeText(code)
                    .then(() =>
                      ctx.notify(
                        "Pairing code copied. Paste it into the extension setup page.",
                      ),
                    )
                    .catch(() =>
                      ctx.notify("Select and copy the code manually.", true),
                    )
                }
              >
                <Copy size={16} />
              </button>
            </div>
            <small>
              Generating a new code invalidates the previous code. Keep this
              code out of chat and screenshots. Re-pairing replaces the previous
              extension connection.
            </small>
          </div>
        )}
        {status?.pairedAt && (
          <p className="small-note">
            Paired {date(status.pairedAt, true)} · Extension ID:{" "}
            {status.extensionId}
          </p>
        )}
        <p className="small-note">
          Capture is user-triggered and limited to selected text on LinkedIn
          profiles and individual posts. It does not read LinkedIn passwords or
          cookies, crawl your account, or send messages. The selected text is
          processed by your configured Gemini service. Keep the local app
          running.
        </p>
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
      </div>
    </section>
  );
}
