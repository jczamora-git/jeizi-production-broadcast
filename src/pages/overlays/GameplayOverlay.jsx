import { useEffect, useState } from "react";
import { getCurrentOverlayData, getOverlaySettings } from "../../services/api";
import overlayMeta from "../../data/overlay-meta.json";
import gameplayBg from "../../game_ui/gameoverlay.png";
import { resolveAssetUrl } from "../../utils/assetUrl";
import WinIndicators from "../../components/overlay/WinIndicators";
import "../../styles/overlays/overlay-base.css";
import "../../styles/overlays/gameplay-overlay.css";

const getSeriesLength = (mode) => {
  const normalized = String(mode || "").toUpperCase();
  if (normalized === "BO3") return 2;
  if (normalized === "BO5") return 3;
  if (normalized === "BO7") return 4;
  return 1;
};

const formatBestOf = (mode) => {
  if (!mode) return "";
  const value = String(mode).toUpperCase().replace("BO", "");
  return `BEST OF ${value}`;
};

const formatMatchTitle = (title) => {
  if (!title) return "";
  const normalized = String(title).toUpperCase();
  if (normalized === "ELIMINATION") {
    return "ELIMINATION ROUND";
  }
  return normalized;
};

const formatCasterNames = (source) => {
  const raw =
    source?.caster_names ||
    source?.casters ||
    source?.casterNames ||
    source?.caster_name ||
    "";

  if (Array.isArray(raw)) {
    return raw
      .map((caster) =>
        typeof caster === "string"
          ? caster
          : caster?.name || caster?.alias || caster?.display_name || ""
      )
      .filter(Boolean)
      .join(" / ");
  }

  return String(raw || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .join(" / ");
};

function GameplayOverlay() {
  const [data, setData] = useState({
    match: null,
    blue_team: null,
    red_team: null,
    game: null,
    map: null,
  });
  const [isGameOverlayEnabled, setIsGameOverlayEnabled] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      try {
        const settings = await getOverlaySettings();
        if (!isMounted) {
          return;
        }
        setIsGameOverlayEnabled(settings?.game_overlay !== false);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setIsGameOverlayEnabled(true);
      }
    };

    loadSettings();
    const interval = setInterval(loadSettings, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const overlayData = await getCurrentOverlayData();
        if (isMounted) {
          setData(overlayData);
        }
      } catch (error) {
        if (isMounted) {
          setData({ match: null, blue_team: null, red_team: null, game: null, map: null });
        }
      }
    };

    loadData();
    const timer = setInterval(loadData, 1000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  if (!isGameOverlayEnabled) {
    return null;
  }

  const match = data.match || {};
  const blueTeam = data.overlay_blue_team || data.blue_team || {};
  const redTeam = data.overlay_red_team || data.red_team || {};
  const game = data.game || {};
  const map = data.map || {};
  const seriesTotal = getSeriesLength(match.mode);
  const overlayBlueTeamId = Number(data.overlay_blue_team_id || blueTeam.id || match.blue_team_id || 0);
  const overlayRedTeamId = Number(data.overlay_red_team_id || redTeam.id || match.red_team_id || 0);
  const blueScore =
    overlayBlueTeamId && overlayBlueTeamId === Number(match.red_team_id)
      ? match.red_score ?? 0
      : match.blue_score ?? 0;
  const redScore =
    overlayRedTeamId && overlayRedTeamId === Number(match.blue_team_id)
      ? match.blue_score ?? 0
      : match.red_score ?? 0;
  const matchGameText = `MATCH ${match.match_no || "-"} - GAME ${game.game_no || "-"}`;
  const resolvedBlueLogo = blueTeam.logo ? resolveAssetUrl(blueTeam.logo) : "";
  const resolvedRedLogo = redTeam.logo ? resolveAssetUrl(redTeam.logo) : "";
  const resolvedMapIcon = map.icon_path ? resolveAssetUrl(map.icon_path) : "";
  const casterText =
    formatCasterNames({
      ...match,
      casters: data.casters,
    }).toUpperCase() || "-";

  return (
    <div className="overlay-canvas overlay-stage gameplay-overlay">
      {resolvedBlueLogo ? (
        <img
          className="gameplay-team-logo gameplay-blue-logo"
          src={resolvedBlueLogo}
          alt={blueTeam.name || "Blue Team"}
          draggable="false"
        />
      ) : null}
      {resolvedRedLogo ? (
        <img
          className="gameplay-team-logo gameplay-red-logo"
          src={resolvedRedLogo}
          alt={redTeam.name || "Red Team"}
          draggable="false"
        />
      ) : null}
      <img className="overlay-frame" src={gameplayBg} alt="" draggable="false" />
      <div className="overlay-data-layer">
        <div className="overlay-text gameplay-blue-team-name">
          {String(blueTeam.name || "Blue").toUpperCase()}
        </div>
        <div className="overlay-text gameplay-red-team-name">
          {String(redTeam.name || "Red").toUpperCase()}
        </div>
        <div className="overlay-text gameplay-map-name">
          {String(map.name || "").toUpperCase()}
        </div>
        {/* <div className="overlay-text gameplay-match-title">
          {formatMatchTitle(match.title)}
        </div> */}
        {/* <div className="overlay-text gameplay-game-no">
          {`GAME ${game.game_no || "-"}`}
        </div> */}
        {resolvedMapIcon ? (
          <img
            className="gameplay-map-icon"
            src={resolvedMapIcon}
            alt={map.name || "Map"}
            draggable="false"
          />
        ) : null}
        <div className="gameplay-caster-name">{casterText}</div>
        <div className="gameplay-side-info">
          <div>{String(overlayMeta.tournamentName || "").toUpperCase()}</div>
          <div>{formatMatchTitle(match.title)}</div>
          <div>{matchGameText}</div>
          <div>{formatBestOf(match.mode)}</div>
          <div>
            PATCH{" "}
            <span className="gameplay-patch-highlight">
              {String(overlayMeta.patchVersion || "").toUpperCase()}
            </span>
          </div>
        </div>
        <WinIndicators
          className="gameplay-blue-indicators"
          total={seriesTotal}
          score={blueScore}
          side="blue"
          size={19}
          gap={0}
        />
        <WinIndicators
          className="gameplay-red-indicators"
          total={seriesTotal}
          score={redScore}
          side="red"
          size={19}
          gap={0}
        />
      </div>
    </div>
  );
}

export default GameplayOverlay;
