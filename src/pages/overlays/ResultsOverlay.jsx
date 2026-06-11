import { useEffect, useState } from "react";
import { getCurrentOverlayData } from "../../services/api";
import resultsBg from "../../game_ui/battle-results.png";
import WinIndicators from "../../components/overlay/WinIndicators";
import "../../styles/overlays/overlay-base.css";
import "../../styles/overlays/results-overlay.css";

const getSeriesLength = (mode) => {
  const normalized = String(mode || "").toUpperCase();
  if (normalized === "BO3") return 2;
  if (normalized === "BO5") return 3;
  if (normalized === "BO7") return 4;
  return 1;
};

const getTeamShortName = (team, fallback) =>
  String(team?.shortname || team?.short_name || team?.name || fallback).toUpperCase();

const getOverlayTeamsForGame = (match, game, data) => {
  const isEvenGame = Number(game?.game_no || 1) % 2 === 0;
  if (game) {
    return {
      blueTeam: isEvenGame ? data.red_team || {} : data.blue_team || {},
      redTeam: isEvenGame ? data.blue_team || {} : data.red_team || {},
      blueTeamId: Number(isEvenGame ? match?.red_team_id : match?.blue_team_id || 0),
      redTeamId: Number(isEvenGame ? match?.blue_team_id : match?.red_team_id || 0),
    };
  }

  return {
    blueTeam: data.overlay_blue_team || data.blue_team || {},
    redTeam: data.overlay_red_team || data.red_team || {},
    blueTeamId: Number(data.overlay_blue_team_id || match?.blue_team_id || 0),
    redTeamId: Number(data.overlay_red_team_id || match?.red_team_id || 0),
  };
};

const getGameWinnerSide = (game, overlayBlueTeamId, overlayRedTeamId) => {
  const winnerTeamId = Number(game?.winner_team_id || game?.winning_team_id);
  if (!winnerTeamId) return "";
  if (overlayBlueTeamId === winnerTeamId) return "blue";
  if (overlayRedTeamId === winnerTeamId) return "red";

  return "";
};

function ResultsOverlay() {
  const [data, setData] = useState({
    match: null,
    blue_team: null,
    red_team: null,
    game: null,
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
          setData({ match: null, blue_team: null, red_team: null, game: null });
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

  const match = data.match || {};
  const resultGame = data.latest_finished_game || data.game || null;
  const {
    blueTeam,
    redTeam,
    blueTeamId: overlayBlueTeamId,
    redTeamId: overlayRedTeamId,
  } = getOverlayTeamsForGame(match, resultGame, data);
  const blueTeamShortName = getTeamShortName(blueTeam, "BLUE");
  const redTeamShortName = getTeamShortName(redTeam, "RED");
  const seriesTotal = getSeriesLength(match?.mode);
  const blueScore =
    overlayBlueTeamId && overlayBlueTeamId === Number(match.red_team_id)
      ? match.red_score ?? 0
      : match.blue_score ?? 0;
  const redScore =
    overlayRedTeamId && overlayRedTeamId === Number(match.blue_team_id)
      ? match.blue_score ?? 0
      : match.red_score ?? 0;
  const winnerSide = getGameWinnerSide(resultGame, overlayBlueTeamId, overlayRedTeamId);
  const hasRecordedResult = winnerSide === "blue" || winnerSide === "red";
  const blueResultStatus = hasRecordedResult
    ? winnerSide === "blue"
      ? "VICTORY"
      : "DEFEAT"
    : "PENDING";
  const redResultStatus = hasRecordedResult
    ? winnerSide === "red"
      ? "VICTORY"
      : "DEFEAT"
    : "PENDING";

  return (
    <div className="overlay-canvas overlay-stage">
      <img className="overlay-bg" src={resultsBg} alt="" />
      <div className="results-team-shortname results-blue-team-shortname">
        {blueTeamShortName}
      </div>
      <div className="results-status results-blue-status">{blueResultStatus}</div>
      <WinIndicators
        className="results-score-indicators results-blue-indicators"
        total={seriesTotal}
        score={blueScore}
        side="blue"
        size={34}
        gap={5}
      />

      <div className="results-team-shortname results-red-team-shortname">
        {redTeamShortName}
      </div>
      <div className="results-status results-red-status">{redResultStatus}</div>
      <WinIndicators
        className="results-score-indicators results-red-indicators"
        total={seriesTotal}
        score={redScore}
        side="red"
        size={34}
        gap={5}
      />
    </div>
  );
}

export default ResultsOverlay;
