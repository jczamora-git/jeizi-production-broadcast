import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import ConfirmationModal from "../../components/common/ConfirmationModal";
import CustomDropdown from "../../components/common/CustomDropdown";
import Toast from "../../components/common/Toast";
import {
  getGames,
  getMaps,
  getMatches,
  getOverlaySettings,
  getTeams,
  resetGameWinner,
  setGameWinner,
  updateGame,
  updateOverlaySetting,
} from "../../services/api";
import socket from "../../services/socket";

const GAME_OVERLAY_KEY = "game_overlay";
const liveStatuses = ["live", "active", "ongoing"];
const setupStatuses = ["setup", "queued", "pending"];

function getMaxGamesByMode(mode) {
  switch (mode) {
    case "BO3":
      return 3;
    case "BO5":
      return 5;
    case "BO7":
      return 7;
    case "BO1":
    default:
      return 1;
  }
}

function getRequiredWins(mode) {
  return Math.ceil(getMaxGamesByMode(mode) / 2);
}

function getGameSides(gameNo, match) {
  if (!match) {
    return { blueTeamId: null, redTeamId: null };
  }

  const isEven = Number(gameNo) % 2 === 0;
  return {
    blueTeamId: isEven ? match.red_team_id : match.blue_team_id,
    redTeamId: isEven ? match.blue_team_id : match.red_team_id,
  };
}

function statusClass(status) {
  if (!status) {
    return "status-badge status-queued";
  }

  return `status-badge status-${status}`;
}

function OverlayControlsPage() {
  const [settings, setSettings] = useState({});
  const [matches, setMatches] = useState([]);
  const [games, setGames] = useState([]);
  const [maps, setMaps] = useState([]);
  const [teams, setTeams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState({});
  const [toast, setToast] = useState({ message: "", type: "info" });
  const [selectedMapId, setSelectedMapId] = useState("");
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    variant: "",
    onConfirm: () => {},
  });

  const overlayControls = useMemo(
    () => [
      {
        key: GAME_OVERLAY_KEY,
        title: "Game Overlay",
        description: "Controls whether the live gameplay overlay is visible in OBS.",
      },
      {
        key: "loading_overlay",
        title: "Loading Screen Overlay",
        description: "Controls whether the loading screen overlay is visible in OBS.",
      },
    ],
    []
  );

  const closeToast = () => setToast({ message: "", type: "info" });

  const showToast = (message, type = "success") => {
    setToast({ message, type });
  };

  const closeConfirm = () => {
    setConfirmState((prev) => ({ ...prev, open: false }));
  };

  const openConfirm = ({ title, message, confirmText, variant, onConfirm }) => {
    setConfirmState({
      open: true,
      title,
      message,
      confirmText: confirmText || "Confirm",
      variant: variant || "",
      onConfirm,
    });
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [settingsData, matchData, gameData, mapData, teamData] = await Promise.all([
        getOverlaySettings(),
        getMatches(),
        getGames(),
        getMaps(),
        getTeams(),
      ]);
      setSettings(settingsData || {});
      setMatches(matchData || []);
      setGames(gameData || []);
      setMaps(mapData || []);
      setTeams(teamData || []);
    } catch (loadError) {
      console.error("Failed to load overlay controls data", loadError);
      setError(loadError?.message || "Failed to load overlay controls data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const refresh = () => {
      loadData();
    };

    socket.on("matches:changed", refresh);
    socket.on("overlay-settings:changed", refresh);

    return () => {
      socket.off("matches:changed", refresh);
      socket.off("overlay-settings:changed", refresh);
    };
  }, [loadData]);

  const teamNameById = useMemo(() => {
    return teams.reduce((acc, team) => {
      acc[team.id] = team.name;
      return acc;
    }, {});
  }, [teams]);

  const currentMatch = useMemo(() => {
    const liveMatch = matches.find((match) =>
      liveStatuses.includes(String(match?.status || "").toLowerCase())
    );
    if (liveMatch) {
      return liveMatch;
    }

    const queuedMatch = [...matches]
      .filter((match) => setupStatuses.includes(String(match?.status || "").toLowerCase()))
      .sort((left, right) => {
        const queueDiff = Number(left.queue_order || 0) - Number(right.queue_order || 0);
        if (queueDiff !== 0) {
          return queueDiff;
        }

        return Number(left.match_no || 0) - Number(right.match_no || 0);
      })[0];

    return queuedMatch || null;
  }, [matches]);

  const gamesForCurrentMatch = useMemo(() => {
    if (!currentMatch) {
      return [];
    }

    return games.filter((game) => Number(game.match_id) === Number(currentMatch.id));
  }, [currentMatch, games]);

  const currentGame = useMemo(() => {
    if (!gamesForCurrentMatch.length) {
      return null;
    }

    const liveGame = gamesForCurrentMatch.find(
      (game) => String(game.status || "").toLowerCase() === "live"
    );
    if (liveGame) {
      return liveGame;
    }

    const queuedGame = [...gamesForCurrentMatch]
      .filter((game) => setupStatuses.includes(String(game.status || "").toLowerCase()))
      .sort((left, right) => Number(left.game_no || 0) - Number(right.game_no || 0))[0];
    if (queuedGame) {
      return queuedGame;
    }

    const unfinishedGame = [...gamesForCurrentMatch]
      .filter((game) => String(game.status || "").toLowerCase() !== "finished")
      .sort((left, right) => Number(left.game_no || 0) - Number(right.game_no || 0))[0];
    if (unfinishedGame) {
      return unfinishedGame;
    }

    return [...gamesForCurrentMatch].sort(
      (left, right) => Number(right.game_no || 0) - Number(left.game_no || 0)
    )[0];
  }, [gamesForCurrentMatch]);

  const currentMatchSeriesState = useMemo(() => {
    if (!currentMatch) {
      return {
        blueWins: 0,
        redWins: 0,
        requiredWins: 1,
        seriesCompleted: false,
      };
    }

    let blueWins = 0;
    let redWins = 0;

    gamesForCurrentMatch.forEach((game) => {
      if (String(game.status || "").toLowerCase() !== "finished" || !game.winner_team_id) {
        return;
      }

      if (String(game.winner_team_id) === String(currentMatch.blue_team_id)) {
        blueWins += 1;
      } else if (String(game.winner_team_id) === String(currentMatch.red_team_id)) {
        redWins += 1;
      }
    });

    const requiredWins = getRequiredWins(currentMatch.mode);

    return {
      blueWins,
      redWins,
      requiredWins,
      seriesCompleted:
        Boolean(Number(currentMatch.series_completed)) ||
        blueWins >= requiredWins ||
        redWins >= requiredWins,
    };
  }, [currentMatch, gamesForCurrentMatch]);

  const currentGameSides = useMemo(() => {
    return getGameSides(currentGame?.game_no, currentMatch);
  }, [currentGame, currentMatch]);

  const mapOptions = useMemo(() => {
    return [
      { value: "", label: "No map" },
      ...maps.map((map) => ({
        value: String(map.id),
        label: map.name,
      })),
    ];
  }, [maps]);

  useEffect(() => {
    setSelectedMapId(currentGame?.map_id != null ? String(currentGame.map_id) : "");
  }, [currentGame]);

  const handleToggle = async (overlayKey) => {
    if (pending[overlayKey]) {
      return;
    }

    const currentEnabled = settings?.[overlayKey] !== false;
    const nextEnabled = !currentEnabled;

    setPending((prev) => ({ ...prev, [overlayKey]: true }));
    setSettings((prev) => ({ ...prev, [overlayKey]: nextEnabled }));

    try {
      await updateOverlaySetting(overlayKey, nextEnabled);
      showToast(
        nextEnabled ? "Overlay enabled." : "Overlay disabled.",
        nextEnabled ? "success" : "info"
      );
      await loadData();
    } catch (updateError) {
      console.error("Failed to update overlay setting", updateError);
      setSettings((prev) => ({ ...prev, [overlayKey]: currentEnabled }));
      showToast(updateError?.message || "Failed to update overlay setting.", "error");
    } finally {
      setPending((prev) => ({ ...prev, [overlayKey]: false }));
    }
  };

  const runCurrentGameAction = async (pendingKey, action) => {
    if (!currentGame || pending[pendingKey]) {
      return;
    }

    setPending((prev) => ({ ...prev, [pendingKey]: true }));
    try {
      await action();
      await loadData();
    } catch (actionError) {
      console.error("Failed current game action", actionError);
      showToast(actionError?.message || "Failed to update current game.", "error");
    } finally {
      setPending((prev) => ({ ...prev, [pendingKey]: false }));
    }
  };

  const handleSaveMap = async () => {
    await runCurrentGameAction("saveMap", async () => {
      await updateGame(currentGame.id, { map_id: selectedMapId || null });
      showToast("Map updated.", "success");
    });
  };

  const handleSetCurrentGameStatus = async (status) => {
    await runCurrentGameAction(`status-${status}`, async () => {
      await updateGame(currentGame.id, { status });

      if (status === "live") {
        await updateOverlaySetting(GAME_OVERLAY_KEY, true);
        showToast("Game started. Game overlay enabled.", "success");
        return;
      }

      if (status === "finished" || status === "setup") {
        await updateOverlaySetting(GAME_OVERLAY_KEY, false);
      }

      if (status === "finished") {
        showToast("Game finished. Game overlay disabled.", "success");
        return;
      }

      showToast("Game set to setup. Game overlay disabled.", "success");
    });
  };

  const submitWinner = async (teamId) => {
    await runCurrentGameAction(`winner-${teamId}`, async () => {
      await setGameWinner(currentGame.id, { winner_team_id: teamId });
      await updateGame(currentGame.id, { status: "finished" });
      await updateOverlaySetting(GAME_OVERLAY_KEY, false);
      showToast("Winner saved. Game overlay disabled.", "success");
      closeConfirm();
    });
  };

  const handleWinner = (teamId, sideLabel) => {
    if (!currentGame || !teamId) {
      return;
    }

    if (currentMatchSeriesState.seriesCompleted && !currentGame.winner_team_id) {
      showToast("Series already complete.", "error");
      return;
    }

    if (
      currentGame.winner_team_id &&
      String(currentGame.winner_team_id) !== String(teamId)
    ) {
      openConfirm({
        title: "Change Winner",
        message: `This game already has a winner. Change it to ${sideLabel}?`,
        confirmText: "Change Winner",
        variant: "danger",
        onConfirm: () => submitWinner(teamId),
      });
      return;
    }

    openConfirm({
      title: "Save Winner",
      message: `Set ${sideLabel} as the winner for Game ${currentGame.game_no}?`,
      confirmText: "Save Winner",
      onConfirm: () => submitWinner(teamId),
    });
  };

  const handleResetResult = async () => {
    if (!currentGame) {
      return;
    }

    const submitReset = async () => {
      await runCurrentGameAction("resetResult", async () => {
        await resetGameWinner(currentGame.id);
        showToast("Game result reset. Match score updated.", "success");
        closeConfirm();
      });
    };

    if (currentGame.winner_team_id) {
      openConfirm({
        title: "Reset game result?",
        message: "This will remove the game winner and update the match score.",
        confirmText: "Reset",
        variant: "danger",
        onConfirm: submitReset,
      });
      return;
    }

    await submitReset();
  };

  const blueSideName = currentGameSides.blueTeamId
    ? teamNameById[currentGameSides.blueTeamId] || currentGameSides.blueTeamId
    : "-";
  const redSideName = currentGameSides.redTeamId
    ? teamNameById[currentGameSides.redTeamId] || currentGameSides.redTeamId
    : "-";
  const hasMapChanged = String(selectedMapId ?? "") !== String(currentGame?.map_id ?? "");
  const currentGameWinnerLabel = currentGame?.winner_team_id
    ? teamNameById[currentGame.winner_team_id] || currentGame.winner_team_id
    : "No winner yet";

  return (
    <div className="controller-page overlay-controls-page">
      <div className="toast-container">
        <Toast message={toast.message} type={toast.type} onClose={closeToast} />
      </div>

      <div className="page-header">
        <div className="page-title-group">
          <h1>Overlay Controls</h1>
          <div className="page-subtitle">Enable or disable overlay scenes used by OBS.</div>
        </div>
      </div>

      <div className="overlay-controls-grid">
        {isLoading ? (
          <section className="modern-card overlay-control-card">Loading overlay settings...</section>
        ) : error ? (
          <section className="modern-card overlay-control-card overlay-control-error">
            {error}
            <button type="button" className="button-secondary" onClick={loadData}>
              Retry
            </button>
          </section>
        ) : (
          overlayControls.map((control) => {
            const isEnabled = settings?.[control.key] !== false;
            const isPending = pending?.[control.key];

            return (
              <section key={control.key} className="modern-card overlay-control-card">
                <div className="overlay-control-row">
                  <div className="overlay-control-main">
                    <div className="overlay-control-title">{control.title}</div>
                    <div className="overlay-control-description">{control.description}</div>
                  </div>
                  <div className="overlay-control-actions">
                    <div className="overlay-control-status">
                      <span
                        className={`overlay-control-status-text${
                          isEnabled ? " is-enabled" : " is-disabled"
                        }`}
                      >
                        {isEnabled ? "Enabled" : "Disabled"}
                      </span>
                      <span className="overlay-control-status-subtext">
                        {isEnabled ? "Visible in OBS" : "Hidden from OBS"}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={`button-secondary overlay-toggle-button${
                        isEnabled ? " is-enabled" : " is-disabled"
                      }`}
                      onClick={() => handleToggle(control.key)}
                      disabled={isPending}
                    >
                      {isPending ? "Saving..." : isEnabled ? "Disable" : "Enable"}
                    </button>
                  </div>
                </div>
              </section>
            );
          })
        )}
      </div>

      {!isLoading && !error ? (
        <section className="modern-card overlay-control-card">
          <div className="game-record-header">
            <div>
              <div className="overlay-control-title">Current Game Control</div>
              <div className="overlay-control-description">
                Control the live game without opening Manage Games.
              </div>
            </div>
          </div>

          {!currentMatch ? (
            <div className="muted">No active match selected.</div>
          ) : (
            <>
              <div className="games-summary-card">
                <div className="games-summary-item">
                  <span className="games-summary-label">Match</span>
                  <strong>
                    Match #{currentMatch.match_no} {currentMatch.title || ""}
                  </strong>
                </div>
                <div className="games-summary-item">
                  <span className="games-summary-label">Teams</span>
                  <strong>
                    {teamNameById[currentMatch.blue_team_id] || "-"} vs{" "}
                    {teamNameById[currentMatch.red_team_id] || "-"}
                  </strong>
                </div>
                <div className="games-summary-item">
                  <span className="games-summary-label">Mode</span>
                  <strong>{currentMatch.mode || "-"}</strong>
                </div>
                <div className="games-summary-item">
                  <span className="games-summary-label">Series</span>
                  <strong>
                    {currentMatchSeriesState.blueWins} - {currentMatchSeriesState.redWins}
                  </strong>
                </div>
              </div>

              {currentGame ? (
                <article className="game-record-card">
                  <div className="game-record-header">
                    <div>
                      <div className="game-record-title">
                        Game {currentGame.game_no} / {getMaxGamesByMode(currentMatch.mode)}
                      </div>
                      <div className="helper-text">Sides auto-switch on even game numbers.</div>
                    </div>
                    <span className={statusClass(currentGame.status)}>
                      {currentGame.status || "queued"}
                    </span>
                  </div>

                  <div className="game-record-body">
                    <div className="game-record-section">
                      <div className="game-record-label">Sides</div>
                      <div className="side-stack">
                        <div className="side-pill side-pill-blue">{blueSideName}</div>
                        <div className="side-pill side-pill-red">{redSideName}</div>
                      </div>
                    </div>

                    <div className="game-record-section">
                      <div className="game-record-label">Map</div>
                      <div className="map-control">
                        <div className="map-control-row">
                          <CustomDropdown
                            value={selectedMapId}
                            options={mapOptions}
                            placeholder="Select map"
                            onChange={setSelectedMapId}
                          />
                          {hasMapChanged ? (
                            <button
                              type="button"
                              className="button-ghost button-compact save-map-btn"
                              onClick={handleSaveMap}
                              disabled={pending.saveMap}
                            >
                              {pending.saveMap ? "Saving..." : "Save Map"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="game-record-section">
                      <div className="game-record-label">Winner</div>
                      <div className="winner-label">{currentGameWinnerLabel}</div>
                    </div>
                  </div>

                  <div className="game-record-actions">
                    <div className="game-action-group status-actions">
                      <div className="action-group-label">Overlay Actions</div>
                      <div className="action-buttons">
                        <button
                          type="button"
                          className="button-ghost button-setup"
                          onClick={() => handleSetCurrentGameStatus("setup")}
                          disabled={pending["status-setup"]}
                        >
                          {pending["status-setup"] ? "Saving..." : "Setup"}
                        </button>
                        <button
                          type="button"
                          className="button-success button-start"
                          onClick={() => handleSetCurrentGameStatus("live")}
                          disabled={pending["status-live"]}
                        >
                          {pending["status-live"] ? "Saving..." : "Start Game Overlay"}
                        </button>
                        <button
                          type="button"
                          className="button-warning button-finish"
                          onClick={() => handleSetCurrentGameStatus("finished")}
                          disabled={pending["status-finished"]}
                        >
                          {pending["status-finished"] ? "Saving..." : "Finish Game"}
                        </button>
                      </div>
                    </div>

                    <div className="game-action-group scoring-actions">
                      <div className="action-group-label">Winner</div>
                      <div className="action-buttons">
                        <button
                          type="button"
                          className="button-blue button-winner-blue"
                          onClick={() => handleWinner(currentGameSides.blueTeamId, blueSideName)}
                          disabled={!currentGameSides.blueTeamId || pending[`winner-${currentGameSides.blueTeamId}`]}
                        >
                          Winner Blue: {blueSideName}
                        </button>
                        <button
                          type="button"
                          className="button-red button-winner-red"
                          onClick={() => handleWinner(currentGameSides.redTeamId, redSideName)}
                          disabled={!currentGameSides.redTeamId || pending[`winner-${currentGameSides.redTeamId}`]}
                        >
                          Winner Red: {redSideName}
                        </button>
                        <button
                          type="button"
                          className="button-ghost button-reset"
                          onClick={handleResetResult}
                          disabled={pending.resetResult}
                        >
                          {pending.resetResult ? "Saving..." : "Reset Result"}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ) : (
                <div className="modern-card muted">No game found for the current match.</div>
              )}
            </>
          )}
        </section>
      ) : null}

      {confirmState.open
        ? createPortal(
            <ConfirmationModal
              open={confirmState.open}
              title={confirmState.title}
              message={confirmState.message}
              confirmText={confirmState.confirmText}
              variant={confirmState.variant}
              onConfirm={confirmState.onConfirm}
              onCancel={closeConfirm}
            />,
            document.body
          )
        : null}
    </div>
  );
}

export default OverlayControlsPage;
