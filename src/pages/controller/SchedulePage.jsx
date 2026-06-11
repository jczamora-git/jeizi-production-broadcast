import { useEffect, useMemo, useState } from "react";
import { getSchedule } from "../../services/api";
import socket from "../../services/socket";
import { resolveAssetUrl } from "../../utils/assetUrl";

const FINISHED_STATUSES = ["finished", "done", "completed"];
const LIVE_STATUSES = ["live", "active", "ongoing"];

const normalizeStatus = (status) => String(status || "").toLowerCase();

const getTeamLabel = (prefix, match) =>
  match?.[`${prefix}_team_shortname`] ||
  match?.[`${prefix}_team_short_name`] ||
  match?.[`${prefix}_team_name`] ||
  "-";

const getWinnerSide = (match) => {
  const winnerId = Number(match?.series_winner_team_id || 0);
  if (winnerId && winnerId === Number(match?.blue_team_id)) {
    return "blue";
  }
  if (winnerId && winnerId === Number(match?.red_team_id)) {
    return "red";
  }

  const blueScore = Number(match?.blue_score || 0);
  const redScore = Number(match?.red_score || 0);
  if (blueScore > redScore) {
    return "blue";
  }
  if (redScore > blueScore) {
    return "red";
  }

  return "";
};

const getStatusBadges = (match) => {
  const badges = [];
  const status = normalizeStatus(match?.status);

  if (LIVE_STATUSES.includes(status)) {
    badges.push({ label: "Live", tone: "live" });
  } else if (FINISHED_STATUSES.includes(status)) {
    badges.push({ label: "Finished", tone: "finished" });
  } else if (status === "setup") {
    badges.push({ label: "Setup", tone: "setup" });
  } else if (status === "queued" || status === "pending") {
    badges.push({ label: "Queued", tone: "queued" });
  } else if (status) {
    badges.push({ label: status.toUpperCase(), tone: status });
  }

  if (Number(match?.series_completed) === 1) {
    badges.push({ label: "Series Complete", tone: "series-complete" });
  }

  return badges;
};

function SchedulePage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  const loadSchedule = async () => {
    try {
      setError("");
      const data = await getSchedule();
      setGroups(data?.groups || []);
    } catch (err) {
      console.error("Failed to load schedule", err);
      setError(err?.message || "Failed to load schedule.");
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!isMounted) {
        return;
      }
      await loadSchedule();
    };

    load();
    const interval = setInterval(load, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const refresh = () => {
      loadSchedule();
    };

    socket.on("matches:changed", refresh);

    return () => {
      socket.off("matches:changed", refresh);
    };
  }, []);

  const availableTabs = useMemo(() => {
    return ["All", ...groups.map((group) => group.title)];
  }, [groups]);

  const filteredGroups = useMemo(() => {
    if (activeFilter === "All") {
      return groups;
    }
    return groups.filter((group) => group.title === activeFilter);
  }, [activeFilter, groups]);

  const hasMatches = groups.some((group) => group.matches?.length > 0);

  return (
    <div className="controller-page controller-schedule-page">
      <div className="page-header controller-schedule-header">
        <div className="page-title-group">
          <h1>Schedule</h1>
          <div className="page-subtitle">
            View tournament matches grouped by stage/title.
          </div>
        </div>
      </div>

      <section className="modern-card controller-schedule-filter-card">
        <div
          className="controller-schedule-stage-tabs"
          role="tablist"
          aria-label="Schedule stages"
        >
          {availableTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`controller-schedule-stage-tab${
                activeFilter === tab ? " is-active" : ""
              }`}
              onClick={() => setActiveFilter(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <section className="modern-card controller-schedule-empty-state">
          Loading schedule...
        </section>
      ) : error ? (
        <section className="modern-card controller-schedule-empty-state controller-schedule-error-state">
          <span>{error}</span>
          <button type="button" className="button-secondary" onClick={loadSchedule}>
            Retry
          </button>
        </section>
      ) : !hasMatches ? (
        <section className="modern-card controller-schedule-empty-state">
          No matches scheduled yet.
        </section>
      ) : filteredGroups.length === 0 ? (
        <section className="modern-card controller-schedule-empty-state">
          No matches in this stage.
        </section>
      ) : (
        <div className="controller-schedule-stage-stack">
          {filteredGroups.map((group) => (
            <section
              key={group.title}
              className="modern-card controller-schedule-stage-section"
            >
              <div className="panel-header">
                <h2 className="controller-schedule-stage-title">{group.title}</h2>
              </div>

              {group.matches?.length ? (
                <div className="controller-schedule-grid">
                  {group.matches.map((match) => {
                    const blueLabel = getTeamLabel("blue", match);
                    const redLabel = getTeamLabel("red", match);
                    const blueLogo = match.blue_team_logo
                      ? resolveAssetUrl(match.blue_team_logo)
                      : "";
                    const redLogo = match.red_team_logo
                      ? resolveAssetUrl(match.red_team_logo)
                      : "";
                    const blueScore = Number(match.blue_score || 0);
                    const redScore = Number(match.red_score || 0);
                    const winnerSide = getWinnerSide(match);
                    const statusBadges = getStatusBadges(match);
                    const status = normalizeStatus(match.status);

                    return (
                      <article
                        key={match.id}
                        className={[
                          "controller-schedule-card",
                          LIVE_STATUSES.includes(status) ? "is-live" : "",
                          FINISHED_STATUSES.includes(status) ? "is-finished" : "",
                          Number(match.series_completed) === 1 ? "is-series-complete" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <div className="controller-schedule-card-topline">
                          <span className="controller-schedule-mode-pill">
                            {match.mode || "BO1"}
                          </span>
                          <div className="controller-schedule-badge-row">
                            {statusBadges.map((badge) => (
                              <span
                                key={`${match.id}-${badge.label}`}
                                className={`controller-schedule-status-badge is-${badge.tone}`}
                              >
                                {badge.label}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="controller-schedule-match-title">
                          Match #{match.match_no || match.id} {group.title}
                        </div>

                        <div className="controller-schedule-team-row">
                          <div
                            className={`controller-schedule-team controller-schedule-team-blue${
                              winnerSide === "blue" ? " is-winner" : ""
                            }`}
                          >
                            {blueLogo ? (
                              <img
                                src={blueLogo}
                                alt={blueLabel}
                                className="controller-schedule-team-logo"
                                loading="lazy"
                              />
                            ) : (
                              <div className="controller-schedule-team-logo controller-schedule-team-logo-fallback" />
                            )}
                            <span className="controller-schedule-team-shortname">{blueLabel}</span>
                            <span className="controller-schedule-score">{blueScore}</span>
                          </div>

                          <div className="controller-schedule-vs">VS</div>

                          <div
                            className={`controller-schedule-team controller-schedule-team-red${
                              winnerSide === "red" ? " is-winner" : ""
                            }`}
                          >
                            <span className="controller-schedule-score">{redScore}</span>
                            <span className="controller-schedule-team-shortname">{redLabel}</span>
                            {redLogo ? (
                              <img
                                src={redLogo}
                                alt={redLabel}
                                className="controller-schedule-team-logo"
                                loading="lazy"
                              />
                            ) : (
                              <div className="controller-schedule-team-logo controller-schedule-team-logo-fallback" />
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="controller-schedule-empty-inline">
                  No matches in this stage.
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export default SchedulePage;
