import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getMatches, getTeams } from "../../services/api";
import socket from "../../services/socket";

const FINISHED_STATUSES = ["finished", "done", "completed"];
const LIVE_STATUSES = ["live", "active", "ongoing"];
const UPCOMING_STATUSES = ["queued", "setup", "pending", "scheduled", "upcoming"];

function normalizeStatus(status) {
  return String(status || "").toLowerCase();
}

function isFinishedMatch(match) {
  return FINISHED_STATUSES.includes(normalizeStatus(match?.status));
}

function isLiveMatch(match) {
  return LIVE_STATUSES.includes(normalizeStatus(match?.status));
}

function isUpcomingMatch(match) {
  return UPCOMING_STATUSES.includes(normalizeStatus(match?.status));
}

function getMatchAccessRank(match) {
  if (isLiveMatch(match)) {
    return 0;
  }

  if (isFinishedMatch(match)) {
    return 2;
  }

  return 1;
}

function isSeriesComplete(match) {
  return Number(match?.series_completed) === 1;
}

function formatStatus(status) {
  const value = normalizeStatus(status);
  if (value === "active" || value === "ongoing") {
    return "LIVE";
  }
  if (FINISHED_STATUSES.includes(value)) {
    return "FINISHED";
  }
  return value.toUpperCase();
}

function getMatchActionLabel(status) {
  const value = normalizeStatus(status);
  if (LIVE_STATUSES.includes(value)) return "Manage";
  if (FINISHED_STATUSES.includes(value)) return "Review";
  if (UPCOMING_STATUSES.includes(value)) return "Prepare";
  return "Open";
}

function getOrderValue(value, fallback = 999999) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getTimeValue(value) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? time : 0;
}

function sortFinishedLatestFirst(a, b) {
  const seriesDiff = getTimeValue(b?.series_completed_at) - getTimeValue(a?.series_completed_at);
  if (seriesDiff !== 0) return seriesDiff;

  const updatedDiff = getTimeValue(b?.updated_at) - getTimeValue(a?.updated_at);
  if (updatedDiff !== 0) return updatedDiff;

  const createdDiff = getTimeValue(b?.created_at) - getTimeValue(a?.created_at);
  if (createdDiff !== 0) return createdDiff;

  const queueDiff = getOrderValue(b?.queue_order, -1) - getOrderValue(a?.queue_order, -1);
  if (queueDiff !== 0) return queueDiff;

  const matchNoDiff = getOrderValue(b?.match_no, -1) - getOrderValue(a?.match_no, -1);
  if (matchNoDiff !== 0) return matchNoDiff;

  return getOrderValue(b?.id, -1) - getOrderValue(a?.id, -1);
}

function sortByMatchOrder(a, b) {
  const queueA = getOrderValue(a?.queue_order);
  const queueB = getOrderValue(b?.queue_order);

  if (queueA !== queueB) return queueA - queueB;

  const matchNoA = getOrderValue(a?.match_no);
  const matchNoB = getOrderValue(b?.match_no);

  if (matchNoA !== matchNoB) return matchNoA - matchNoB;

  return getOrderValue(a?.id) - getOrderValue(b?.id);
}

function getTeamName(match, teamsById, side) {
  const matchName =
    match?.[`${side}_team_name`] ||
    match?.[`${side}_name`] ||
    match?.[`${side}_team`] ||
    match?.[`${side}_team_shortname`];
  if (matchName) {
    return matchName;
  }

  const teamId = Number(match?.[`${side}_team_id`]);
  const team = teamsById.get(teamId);
  return (
    team?.shortname ||
    team?.short_name ||
    team?.abbr ||
    team?.abbrev ||
    team?.name ||
    "-"
  );
}

function MatchAccessBar() {
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const trackRef = useRef(null);
  const location = useLocation();

  const loadData = useCallback(async () => {
    try {
      const [matchData, teamData] = await Promise.all([getMatches(), getTeams()]);
      setMatches(matchData || []);
      setTeams(teamData || []);
    } catch (error) {
      setMatches([]);
      setTeams([]);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleMatchChange = () => {
      loadData();
    };

    socket.on("matches:changed", handleMatchChange);
    return () => {
      socket.off("matches:changed", handleMatchChange);
    };
  }, [loadData]);

  const teamsById = useMemo(() => {
    const map = new Map();
    teams.forEach((team) => {
      map.set(Number(team.id), team);
    });
    return map;
  }, [teams]);

  const finishedMatches = useMemo(() => {
    return [...matches]
      .filter((match) => isFinishedMatch(match) || isSeriesComplete(match))
      .sort(sortFinishedLatestFirst)
      .slice(0, 3);
  }, [matches]);

  const prioritizedMatches = useMemo(() => {
    return [...matches]
      .filter((match) => !isFinishedMatch(match) && !isSeriesComplete(match))
      .sort((left, right) => {
        const rankDiff = getMatchAccessRank(left) - getMatchAccessRank(right);
        if (rankDiff !== 0) {
          return rankDiff;
        }

        return sortByMatchOrder(left, right);
      });
  }, [matches]);

  const visibleMatches = useMemo(() => {
    const combined = prioritizedMatches.length
      ? [...prioritizedMatches, ...finishedMatches]
      : finishedMatches;

    return combined.filter(
      (match, index, array) =>
        array.findIndex((item) => Number(item.id) === Number(match.id)) === index
    );
  }, [finishedMatches, prioritizedMatches]);

  useEffect(() => {
    if (trackRef.current) {
      trackRef.current.scrollLeft = 0;
    }
  }, [visibleMatches, location.pathname, location.search]);

  const scrollByCard = (direction) => {
    if (!trackRef.current) return;
    const amount =
      trackRef.current.clientWidth < 700 ? trackRef.current.clientWidth * 0.92 : 320;
    trackRef.current.scrollBy({ left: direction * amount, behavior: "smooth" });
  };

  const scrollLeft = () => scrollByCard(-1);
  const scrollRight = () => scrollByCard(1);

  return (
    <div className="match-strip">
      <button
        type="button"
        className="match-strip-arrow match-strip-arrow-left"
        onClick={scrollLeft}
        aria-label="Scroll matches left"
      >
        ‹
      </button>

      <div className="match-strip-track" ref={trackRef}>
        {visibleMatches.length === 0 ? (
          <Link
            className="match-strip-card match-strip-schedule"
            to="/config/matches"
          >
            <div className="match-strip-schedule-icon">▦</div>
            <strong>No matches queued</strong>
            <span>Create or manage matches</span>
          </Link>
        ) : (
          visibleMatches.map((match) => {
            const blueName = getTeamName(match, teamsById, "blue");
            const redName = getTeamName(match, teamsById, "red");
            const matchNo = match?.match_no || match?.id || "-";
            const title = match?.title || "";
            const mode = match?.mode || "BO1";
            const scoreText = `${match?.blue_score ?? 0} - ${match?.red_score ?? 0}`;

            return (
              <Link
                key={match.id}
                to={`/config/matches?matchId=${match.id}&open=games`}
                className={[
                  "match-strip-card",
                  isLiveMatch(match) ? "is-live" : "",
                  isFinishedMatch(match) ? "is-finished" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="match-strip-top">
                  <span className="match-strip-status">{formatStatus(match.status)}</span>
                  <span className="match-strip-mode">{mode}</span>
                </div>

                <strong className="match-strip-title">
                  Match #{matchNo} {title}
                </strong>

                <div className="match-strip-teams">
                  <span>{blueName}</span>
                  <span className="match-strip-vs">vs</span>
                  <span>{redName}</span>
                </div>

                <div className="match-strip-bottom">
                  <span className="match-strip-score">{scoreText}</span>
                  <span className="match-strip-action">
                    {isSeriesComplete(match)
                      ? "Series Complete"
                      : getMatchActionLabel(match.status)}
                  </span>
                </div>
              </Link>
            );
          })
        )}

        <Link to="/config/matches" className="match-strip-card match-strip-schedule">
          <div className="match-strip-schedule-icon">▦</div>
          <strong>View Full Schedule</strong>
          <span>Manage matches, games, and casters</span>
        </Link>
      </div>

      <button
        type="button"
        className="match-strip-arrow match-strip-arrow-right"
        onClick={scrollRight}
        aria-label="Scroll matches right"
      >
        ›
      </button>
    </div>
  );
}

export default MatchAccessBar;
