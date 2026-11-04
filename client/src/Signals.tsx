import { useState, useEffect } from "react";
import {
  Bookmark,
  Check,
  ExternalLink,
  Play,
  Radio,
  Search,
  Settings,
  Signal as SignalIcon,
  Sparkles,
} from "lucide-react";
import type { Context } from "./App";
import type { SavedSearch, Signal } from "./types";
import { api, post, date } from "./lib";
import { Badge, Button, Empty, External } from "./components";
export default function SignalsPage({ ctx }: { ctx: Context }) {
  const [searches, setSearches] = useState<SavedSearch[]>([]),
    [signals, setSignals] = useState<Signal[]>([]),
    [busy, setBusy] = useState(""),
    [filter, setFilter] = useState("new");
  async function refresh() {
    const [s, rows] = await Promise.all([
      api<SavedSearch[]>("/searches"),
      api<Signal[]>("/signals"),
    ]);
    setSearches(s);
    setSignals(rows);
  }
  useEffect(() => {
    refresh().catch((e) => ctx.notify(e.message, true));
  }, []);
  async function run(s: SavedSearch) {
    setBusy(s.id);
    try {
      const r = await post("/searches/" + s.id + "/run");
      await refresh();
      ctx.notify(`${r.found} new search results added for review.`);
    } catch (e: any) {
      ctx.notify(e.message, true);
      await refresh();
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">NOTICE THE MOMENT</div>
          <h1>
            A signal worth a look<span className="heading-dot">.</span>
          </h1>
          <p>
            Funding, hiring and new launches can open the door to a useful
            conversation.
          </p>
        </div>
        <Button variant="secondary" onClick={() => ctx.navigate("discover")}>
          <Bookmark size={16} />
          Manage saved searches
        </Button>
      </div>
      {!ctx.integrations.braveConfigured && (
        <section className="signal-setup">
          <span className="empty-icon">
            <Radio size={27} />
          </span>
          <div>
            <Badge tone="orange">SETUP NEEDED</Badge>
            <h2>Keep an eye on your market.</h2>
            <p>
              Add a Brave Search API key to collect public search results for
              your saved searches. Daily monitoring runs while this server is
              running. Every result stays unverified until your team reviews the
              source.
            </p>
            <Button onClick={() => ctx.navigate("settings")}>
              Set up signal monitoring
              <ArrowIcon />
            </Button>
          </div>
        </section>
      )}
      <div className="signals-layout">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Your watchlist</h2>
              <p>Searches saved by your team.</p>
            </div>
            <Badge>{searches.length}</Badge>
          </div>
          {!searches.length ? (
            <Empty
              icon={Bookmark}
              title="Save your first search"
              action={
                <Button
                  variant="secondary"
                  onClick={() => ctx.navigate("discover")}
                >
                  Find people
                </Button>
              }
            >
              Choose a category, shape the search and save it to start your
              watchlist.
            </Empty>
          ) : (
            searches.map((s) => (
              <div className="watch-row" key={s.id}>
                <div>
                  <strong>{s.name}</strong>
                  <small>
                    {s.monitor ? "Monitored daily" : "Run manually"} ·{" "}
                    {s.lastRunAt
                      ? "Last run " + date(s.lastRunAt, true)
                      : "Not run yet"}
                  </small>
                  {s.lastError && <p className="overdue">{s.lastError}</p>}
                </div>
                <Button
                  variant="ghost"
                  busy={busy === s.id}
                  disabled={!ctx.integrations.braveConfigured || !!busy}
                  onClick={() => run(s)}
                >
                  <Play size={14} />
                  Run
                </Button>
              </div>
            ))
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Public results to review</h2>
              <p>Signals are research leads, not verified buying intent.</p>
            </div>
            <div className="tabs compact">
              <button
                className={filter === "new" ? "active" : ""}
                onClick={() => setFilter("new")}
              >
                New
              </button>
              <button
                className={filter === "all" ? "active" : ""}
                onClick={() => setFilter("all")}
              >
                All
              </button>
            </div>
          </div>
          {!signals.filter((s) => filter === "all" || !s.reviewed).length ? (
            <Empty icon={Radio} title="A quieter moment">
              New results will appear here after a saved search runs. Review the
              source before adding a person.
            </Empty>
          ) : (
            <div className="signal-list">
              {signals
                .filter((s) => filter === "all" || !s.reviewed)
                .map((s) => (
                  <article key={s.id}>
                    <div className="signal-meta">
                      <Badge tone={s.reviewed ? "green" : "orange"}>
                        {s.reviewed ? "Reviewed" : "Unverified result"}
                      </Badge>
                      <small>{date(s.at)}</small>
                    </div>
                    <h3>
                      <External href={s.url}>{s.title}</External>
                    </h3>
                    <p>{s.snippet.replace(/<[^>]+>/g, "")}</p>
                    <div className="list-subbar">
                      <small>
                        {searches.find((x) => x.id === s.searchId)?.name}
                      </small>
                      {!s.reviewed && (
                        <button
                          className="text-button"
                          onClick={async () => {
                            try {
                              await post("/signals/" + s.id + "/review");
                              setSignals((v) =>
                                v.map((x) =>
                                  x.id === s.id ? { ...x, reviewed: true } : x,
                                ),
                              );
                            } catch (e: any) {
                              ctx.notify(e.message, true);
                            }
                          }}
                        >
                          <Check size={15} />
                          Mark reviewed
                        </button>
                      )}
                      <Button variant="ghost" onClick={ctx.addLead}>
                        Add a person
                      </Button>
                    </div>
                  </article>
                ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
function ArrowIcon() {
  return <ExternalLink size={15} />;
}
