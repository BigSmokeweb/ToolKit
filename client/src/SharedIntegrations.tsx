import { useState } from "react";
import {
  CheckCircle2,
  Download,
  Linkedin,
  MousePointerClick,
  Sparkles,
} from "lucide-react";
import type { Context } from "./App";
import { post } from "./lib";
import { Badge, Button } from "./components";

export default function SharedIntegrations({ ctx }: { ctx: Context }) {
  const [busy, setBusy] = useState(false);
  const linkedInConnected =
    !!ctx.integrations.linkedin && !ctx.integrations.linkedin.expired;
  async function testGemini() {
    setBusy(true);
    try {
      await post("/ai/test");
      ctx.notify("Gemini connection successful.");
      await ctx.refresh();
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
          <div className="eyebrow">YOUR TOOLS</div>
          <h1>
            Integrations<span className="heading-dot">.</span>
          </h1>
          <p>Connected services for discovery, capture and outreach drafts.</p>
        </div>
      </div>
      <div className="integration-overview">
        <section className="panel service-card">
          <header className="service-card-header">
            <span className="service-symbol gemini">
              <Sparkles size={24} />
            </span>
            <div>
              <h2>Gemini AI</h2>
              <p>Search and writing assistance</p>
            </div>
            <Badge
              tone={ctx.integrations.geminiConfigured ? "green" : "neutral"}
            >
              {ctx.integrations.geminiConfigured
                ? "Configured"
                : "Not configured"}
            </Badge>
          </header>
          <div className="service-card-body">
            <p>
              Build search fields, extract profile details and prepare
              personalized message drafts.
            </p>
            <div className="service-features">
              <span>Search builder</span>
              <span>Profile extraction</span>
              <span>Message drafts</span>
            </div>
            <Button
              variant="secondary"
              busy={busy}
              disabled={!ctx.integrations.geminiConfigured}
              onClick={testGemini}
            >
              <CheckCircle2 size={16} />
              Test connection
            </Button>
          </div>
        </section>
        <section className="panel service-card">
          <header className="service-card-header">
            <span className="service-symbol linkedin">
              <Linkedin size={24} />
            </span>
            <div>
              <h2>LinkedIn</h2>
              <p>Connected account</p>
            </div>
            <Badge tone={linkedInConnected ? "green" : "neutral"}>
              {linkedInConnected ? "Connected" : "Not connected"}
            </Badge>
          </header>
          <div className="service-card-body">
            <div className="service-account">
              <span className="service-account-dot" />
              <div>
                <strong>
                  {linkedInConnected
                    ? ctx.integrations.linkedin!.name
                    : "No connected account"}
                </strong>
                <small>
                  {linkedInConnected
                    ? "Account identity connected"
                    : "Configure the connection in the local app"}
                </small>
              </div>
            </div>
            <p>
              People searches open in your browser. Use Lead Desk Capture to
              bring displayed results into your pipeline.
            </p>
          </div>
        </section>
        <section className="panel service-card capture-service">
          <header className="service-card-header">
            <span className="service-symbol capture">
              <MousePointerClick size={24} />
            </span>
            <div>
              <h2>Lead Desk Capture</h2>
              <p>People results to pipeline in one click</p>
            </div>
            <Badge tone="green">Chrome & Edge</Badge>
          </header>
          <div className="service-card-body">
            <ol className="capture-workflow">
              <li>
                <strong>Open People results</strong>
                <span>Run a search in LinkedIn.</span>
              </li>
              <li>
                <strong>Click the LD icon</strong>
                <span>Add the displayed people together.</span>
              </li>
              <li>
                <strong>Review in your pipeline</strong>
                <span>Duplicates are skipped. CSV download is optional.</span>
              </li>
            </ol>
            <div className="service-card-actions">
              <a
                className="button secondary"
                href="/downloads/lead-desk-capture.zip"
                download
              >
                <Download size={16} />
                Download extension
              </a>
              <details className="capture-install">
                <summary>Installation and pairing</summary>
                <p>
                  Extract the ZIP. Open chrome://extensions or
                  edge://extensions, enable Developer mode, choose Load unpacked
                  and select the extracted folder. Enter this app’s URL in
                  extension settings and use a pairing code from the local
                  showcase controls. Existing installations only need Reload;
                  pairing is preserved.
                </p>
                <p>
                  For per-person hover buttons, right-click an empty part of a
                  People results page and choose “Show Lead Desk hover / Add all
                  buttons.”
                </p>
              </details>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
