import { useEffect, useMemo, useState } from "react";
import { getCurrentOverlayData } from "../../services/api";
import "../../styles/overlays/overlay-base.css";
import "../../styles/overlays/victory-overlay.css";

const DEFAULT_LINE_CONFIG = {
  line1: {
    top: "880px",
    left: "100px",
    width: "1440px",
    textAlign: "right",
    fontSize: "36px",
    lineHeight: "1.05",
    letterSpacing: "0.12em",
    color: "#f8fafc",
    textTransform: "uppercase",
    fontWeight: "400",
    opacity: "1",
    zIndex: "5",
  },
  line2: {
    top: "910px",
    left: "100px",
    width: "1440px",
    textAlign: "right",
    fontSize: "112px",
    lineHeight: "0.94",
    letterSpacing: "0.06em",
    color: "#ffffff",
    textTransform: "uppercase",
    fontWeight: "400",
    opacity: "1",
    zIndex: "6",
  },
  line3: {
    top: "1000px",
    left: "100px",
    width: "1440px",
    textAlign: "right",
    fontSize: "36px",
    lineHeight: "1.04",
    letterSpacing: "0.18em",
    color: "#ffffff",
    textTransform: "uppercase",
    fontWeight: "400",
    opacity: "1",
    zIndex: "5",
  },
};

const LINE_STYLE_KEYS = [
  "top",
  "left",
  "width",
  "textAlign",
  "fontSize",
  "lineHeight",
  "letterSpacing",
  "color",
  "textTransform",
  "fontWeight",
  "opacity",
  "textShadow",
  "zIndex",
];

const getSideTeamName = (team, match, side, fallback) =>
  String(
    team?.name ||
      team?.shortname ||
      team?.short_name ||
      match?.[`${side}_team_name`] ||
      match?.[`${side}_team_shortname`] ||
      match?.[`${side}_team_short_name`] ||
      fallback
  );

const getWinnerTeamId = (game) =>
  Number(game?.winner_team_id || game?.winning_team_id || 0);

const getVictoryGame = (overlayData) => {
  const latestFinishedGame = overlayData?.latest_finished_game;
  if (getWinnerTeamId(latestFinishedGame)) {
    return latestFinishedGame;
  }

  const currentGame = overlayData?.game;
  if (getWinnerTeamId(currentGame)) {
    return currentGame;
  }

  return null;
};

const getCssVarName = (lineKey, styleKey) =>
  `--victory-${lineKey}-${styleKey.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;

function VictoryOverlay() {
  const [data, setData] = useState({
    match: null,
    blue_team: null,
    red_team: null,
    game: null,
    latest_finished_game: null,
  });

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
          setData({
            match: null,
            blue_team: null,
            red_team: null,
            game: null,
            latest_finished_game: null,
          });
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

  const searchParams = useMemo(
    () => new URLSearchParams(window.location.search),
    []
  );

  const match = data.match || {};
  const blueTeam = data.blue_team || {};
  const redTeam = data.red_team || {};
  const victoryGame = getVictoryGame(data);
  const winnerTeamId = getWinnerTeamId(victoryGame);
  const blueTeamId = Number(match?.blue_team_id || blueTeam?.id || 0);
  const redTeamId = Number(match?.red_team_id || redTeam?.id || 0);

  let winnerTeamName = "TEAM NAME";
  let opponentTeamName = "OPPONENT";

  if (winnerTeamId && winnerTeamId === blueTeamId) {
    winnerTeamName = getSideTeamName(blueTeam, match, "blue", "TEAM NAME");
    opponentTeamName = getSideTeamName(redTeam, match, "red", "OPPONENT");
  } else if (winnerTeamId && winnerTeamId === redTeamId) {
    winnerTeamName = getSideTeamName(redTeam, match, "red", "TEAM NAME");
    opponentTeamName = getSideTeamName(blueTeam, match, "blue", "OPPONENT");
  }

  const matchNo = match?.match_no || victoryGame?.match_no || "?";
  const gameNo = victoryGame?.game_no || data?.game?.game_no || "?";

  const lineTexts = {
    line1:
      searchParams.get("line1Text") || `MATCH ${matchNo} - GAME ${gameNo} WINNER`,
    line2: searchParams.get("line2Text") || winnerTeamName,
    line3: searchParams.get("line3Text") || `AGAINST ${opponentTeamName}`,
  };

  const rootStyle = Object.entries(DEFAULT_LINE_CONFIG).reduce((style, [lineKey, defaults]) => {
    LINE_STYLE_KEYS.forEach((styleKey) => {
      const queryValue = searchParams.get(
        `${lineKey}${styleKey.charAt(0).toUpperCase()}${styleKey.slice(1)}`
      );
      style[getCssVarName(lineKey, styleKey)] = queryValue || defaults[styleKey];
    });

    return style;
  }, {});

  return (
    <div className="overlay-page victory-overlay-page" style={rootStyle}>
      <div className="victory-line victory-line-1">{lineTexts.line1}</div>
      <div className="victory-line victory-line-2">{lineTexts.line2}</div>
      <div className="victory-line victory-line-3">{lineTexts.line3}</div>
    </div>
  );
}

export default VictoryOverlay;
