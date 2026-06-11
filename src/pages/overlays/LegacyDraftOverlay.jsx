import { useEffect, useMemo, useState } from "react";
import { getCurrentOverlayData, getMaps } from "../../services/api";
import WinIndicators from "../../components/overlay/WinIndicators";
import banningBg from "../../game_ui/banning.png";
import { resolveAssetUrl } from "../../utils/assetUrl";
import "../../styles/overlays/overlay-base.css";
import "../../styles/overlays/legacy-draft-overlay.css";

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
  const normalized = String(title)
    .toUpperCase()
    .replace(/[_-]+/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized === "ELIMINATION" || normalized === "ELIMINATION ROUND") {
    return "ELIMINATION";
  }

  const isSemis = normalized.includes("SEMI") || normalized.includes("SEMIFINAL");
  if (isSemis && normalized.includes("UPPER")) {
    return "SEMIS-UPPER";
  }
  if (isSemis && normalized.includes("LOWER")) {
    return "SEMIS-LOWER";
  }

  return String(title).toUpperCase();
};

const getTeamLogo = (team) =>
  team?.logo_url ||
  team?.logo ||
  team?.image_url ||
  team?.image ||
  team?.team_logo_url ||
  team?.team_logo ||
  "";

const getMapImagePath = (map) => map?.map_image || map?.image || map?.icon_path || "";

function LegacyDraftOverlay() {
  const [data, setData] = useState({
    match: null,
    blue_team: null,
    red_team: null,
    game: null,
    map: null,
  });
  const [maps, setMaps] = useState([]);

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

  useEffect(() => {
    let isMounted = true;

    const loadMaps = async () => {
      try {
        const mapList = await getMaps();
        if (isMounted) {
          setMaps(Array.isArray(mapList) ? mapList : []);
        }
      } catch (error) {
        if (isMounted) {
          setMaps([]);
        }
      }
    };

    loadMaps();

    return () => {
      isMounted = false;
    };
  }, []);

  const match = data.match || {};
  const blueTeam = data.overlay_blue_team || data.blue_team || {};
  const redTeam = data.overlay_red_team || data.red_team || {};
  const game = data.game || {};
  const selectedMap = data.map || data.current_map || game.map || {};
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
  const blueLogo = getTeamLogo(blueTeam);
  const redLogo = getTeamLogo(redTeam);
  const resolvedBlueLogo = blueLogo ? resolveAssetUrl(blueLogo) : "";
  const resolvedRedLogo = redLogo ? resolveAssetUrl(redLogo) : "";
  const selectedMapImagePath = getMapImagePath(selectedMap);
  const resolvedSelectedMapImage = selectedMapImagePath ? resolveAssetUrl(selectedMapImagePath) : "";
  const hasSelectedMap = Boolean(selectedMap?.name && resolvedSelectedMapImage);
  const mapName = hasSelectedMap
    ? String(selectedMap.name || "").toUpperCase()
    : "RANDOM MAP DRAW";
  const rollingMaps = useMemo(
    () =>
      maps.filter((mapItem) => {
        const imagePath = getMapImagePath(mapItem);
        return Boolean(imagePath);
      }),
    [maps]
  );

  return (
    <div className="overlay-stage legacy-draft-overlay">
      <img className="overlay-frame" src={banningBg} alt="" draggable="false" />
      <div className="overlay-data-layer">
        {resolvedBlueLogo ? (
          <div className="legacy-draft-blue-team-logo-mask">
            <img
              className="legacy-draft-blue-team-logo"
              src={resolvedBlueLogo}
              alt={`${blueTeam.name || "Blue team"} logo`}
              draggable="false"
            />
          </div>
        ) : null}
        {resolvedRedLogo ? (
          <div className="legacy-draft-red-team-logo-mask">
            <img
              className="legacy-draft-red-team-logo"
              src={resolvedRedLogo}
              alt={`${redTeam.name || "Red team"} logo`}
              draggable="false"
            />
          </div>
        ) : null}
        <div className="legacy-draft-blue-team-name">
          {String(blueTeam.name || blueTeam.short_name || "Blue").toUpperCase()}
        </div>
        <div className="legacy-draft-red-team-name">
          {String(redTeam.name || redTeam.short_name || "Red").toUpperCase()}
        </div>
        <div className="legacy-draft-match-title">
          {formatMatchTitle(match.title)}
        </div>
        <div className="legacy-draft-match-mode">{formatBestOf(match.mode)}</div>
        <div className="legacy-draft-game-no">{`GAME ${game.game_no || "-"}`}</div>
        <div className="legacy-draft-map-name">{mapName}</div>
        {hasSelectedMap ? (
          <img
            className="legacy-draft-map-image"
            src={resolvedSelectedMapImage}
            alt={selectedMap.name || "Map"}
            draggable="false"
          />
        ) : (
          <div className="legacy-draft-map-image-slot" aria-label="Random map draw">
            {rollingMaps.length ? (
              <div className="legacy-draft-map-slot-reel">
                {rollingMaps.map((mapItem) => {
                  const imagePath = getMapImagePath(mapItem);
                  const resolvedImage = imagePath ? resolveAssetUrl(imagePath) : "";

                  return resolvedImage ? (
                    <img
                      key={mapItem.id}
                      className="legacy-draft-map-slot-image"
                      src={resolvedImage}
                      alt={mapItem.name || "Map"}
                      draggable="false"
                    />
                  ) : null;
                })}
                {rollingMaps.map((mapItem) => {
                  const imagePath = getMapImagePath(mapItem);
                  const resolvedImage = imagePath ? resolveAssetUrl(imagePath) : "";

                  return resolvedImage ? (
                    <img
                      key={`repeat-${mapItem.id}`}
                      className="legacy-draft-map-slot-image"
                      src={resolvedImage}
                      alt=""
                      draggable="false"
                    />
                  ) : null;
                })}
              </div>
            ) : null}
          </div>
        )}
        <WinIndicators
          className="legacy-draft-blue-indicators"
          total={seriesTotal}
          score={blueScore}
          side="blue"
          size={28}
          gap={0}
        />
        <WinIndicators
          className="legacy-draft-red-indicators"
          total={seriesTotal}
          score={redScore}
          side="red"
          size={28}
          gap={0}
        />
      </div>
    </div>
  );
}

export default LegacyDraftOverlay;
