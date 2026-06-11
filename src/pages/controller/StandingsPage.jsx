import { useEffect, useMemo, useState } from "react";
import { getStandings } from "../../services/api";
import socket from "../../services/socket";
import { resolveAssetUrl } from "../../utils/assetUrl";

const formatTeamLabel = (team) =>
  team?.team_shortname || team?.shortname || team?.team_name || team?.name || "-";

const formatDate = (value) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

function StandingsPage() {
  const [standings, setStandings] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStandings = async () => {
    try {
      setError("");
      const data = await getStandings();
      setStandings(data?.standings || []);
      setRecentMatches(data?.recent_matches || []);
    } catch (err) {
      console.error("Failed to load standings", err);
      setError(err?.message || "Failed to load standings.");
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
      await loadStandings();
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
      loadStandings();
    };

    socket.on("matches:changed", refresh);
    socket.on("standings:changed", refresh);

    return () => {
      socket.off("matches:changed", refresh);
      socket.off("standings:changed", refresh);
    };
  }, []);

  const hasStandings = standings.length > 0;
  const hasRecentMatches = recentMatches.length > 0;

  const rows = useMemo(() => standings, [standings]);
  const matches = useMemo(() => recentMatches, [recentMatches]);

  return (
    <div className="controller-page standings-page">
      <div className="page-header">
        <div className="page-title-group">
          <h1>Tournament Standings</h1>
          <div className="page-subtitle">Track match records and recent results.</div>
        </div>
      </div>

      <section className="modern-card standings-card">
        <div className="panel-header">
          <h2>Standings</h2>
        </div>
        {loading ? (
          <div className="standings-empty">Loading standings...</div>
        ) : error ? (
          <div className="standings-empty standings-error">
            {error}
            <button type="button" className="button-secondary" onClick={loadStandings}>
              Retry
            </button>
          </div>
        ) : hasStandings ? (
          <div className="table-scroll">
            <table className="table-modern standings-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Team</th>
                  <th>Match Point</th>
                  <th>Match W-L</th>
                  <th>Net Game Win</th>
                  <th>Games W-L</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((team) => {
                  const teamLabel = formatTeamLabel(team);
                  const logoUrl = team?.team_logo ? resolveAssetUrl(team.team_logo) : "";

                  return (
                    <tr key={team.team_id}>
                      <td className="standings-rank">#{team.rank}</td>
                      <td>
                        <div className="standings-team">
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt={teamLabel}
                              className="standings-team-logo"
                              loading="lazy"
                            />
                          ) : (
                            <div className="standings-team-fallback" />
                          )}
                          <span>{teamLabel}</span>
                        </div>
                      </td>
                      <td>{team.match_points}</td>
                      <td>{team.match_wl}</td>
                      <td className={team.net_game_win >= 0 ? "net-win" : "net-loss"}>
                        {team.net_game_win}
                      </td>
                      <td>{team.games_wl}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="standings-empty">No finished matches yet.</div>
        )}
      </section>

      <section className="modern-card recent-matches-card">
        <div className="panel-header">
          <h2>Recent Matches</h2>
        </div>
        {loading ? (
          <div className="standings-empty">Loading recent matches...</div>
        ) : hasRecentMatches ? (
          <div className="recent-matches-grid">
            {matches.map((match) => {
              const blueLabel =
                match.blue_team_shortname || match.blue_team_name || "Blue";
              const redLabel = match.red_team_shortname || match.red_team_name || "Red";
              const blueLogo = match.blue_team_logo
                ? resolveAssetUrl(match.blue_team_logo)
                : "";
              const redLogo = match.red_team_logo
                ? resolveAssetUrl(match.red_team_logo)
                : "";
              const winnerId = match.winner_team_id;
              const isBlueWinner = Number(winnerId) === Number(match.blue_team_id);
              const isRedWinner = Number(winnerId) === Number(match.red_team_id);
              const dateLabel = formatDate(
                match.series_completed_at || match.updated_at || match.created_at
              );

              return (
                <article key={match.match_id} className="recent-match-card">
                  <div className="recent-match-meta">
                    <span>{dateLabel}</span>
                    <span className="recent-match-title">
                      {match.title || "Match"}
                    </span>
                  </div>
                  <div className="recent-match-mode">{match.mode || ""}</div>
                  <div className="recent-match-teams">
                    <div className={`recent-match-team${isBlueWinner ? " is-winner" : ""}`}>
                      {blueLogo ? (
                        <img
                          src={blueLogo}
                          alt={blueLabel}
                          className="recent-team-logo"
                          loading="lazy"
                        />
                      ) : (
                        <div className="recent-team-logo recent-team-fallback" />
                      )}
                      <span>{blueLabel}</span>
                      {isBlueWinner ? <span className="recent-match-badge">W</span> : null}
                    </div>
                    <div className="recent-match-score">
                      {match.blue_score} : {match.red_score}
                    </div>
                    <div className={`recent-match-team${isRedWinner ? " is-winner" : ""}`}>
                      {redLogo ? (
                        <img
                          src={redLogo}
                          alt={redLabel}
                          className="recent-team-logo"
                          loading="lazy"
                        />
                      ) : (
                        <div className="recent-team-logo recent-team-fallback" />
                      )}
                      <span>{redLabel}</span>
                      {isRedWinner ? <span className="recent-match-badge">W</span> : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="standings-empty">No recent matches yet.</div>
        )}
      </section>
    </div>
  );
}

export default StandingsPage;
