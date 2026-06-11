import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getCurrentMatch, getTeams } from "../../services/api";
import { resolveAssetUrl } from "../../utils/assetUrl";

const broadcastShortcuts = [
  { label: "Loading", route: "/overlay/loading" },
  { label: "Draft", route: "/overlay/draft" },
  { label: "Legacy Draft", route: "/overlay/legacy-draft" },
  { label: "Gameplay", route: "/overlay/gameplay" },
  { label: "Results", route: "/overlay/results" },
  { label: "Map Change", route: "/overlay/map-change" },
  { label: "Victory", route: "/overlay/victory" },
];

const controlLinks = [
  {
    title: "Match Queue",
    description: "Manage match order, games, and winners.",
    to: "/config/matches",
  },
  {
    title: "Draft Control",
    description: "Prepare picks and bans for the live match.",
    to: "/config/draft",
  },
  {
    title: "Overlay Links",
    description: "Open and copy OBS browser-source links.",
    to: "/config/overlays",
  },
  {
    title: "Assets",
    description: "Manage teams, heroes, maps, and casters.",
    to: "/config/teams",
  },
];

const overviewCards = [
  {
    title: "Teams",
    description: "Manage team branding, shortnames, and logos.",
    to: "/config/teams",
  },
  {
    title: "Matches",
    description: "Control match queue, games, scores, and casters.",
    to: "/config/matches",
  },
  {
    title: "Draft",
    description: "Manage live picks and bans.",
    to: "/config/draft",
  },
  {
    title: "Heroes",
    description: "Manage hero images and roles.",
    to: "/config/heroes",
  },
  {
    title: "Maps",
    description: "Manage battlefield maps and icons.",
    to: "/config/maps",
  },
  {
    title: "Casters",
    description: "Manage caster names.",
    to: "/config/casters",
  },
  {
    title: "Overlays",
    description: "Open OBS overlay links.",
    to: "/config/overlays",
  },
];

function formatCasterNames(match) {
  const rawCasters =
    match?.caster_names ||
    match?.casters ||
    match?.casterNames ||
    match?.caster_name ||
    match?.casterName;

  if (Array.isArray(rawCasters)) {
    return rawCasters
      .map((caster) =>
        typeof caster === "string"
          ? caster
          : caster?.name || caster?.alias || caster?.display_name || "",
      )
      .filter(Boolean)
      .join(" / ");
  }

  if (typeof rawCasters === "string") {
    return rawCasters;
  }

  return "";
}

function getMatchTeamName(match, side) {
  return (
    match?.[`${side}_team_name`] ||
    match?.[`${side}_name`] ||
    match?.[`${side}_team`] ||
    match?.[`${side}_team_shortname`] ||
    "-"
  );
}

function getStatusClass(status) {
  if (!status) return "status-badge status-queued";
  return `status-badge status-${String(status).toLowerCase()}`;
}

function openOverlay(route) {
  window.open(route, "_blank", "noopener,noreferrer");
}

function Dashboard() {
  const [currentMatch, setCurrentMatch] = useState(null);
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const [matchData, teamData] = await Promise.all([getCurrentMatch(), getTeams()]);
        if (isMounted) {
          setCurrentMatch(matchData);
          setTeams(teamData || []);
        }
      } catch (error) {
        if (isMounted) {
          setCurrentMatch(null);
          setTeams([]);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const casterLabel = formatCasterNames(currentMatch);
  const teamsById = useMemo(() => {
    const map = new Map();
    teams.forEach((team) => {
      map.set(Number(team.id), team);
    });
    return map;
  }, [teams]);
  const blueTeam = currentMatch
    ? teamsById.get(Number(currentMatch.blue_team_id))
    : null;
  const redTeam = currentMatch
    ? teamsById.get(Number(currentMatch.red_team_id))
    : null;
  const blueTeamName = blueTeam?.name || getMatchTeamName(currentMatch, "blue");
  const redTeamName = redTeam?.name || getMatchTeamName(currentMatch, "red");
  const blueLogo = blueTeam?.logo || blueTeam?.logo_path || blueTeam?.logo_url;
  const redLogo = redTeam?.logo || redTeam?.logo_path || redTeam?.logo_url;
  const hasMatch = Boolean(currentMatch);
  const hasCasters = Boolean(casterLabel);
  const hasTeams = teams.length > 0;

  return (
    <div className="controller-page dashboard-page">
      <section className="dashboard-hero modern-card">
        <div className="dashboard-hero-copy">
          <p className="dashboard-eyebrow">JEIZI OVERLAY V2</p>
          <h1>Jeizi Controller</h1>
          <p>
            Premium control room for match flow, assets, casters, and overlays.
          </p>
        </div>

        <div className="dashboard-hero-chips" aria-label="Dashboard system status">
          <span>Broadcast Ready</span>
          <span>1920x1080 Overlays</span>
          <span>OBS Browser Source</span>
        </div>
      </section>

      <section className="dashboard-schedule-strip modern-card">
        <div>
          <span className="dashboard-strip-label">Broadcast Schedule</span>
          <strong>CMO League Season 1</strong>
        </div>
        <div className="dashboard-date-pills">
          <span>May 24</span>
          <span>Stream Day</span>
          <span>1920×1080</span>
          <span>Setup</span>
          <span>Draft</span>
          <span>Gameplay</span>
          <span>Results</span>
        </div>
      </section>

      <section className="dashboard-game-day-grid">
        <div className="dashboard-main-column">
          <section className="dashboard-featured-match modern-card">
            <div className="dashboard-card-title-row">
              <div>
                <p className="dashboard-section-kicker">Live Queue Focus</p>
                <h2>Featured Match</h2>
              </div>
              {currentMatch?.status ? (
                <span className={getStatusClass(currentMatch.status)}>
                  {currentMatch.status}
                </span>
              ) : null}
            </div>

            {currentMatch ? (
              <div className="dashboard-current-match-body">
                <div className="current-match-title">
                  Match #{currentMatch.match_no || "-"} {currentMatch.title || "Untitled"}
                </div>

                <div className="dashboard-scoreboard">
                  <div className="dashboard-score-team">
                    {blueLogo ? (
                      <img
                        className="dashboard-score-logo"
                        src={resolveAssetUrl(blueLogo)}
                        alt={blueTeamName}
                      />
                    ) : (
                      <div className="dashboard-score-logo-fallback">
                        {blueTeamName?.[0] || "B"}
                      </div>
                    )}
                    <div className="dashboard-score-team-name">{blueTeamName}</div>
                  </div>

                  <div className="dashboard-score-center">
                    {currentMatch.blue_score ?? 0} - {currentMatch.red_score ?? 0}
                  </div>

                  <div className="dashboard-score-team is-red">
                    <div className="dashboard-score-team-name">{redTeamName}</div>
                    {redLogo ? (
                      <img
                        className="dashboard-score-logo"
                        src={resolveAssetUrl(redLogo)}
                        alt={redTeamName}
                      />
                    ) : (
                      <div className="dashboard-score-logo-fallback">
                        {redTeamName?.[0] || "R"}
                      </div>
                    )}
                  </div>
                </div>

                <div className="dashboard-match-meta">
                  <span>{currentMatch.title || "Untitled"}</span>
                  <span>{currentMatch.mode || "-"}</span>
                  <span>{currentMatch.status || "-"}</span>
                  <span>{casterLabel || "Casters TBD"}</span>
                </div>

                <div className="dashboard-button-row">
                  <Link className="button-primary" to="/config/matches">
                    Manage Match
                  </Link>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => openOverlay("/overlay/gameplay")}
                  >
                    Open Gameplay Overlay
                  </button>
                </div>
              </div>
            ) : (
              <div className="dashboard-empty-state">
                <div className="current-match-title">No active/live match.</div>
                <p className="muted">Go to Matches to load or start a match.</p>
                <div>
                  <Link className="button-primary" to="/config/matches">
                    Go to Matches
                  </Link>
                </div>
              </div>
            )}
          </section>

          <section className="dashboard-overlay-shortcuts modern-card">
            <div className="dashboard-card-title-row">
              <div>
                <p className="dashboard-section-kicker">Broadcast Links</p>
                <h2>Overlay Quick Links</h2>
              </div>
            </div>

            <div className="dashboard-overlay-grid">
              {broadcastShortcuts.map((shortcut) => (
                <div key={shortcut.route} className="dashboard-overlay-tile">
                  <strong>{shortcut.label}</strong>
                  <span>{shortcut.route}</span>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => openOverlay(shortcut.route)}
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="dashboard-side-column">
          <section className="dashboard-control-panel modern-card">
            <div className="dashboard-card-title-row">
              <div>
                <p className="dashboard-section-kicker">Control Room</p>
                <h2>Broadcast Control</h2>
              </div>
            </div>

            <div className="dashboard-link-list">
              {controlLinks.map((item) => (
                <Link key={item.to} className="dashboard-link-item" to={item.to}>
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="dashboard-checklist modern-card">
            <div className="dashboard-card-title-row">
              <div>
                <p className="dashboard-section-kicker">Production</p>
                <h2>Checklist</h2>
              </div>
            </div>

            <div className="dashboard-checklist-items">
              <div className={`dashboard-check-item${hasTeams ? " is-ready" : ""}`}>
                <span className="dashboard-check-dot" />
                Teams loaded
              </div>
              <div className={`dashboard-check-item${hasMatch ? " is-ready" : ""}`}>
                <span className="dashboard-check-dot" />
                Match selected
              </div>
              <div className={`dashboard-check-item${hasCasters ? " is-ready" : ""}`}>
                <span className="dashboard-check-dot" />
                Casters ready
              </div>
              <div className="dashboard-check-item is-ready">
                <span className="dashboard-check-dot" />
                OBS links ready
              </div>
              <div className="dashboard-check-item">
                <span className="dashboard-check-dot" />
                Game map assigned
              </div>
            </div>
          </section>
        </aside>
      </section>

      <section className="dashboard-section-stack">
        <div className="dashboard-card-title-row dashboard-card-title-row-tight">
          <div>
            <p className="dashboard-section-kicker">Config Overview</p>
            <h2>Control Areas</h2>
          </div>
        </div>

        <div className="dashboard-overview-grid">
          {overviewCards.map((card) => (
            <Link key={card.to} className="dashboard-overview-card" to={card.to}>
              <strong>{card.title}</strong>
              <p>{card.description}</p>
              <span className="dashboard-card-arrow">Open</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
