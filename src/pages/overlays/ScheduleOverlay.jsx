import { useEffect, useMemo, useState } from "react";
import { getCurrentOverlayData, getSchedule } from "../../services/api";
import socket from "../../services/socket";
import { resolveAssetUrl } from "../../utils/assetUrl";
import "../../styles/overlays/overlay-base.css";
import "../../styles/overlays/schedule-overlay.css";

const UPCOMING_STATUSES = new Set(["queued", "setup", "pending", "prepared"]);
const LIVE_STATUSES = new Set(["live", "active", "ongoing"]);
const FINISHED_STATUSES = new Set(["finished", "done", "completed"]);
const VISIBLE_MATCH_LIMIT = 3;

const normalizeStatus = (status) => String(status || "").trim().toLowerCase();

const sortMatches = (matches) =>
  [...matches].sort((a, b) => {
    const queueDiff = Number(a?.queue_order ?? 999999) - Number(b?.queue_order ?? 999999);
    if (queueDiff !== 0) {
      return queueDiff;
    }

    const matchNoDiff = Number(a?.match_no ?? 999999) - Number(b?.match_no ?? 999999);
    if (matchNoDiff !== 0) {
      return matchNoDiff;
    }

    return Number(a?.id ?? 999999) - Number(b?.id ?? 999999);
  });

const flattenScheduleGroups = (groups) =>
  Array.isArray(groups)
    ? groups.flatMap((group) => (Array.isArray(group?.matches) ? group.matches : []))
    : [];

const getTeamLabel = (prefix, match) =>
  match?.[`${prefix}_team_shortname`] ||
  match?.[`${prefix}_team_short_name`] ||
  match?.[`${prefix}_team_name`] ||
  "-";

const getTeamLogoPath = (prefix, match) =>
  match?.[`${prefix}_team_logo`] ||
  match?.[`${prefix}_team_logo_url`] ||
  match?.[`${prefix}_team_image_url`] ||
  match?.[`${prefix}_team_image`] ||
  "";

const uniqueByMatchId = (matches) => {
  const seen = new Set();

  return matches.filter((match) => {
    const id = String(match?.id || "");
    if (!id || seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
};

const getVisibleMatches = (matches) => {
  const sortedMatches = sortMatches(matches);
  const upcomingMatches = sortedMatches.filter((match) =>
    UPCOMING_STATUSES.has(normalizeStatus(match?.status))
  );
  const liveMatch =
    sortedMatches.find((match) => LIVE_STATUSES.has(normalizeStatus(match?.status))) || null;
  const combined = liveMatch ? [liveMatch, ...upcomingMatches] : upcomingMatches;
  return uniqueByMatchId(combined).slice(0, VISIBLE_MATCH_LIMIT);
};

function ScheduleOverlay() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentOverlayData, setCurrentOverlayData] = useState({ match: null, game: null });

  const loadSchedule = async () => {
    try {
      const [scheduleData, overlayData] = await Promise.all([getSchedule(), getCurrentOverlayData()]);
      setGroups(Array.isArray(scheduleData?.groups) ? scheduleData.groups : []);
      setCurrentOverlayData({
        match: overlayData?.match || null,
        game: overlayData?.game || null,
      });
    } catch (error) {
      console.error("Failed to load schedule overlay data", error);
      setGroups([]);
      setCurrentOverlayData({ match: null, game: null });
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

  const visibleMatches = useMemo(() => {
    const matches = flattenScheduleGroups(groups);
    return getVisibleMatches(matches);
  }, [groups]);

  const liveMatchLabel = useMemo(() => {
    const matches = flattenScheduleGroups(groups);
    const liveMatch = sortMatches(matches).find((match) =>
      LIVE_STATUSES.has(normalizeStatus(match?.status))
    );

    if (!liveMatch) {
      return "NO LIVE MATCH";
    }

    const matchNo = liveMatch?.match_no || liveMatch?.id || "-";
    const liveGame = Array.isArray(liveMatch?.games)
      ? liveMatch.games.find((game) => LIVE_STATUSES.has(normalizeStatus(game?.status)))
      : null;
    const gameNo =
      liveGame?.game_no ||
      liveMatch?.current_game_no ||
      liveMatch?.live_game_no ||
      liveMatch?.game_no ||
      (Number(currentOverlayData?.match?.id) === Number(liveMatch?.id)
        ? currentOverlayData?.game?.game_no
        : null) ||
      "-";

    return `MATCH ${matchNo} / GAME ${gameNo}`;
  }, [currentOverlayData.game, currentOverlayData.match, groups]);

  return (
    <div className="overlay-page schedule-overlay-page">
      <div className="schedule-live-group">
        <div className="schedule-live-label">{loading ? "LOADING..." : liveMatchLabel}</div>
      </div>

      <div className="schedule-upcoming-group">
        <div className="schedule-match-stack">
          {loading ? (
            <div className="schedule-overlay-empty">Loading...</div>
          ) : visibleMatches.length ? (
            visibleMatches.map((match, index) => {
              const blueShortName = String(getTeamLabel("blue", match)).toUpperCase();
              const redShortName = String(getTeamLabel("red", match)).toUpperCase();
              const blueLogoPath = getTeamLogoPath("blue", match);
              const redLogoPath = getTeamLogoPath("red", match);
              const blueLogo = blueLogoPath ? resolveAssetUrl(blueLogoPath) : "";
              const redLogo = redLogoPath ? resolveAssetUrl(redLogoPath) : "";
              const isLiveMatch = LIVE_STATUSES.has(normalizeStatus(match?.status));
              const hasLiveMatch = visibleMatches.some((item) =>
                LIVE_STATUSES.has(normalizeStatus(item?.status))
              );
              const isFirstUpcomingFallback = !hasLiveMatch && index === 0;
              const matchLabel =
                isLiveMatch || isFirstUpcomingFallback
                  ? "NEXT MATCH"
                  : `MATCH ${match?.match_no || match?.id || "-"}`;

              return (
                <div className="schedule-match-card" key={match.id}>
                  <div className="schedule-team schedule-team-left">
                    {blueLogo ? (
                      <img
                        className="schedule-team-logo"
                        src={blueLogo}
                        alt=""
                        draggable="false"
                      />
                    ) : null}

                    <div className="schedule-team-code">{blueShortName}</div>
                  </div>

                  <div className="schedule-match-center">
                    <div className="schedule-match-label">{matchLabel}</div>
                    <div className="schedule-match-mode">
                      {String(match?.mode || "BO1").toUpperCase()}
                    </div>
                    <div className="schedule-match-vs">VS</div>
                  </div>

                  <div className="schedule-team schedule-team-right">
                    {redLogo ? (
                      <img
                        className="schedule-team-logo"
                        src={redLogo}
                        alt=""
                        draggable="false"
                      />
                    ) : null}

                    <div className="schedule-team-code">{redShortName}</div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="schedule-overlay-empty">NO UPCOMING MATCHES</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ScheduleOverlay;
