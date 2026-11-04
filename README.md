# NoLegalPaisa Lead Desk

A working React + ASP.NET Core 10 application based on the supplied Claude artifact and implementation roadmap. Gemini is the AI provider. The app opens directly as one shared workspace, with no app login or password setup. New workspaces start with no real leads and no API keys.

## Test now

Open **http://127.0.0.1:5080** while the server is running. The dashboard opens immediately. There is no Lead Desk account to create. LinkedIn sign-in is only needed when you choose to use LinkedIn itself or connect its identity integration.

1. On Overview, choose **Explore sample leads** to try four explicitly fictional records, or add a real contact yourself. Samples cannot be contacted.
2. Open **Find people**, choose a service, and adjust roles, industries and location. **People → Open** launches LinkedIn. Sign into your personal LinkedIn account there if needed. This search workflow works without creating a developer app.
3. Add the person manually, or import **Connections.csv** through **Import CSV**. Imports provide column mapping, editable preview, per-row selection and duplicate detection.
4. Open a lead. Record its source, observed buying signal, verification checks and follow-up. Approve the lead after review. Follow-up dates and display times use **India time (Asia/Kolkata)**.
5. Use **Outreach → Use editable template**. Send messages yourself in LinkedIn or your email application. **Record already-sent message** saves history; it does not send anything.
6. Move leads between stages in the detail form, or drag cards between columns in Board view. Filter by owner, category, priority, credibility or due follow-up.
7. Add team members under **Settings → Team** to assign leads and follow-ups. Team entries are ownership records, not login accounts. Everyone using this app has access to the same workspace, settings and leads.

To restart from PowerShell:

```powershell
cd E:\NLP\lead-desk
.\scripts\Start-LeadDesk.ps1 -NoBuild
```

Omit `-NoBuild` after source changes. `scripts\Setup.ps1` installs a workspace-local official .NET 10 SDK if necessary and builds/starts the app. Node.js 22.12+ or 24+ and npm are required. This workspace already has the SDK at `E:\NLP\.tools\dotnet` and all app dependencies installed.

The server runs in the terminal until Ctrl+C. It binds only to loopback by default. Data survives restarts in `server/.data/leaddesk.db`; keep the complete `.data` directory private and backed up.

## One-click browser capture

The `extension/` folder contains a Manifest V3 extension for Chrome and Edge. It captures **only text explicitly selected by the user** on a LinkedIn profile or individual post. It does not crawl pages, read cookies/passwords, or send LinkedIn messages. It is independent of the LinkedIn OAuth identity connection.

1. Open **Settings → Integrations → Browser capture** in Lead Desk. Download the ZIP, or use this checkout's `extension` folder directly.
2. In Chrome open `chrome://extensions` (Edge: `edge://extensions`), enable Developer mode, choose **Load unpacked**, and select the folder containing `manifest.json`. Install in the browser where you will view LinkedIn.
3. Generate a one-time pairing code in Lead Desk. Paste it into the extension's setup page, choose `https://localhost:7443` (or the HTTP loopback fallback), and pair. The code expires after ten minutes and can be used only once. Generating another code invalidates the previous one. Keep the app running and its HTTPS certificate trusted.
4. Pin the LD toolbar icon. Select a person's name, headline/company, location and relevant post text, then click LD. Alternatively, right-click that selection and choose **Save selected text to Lead Desk**. A result tab shows progress and the saved lead.
5. Gemini suggests whether the person is a potential buyer, a professional partner or unclear, chooses a service category, and extracts fields supported by the selection. Source URL, evidence, fit score and an assessment are saved. Unknown contact details remain empty. Duplicates reopen the existing record. Newly captured leads are always **New**, **unapproved** and **unverified**. Review before outreach.

Pairing is stored server-side as an encrypted credential with a hashed token and extension ID. The extension stores its token in trusted local extension storage, separate from the Gemini key and LinkedIn token. **Revoke access** in Lead Desk immediately disables that token. Capture-specific routes require the paired token and extension ID; ordinary website origins are rejected. The selection is sent to your local server and then your configured Gemini provider only when you invoke capture. Temporary capture results use extension session storage.

`npm run build` packages eight whitelisted extension files into `client/public/downloads/lead-desk-capture.zip`, then Vite includes the ZIP in the app build. The generated ZIP is ignored by Git. No database, API key or runtime settings are packaged. The extension has been scoped to the two local demo addresses; hosted deployment requires a deliberate host-permission/configuration update.

Additional checks:

```powershell
node --test extension/capture.test.mjs
& E:\NLP\.tools\dotnet\dotnet.exe run --project tests/capture-checks/CaptureChecks.csproj
```

## Add Gemini later

1. Create a Gemini key in [Google AI Studio](https://aistudio.google.com/apikey). Check model access and your project's free-tier quota.
2. In **Settings → Integrations → Gemini AI**, enter the key. Save it, then choose **Test connection**.
3. The configurable default model is `gemini-3.1-flash-lite`. Change it if your project supports a different model with structured JSON output.
4. AI actions now support plain-language search building, extraction of explicit facts from pasted text, and reviewed outreach drafts.

No API key is placed in React, browser storage or exported CSVs. Secret inputs are cleared after saving. AI results are not silently imported or sent. The server reserves and logs each attempt, enforces a shared daily request limit and stores token usage without logging source prompts. Provider quotas still apply; a free key is not unlimited or guaranteed free in every configuration. Check Google's data-use terms before sending personal/confidential material through a free-tier project.

## Connect your personal LinkedIn account later

**You can already test LinkedIn search links without this connection.** OAuth links basic profile information for the member who authorizes it. The app requests only `openid profile email`. It does not request posting access or implement automated LinkedIn messaging/invites/search scraping.

1. Create an app in the [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps). LinkedIn may require a company-page association for the developer app; the member who signs into the app can still be your personal account.
2. Request **Sign In with LinkedIn using OpenID Connect** under Products.
3. Register the exact callback `https://localhost:7443/auth/linkedin/callback` under Auth for local testing.
4. Prepare trusted local HTTPS. In a terminal under your Windows account, run the official SDK's certificate trust command yourself and approve the Windows prompt only if appropriate:

```powershell
& E:\NLP\.tools\dotnet\dotnet.exe dev-certs https --trust
```

5. Stop the HTTP-only app with Ctrl+C. Restart it with:

```powershell
.\scripts\Start-LeadDesk.ps1 -Https -NoBuild
```

6. Open **https://localhost:7443**. Lead Desk opens directly. Do not bypass certificate warnings. If localhost is rejected by LinkedIn's app portal, use a properly configured HTTPS domain and register that exact callback instead.
7. In Settings, save Client ID, Client Secret and exact callback. Then choose **Connect my LinkedIn**, sign in on LinkedIn and approve the identity permissions.
8. On return, Settings shows the account name and expiration computed from LinkedIn's `expires_in`. Reconnect before it expires. Disconnect removes this app's local token; manage/revoke the provider grant separately in LinkedIn if desired.

Authorization code exchange is server-side. A random state value is bound to a protected, Secure, HttpOnly, SameSite=Lax cookie and expires after ten minutes. Forged/missing/expired state is rejected. The callback verifies the token by calling LinkedIn's `/v2/userinfo`; it does not trust an unverified decoded ID token. Tokens remain encrypted on the server.

Official references: [OAuth authorization-code flow](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow), [OpenID Connect](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2), [API access](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access). Ordinary sign-in access does not provide general people search or member direct messaging. A Sales Navigator subscription alone is not partner API access.

## Optional daily signals

Add a [Brave Search API](https://api-dashboard.search.brave.com/) key in Settings, then save discovery searches with **Monitor daily** checked. A background worker checks every 30 minutes and runs due searches at most once per 24 hours. It runs only while the server is running. Manual runs are available on Buying signals and are spaced by at least two minutes. Public results are deduplicated per saved search and labelled **Unverified result**. Staff review the original source before adding an actual person. Search queries, rather than your lead database, are sent to the provider.

## Data, permissions and safeguards

- Access: one shared workspace, without app authentication, session cookies, passwords or per-person access restrictions. The app remains bound to loopback by default. An internal workspace owner keeps existing lead ownership, audit history and integration records associated with a stable ID. Existing records are preserved.
- Mutations require a custom CSRF header and same-origin checks. Workspace routes open directly without authentication. Responses do not return password hashes, API keys or access tokens.
- Secrets use ASP.NET Data Protection. **The key ring is in `.data/keys`; protect it with operating-system access controls, together with the database.** On deployment configure key encryption with a certificate/key service appropriate to the host. Losing the key ring prevents decryption of saved integrations .
- Leads retain provenance, manual verification timestamps, owner, approval, do-not-contact, history and optimistic concurrency version. Duplicate checks use normalized LinkedIn URL, email, or name + company. Imported leads always start unapproved.
- Fit: seniority up to 40, signal up to 35, email 10, profile URL 5, target city 10. Hot ≥70, warm 40–69. Credibility is independently calculated from five human verification checks, totalling 100.
- Outreach recording requires approval, respects Do not contact, and enforces per-staff daily recorded-invitation limits. No messages are sent by the backend. Email drafts open the user's email client and contain an opt-out line. Automatic SMTP campaigns, DNS provisioning and deliverability management are not implemented.
- Configurable retention flags old records for manual archiving. Trash supports restore; administrator permanent deletion also removes related outreach, verification and lead-specific audit history. Generic deletion audit entries retain no lead identity. Database backups follow your organization's own retention/deletion process.
- CSV exports neutralize spreadsheet-formula prefixes. Profile/source links must be HTTPS. Links open with `noopener noreferrer`.
- Finalize your organization's privacy notice, permitted professional outreach approach, retention/opt-out procedures and review of applicable obligations before production outreach. This application does not certify legal compliance.

## MySQL, Docker and IIS

SQLite is the tested, zero-setup local default. The same data model supports MySQL using Oracle's EF Core provider. No MySQL instance was running on this PC during the initial build, so do not treat the MySQL/Docker/IIS deployment path as runtime-verified.

For an existing MySQL server, create a database and restricted app user. Copy `server/appsettings.Local.example.json` to `server/appsettings.Local.json` and enter a real connection string locally. That file is ignored. Environment variables such as `Database__Provider=MySql` and `Database__ConnectionString=...` override JSON configuration.

Alternatively, with Docker Desktop running:

```powershell
Copy-Item .env.example .env
# Edit .env and choose two unique, long passwords before continuing.
docker compose up --build -d
```

The compose configuration runs MySQL 8.4 plus the app, uses separate persistent volumes and publishes the app on loopback port 5080. It does not expose the MySQL port. Put the app behind trusted HTTPS before remote access. This build has no app access control; use an appropriate network or hosting access boundary if deploying beyond local testing. Set `AllowedHosts` to the actual hostnames and configure trusted reverse proxies appropriately. The application needs to see its real HTTPS scheme/origin for OAuth.

For IIS, publish the backend with the .NET 10 SDK, install Microsoft's ASP.NET Core Hosting Bundle, and copy the built `client/dist` to a `client/dist` folder alongside the `server` folder. Use an IIS site targeting `server`, give the app-pool identity access only to the app data/key directories, configure HTTPS, MySQL, hostnames and provider callbacks. Run the app pool persistently if scheduled signals are required.

Initial databases are created with EF `EnsureCreated`. **Automatic production schema upgrades are not implemented.** Before changing the model on a live deployment, introduce reviewed provider-specific EF migrations and a tested backup/restore procedure. Switching providers creates a separate database; it does not migrate existing SQLite leads to MySQL automatically. CSV handles basic lead portability but is not a complete database migration.

## Development and verification

```powershell
cd client
npm ci
npm test
npm run build

cd ..\server
& E:\NLP\.tools\dotnet\dotnet.exe build

cd ..
node scripts/api-tests.mjs
```

The API test runner starts an isolated database/server on port 5082, uses fictional contacts, makes no external provider calls, and removes its temporary database afterward. Do not run it against your live workspace. It currently checks open-workspace access, removed authentication routes, CSRF, scoring, duplicate detection, atomic import, concurrency, team ownership, secret handling, no-key AI behavior, OAuth validation, invitation limits, do-not-contact, saved searches, trash/restore, deletion and CSV export safety. Its result is saved in ignored `artifacts/api-test-result.json`.

For frontend development run the backend on 5080 and `npm run dev` in `client`; Vite proxies `/api` and `/auth`. Set `ASPNETCORE_ENVIRONMENT=Development` on the backend to permit the exact dev origin `http://127.0.0.1:5173`.

Structure: `client/src` contains screens, import handling and styles; `server/Program.cs` defines workspace endpoints; `Models.cs` the relational model; `DeskServices.cs` scoring, validation, discovery and settings; `Integrations.cs` Gemini, OAuth and signal monitoring. External provider success flows need real credentials and were not exercised during the initial no-key build.
