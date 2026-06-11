import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import {
  createGame,
  deleteMatch,
  deleteGame,
  createMatch,
  finishMatch,
  getCasters,
  getGames,
  getMaps,
  getMatches,
  getTeams,
  loadNextMatch,
  resetGameWinner,
  setGameWinner,
  startMatch,
  updateGame,
  updateMatch,
} from "../../services/api";
import ConfirmationModal from "../../components/common/ConfirmationModal";
import CustomDropdown from "../../components/common/CustomDropdown";
import Toast from "../../components/common/Toast";
import socket from "../../services/socket";

const emptyMatchForm = {
  match_no: "",
  blue_team_id: "",
  red_team_id: "",
  mode: "BO1",
  title: "Elimination",
  queue_order: "",
  blue_score: 0,
  red_score: 0,
  status: "queued",
};

const emptyGameForm = { map_id: "" };

const getDefaultCasterIds = (casterList = []) => {
  if (casterList.length === 1) {
    return [casterList[0].id];
  }

  return [];
};

function getMaxGamesByMode(mode) {
  switch (mode) {
    case "BO1":
      return 1;
    case "BO3":
      return 3;
    case "BO5":
      return 5;
    case "BO7":
      return 7;
    default:
      return 1;
  }
}

function getRequiredWins(mode) {
  return Math.ceil(getMaxGamesByMode(mode) / 2);
}

function getMatchStatusRank(match) {
  const normalizedStatus = String(match?.status || "").toLowerCase();
  if (["live", "active", "ongoing"].includes(normalizedStatus)) {
    return 0;
  }
  if (["finished", "completed", "done"].includes(normalizedStatus)) {
    return 2;
  }
  return 1;
}

function getTimeValue(value) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? time : 0;
}

function getMatchFinishedTime(match) {
  return Math.max(getTimeValue(match?.finished_at), getTimeValue(match?.updated_at));
}

function sortMatchesByStatusAndQueue(left, right) {
  const leftRank = getMatchStatusRank(left);
  const rightRank = getMatchStatusRank(right);
  const statusRankDiff = leftRank - rightRank;
  if (statusRankDiff !== 0) {
    return statusRankDiff;
  }

  if (leftRank === 2) {
    const finishedTimeDiff = getMatchFinishedTime(right) - getMatchFinishedTime(left);
    if (finishedTimeDiff !== 0) {
      return finishedTimeDiff;
    }

    const matchNoDiff = Number(right.match_no || 0) - Number(left.match_no || 0);
    if (matchNoDiff !== 0) {
      return matchNoDiff;
    }

    return Number(right.id || 0) - Number(left.id || 0);
  }

  const queueOrderDiff = Number(left.queue_order || 0) - Number(right.queue_order || 0);
  if (queueOrderDiff !== 0) {
    return queueOrderDiff;
  }

  const matchNoDiff = Number(left.match_no || 0) - Number(right.match_no || 0);
  if (matchNoDiff !== 0) {
    return matchNoDiff;
  }

  return Number(left.id || 0) - Number(right.id || 0);
}

function getGroupStatusRank(matches = []) {
  if (matches.some((match) => getMatchStatusRank(match) === 0)) {
    return 0;
  }

  if (matches.some((match) => getMatchStatusRank(match) === 1)) {
    return 1;
  }

  return 2;
}

function getGroupLiveUpcomingQueueOrder(matches = []) {
  const queueOrders = matches
    .filter((match) => getMatchStatusRank(match) !== 2)
    .map((match) => Number(match.queue_order || 0))
    .filter((value) => Number.isFinite(value) && value > 0);

  return queueOrders.length ? Math.min(...queueOrders) : Number.POSITIVE_INFINITY;
}

function getGroupFinishedOrder(matches = []) {
  const finishedMatches = matches.filter((match) => getMatchStatusRank(match) === 2);
  const latestFinishedTime = finishedMatches.reduce(
    (latest, match) => Math.max(latest, getMatchFinishedTime(match)),
    0
  );
  const highestMatchNo = finishedMatches.reduce(
    (highest, match) => Math.max(highest, Number(match.match_no || 0)),
    0
  );

  return {
    latestFinishedTime,
    highestMatchNo,
  };
}

function getMatchGroupTitle(match) {
  return (
    match?.title ||
    match?.stage ||
    match?.round_name ||
    match?.match_title ||
    match?.round ||
    "Other Matches"
  );
}

function getGroupSortRank(title) {
  const normalizedTitle = String(title || "").toLowerCase();
  const tournamentOrder = [
    "elimination",
    "quarter-finals",
    "semi-finals",
    "semi-finals (upper)",
    "semi-finals (lower)",
    "finals",
    "grand finals",
  ];
  const index = tournamentOrder.indexOf(normalizedTitle);
  return index === -1 ? tournamentOrder.length : index;
}

function buildSwitchedMatchPayload(matchOrForm) {
  return {
    ...matchOrForm,
    blue_team_id: matchOrForm.red_team_id,
    red_team_id: matchOrForm.blue_team_id,
    blue_score: matchOrForm.red_score,
    red_score: matchOrForm.blue_score,
  };
}

function MatchConfig() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [casters, setCasters] = useState([]);
  const [games, setGames] = useState([]);
  const [maps, setMaps] = useState([]);
  const [matchForm, setMatchForm] = useState(emptyMatchForm);
  const [selectedCasterIds, setSelectedCasterIds] = useState([]);
  const [hasAutoSelectedCaster, setHasAutoSelectedCaster] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [mapDrafts, setMapDrafts] = useState({});
  const [expandedMatchActions, setExpandedMatchActions] = useState({});

  const [isNewMatchOpen, setIsNewMatchOpen] = useState(false);
  const [isEditMatchOpen, setIsEditMatchOpen] = useState(false);
  const [isGamesOpen, setIsGamesOpen] = useState(false);

  const [gameForm, setGameForm] = useState(emptyGameForm);

  const [toast, setToast] = useState({ message: "", type: "info" });
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    variant: "",
    onConfirm: () => {},
  });

  const loadData = useCallback(async () => {
    try {
      const [matchData, teamData, casterData, gameData, mapData] = await Promise.all([
        getMatches(),
        getTeams(),
        getCasters(),
        getGames(),
        getMaps(),
      ]);
      setMatches(matchData || []);
      setTeams(teamData || []);
      setCasters(casterData || []);
      setGames(gameData || []);
      setMaps(mapData || []);
    } catch (error) {
      setMatches([]);
      setTeams([]);
      setCasters([]);
      setGames([]);
      setMaps([]);
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

  const showToast = (message, type = "info") => {
    setToast({ message, type });
  };

  const closeToast = () => setToast({ message: "", type: "info" });

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

  const closeConfirm = () => {
    setConfirmState((prev) => ({ ...prev, open: false }));
  };

  const nextMatchNo = useMemo(() => {
    return matches.length
      ? Math.max(...matches.map((match) => Number(match.match_no || 0))) + 1
      : 1;
  }, [matches]);

  const nextQueueOrder = useMemo(() => {
    return matches.length
      ? Math.max(...matches.map((match) => Number(match.queue_order || 0))) + 1
      : 1;
  }, [matches]);

  const groupedMatches = useMemo(() => {
    const groupsMap = new Map();

    matches.forEach((match, index) => {
      const groupTitle = getMatchGroupTitle(match);
      if (!groupsMap.has(groupTitle)) {
        groupsMap.set(groupTitle, []);
      }
      groupsMap.get(groupTitle).push({ ...match, __groupIndex: index });
    });

    return Array.from(groupsMap.entries())
      .map(([title, groupMatches]) => {
        const sortedGroupMatches = [...groupMatches].sort(sortMatchesByStatusAndQueue);
        const latestMatch = [...groupMatches].sort((left, right) => {
          const queueOrderDiff = Number(right.queue_order || 0) - Number(left.queue_order || 0);
          if (queueOrderDiff !== 0) {
            return queueOrderDiff;
          }

          const matchNoDiff = Number(right.match_no || 0) - Number(left.match_no || 0);
          if (matchNoDiff !== 0) {
            return matchNoDiff;
          }

          return Number(right.__groupIndex || 0) - Number(left.__groupIndex || 0);
        })[0];

        return {
          title,
          defaultMode: latestMatch?.mode || "BO1",
          nextQueueOrder,
          matches: sortedGroupMatches.map(({ __groupIndex, ...match }) => match),
        };
      })
      .sort((left, right) => {
        const leftRank = getGroupStatusRank(left.matches);
        const rightRank = getGroupStatusRank(right.matches);
        const groupRankDiff = leftRank - rightRank;
        if (groupRankDiff !== 0) {
          return groupRankDiff;
        }

        if (leftRank !== 2) {
          const queueOrderDiff =
            getGroupLiveUpcomingQueueOrder(left.matches) -
            getGroupLiveUpcomingQueueOrder(right.matches);
          if (queueOrderDiff !== 0) {
            return queueOrderDiff;
          }
        } else {
          const leftFinishedOrder = getGroupFinishedOrder(left.matches);
          const rightFinishedOrder = getGroupFinishedOrder(right.matches);

          const finishedTimeDiff =
            rightFinishedOrder.latestFinishedTime - leftFinishedOrder.latestFinishedTime;
          if (finishedTimeDiff !== 0) {
            return finishedTimeDiff;
          }

          const finishedMatchNoDiff =
            rightFinishedOrder.highestMatchNo - leftFinishedOrder.highestMatchNo;
          if (finishedMatchNoDiff !== 0) {
            return finishedMatchNoDiff;
          }
        }

        const groupRankFallbackDiff = getGroupSortRank(left.title) - getGroupSortRank(right.title);
        if (groupRankFallbackDiff !== 0) {
          return groupRankFallbackDiff;
        }

        return String(left.title || "").localeCompare(String(right.title || ""));
      });
  }, [matches]);

  const teamOptions = useMemo(() => {
    return teams.map((team) => ({
      value: String(team.id),
      label: team.name,
    }));
  }, [teams]);

  const modeOptions = useMemo(() => {
    return ["BO1", "BO3", "BO5", "BO7"].map((mode) => ({
      value: mode,
      label: mode,
    }));
  }, []);

  const titleOptions = useMemo(() => {
    return [
      "Elimination",
      "Qualifiers",
      "Playoffs",
      "Semi-Finals (Lower)",
      "Semi-Finals (Upper)",
      "Finals",
    ].map((title) => ({
      value: title,
      label: title,
    }));
  }, []);

  const casterNameById = useMemo(() => {
    return casters.reduce((acc, caster) => {
      acc[caster.id] = caster.name;
      return acc;
    }, {});
  }, [casters]);

  const teamNameById = useMemo(() => {
    return teams.reduce((acc, team) => {
      acc[team.id] = team.name;
      return acc;
    }, {});
  }, [teams]);

  const mapOptions = useMemo(() => {
    return [
      { value: "", label: "No map" },
      ...maps.map((map) => ({
        value: String(map.id),
        label: map.name,
      })),
    ];
  }, [maps]);

  const addGameMapOptions = useMemo(() => {
    return mapOptions.filter((option) => option.value !== "");
  }, [mapOptions]);

  const formatCasterNames = (casterIds) => {
    const ids = casterIds
      ? casterIds
          .split(",")
          .map((id) => Number(id.trim()))
          .filter(Boolean)
      : [];
    return ids.map((id) => casterNameById[id]).filter(Boolean).join(" / ");
  };

  const selectedMatch = useMemo(() => {
    return matches.find((match) => Number(match.id) === Number(selectedMatchId));
  }, [matches, selectedMatchId]);

  const gamesForSelectedMatch = useMemo(() => {
    if (!selectedMatch) {
      return [];
    }
    return games.filter((game) => Number(game.match_id) === Number(selectedMatch.id));
  }, [games, selectedMatch]);

  const nextGameNo = useMemo(() => {
    if (!selectedMatch) {
      return null;
    }
    return gamesForSelectedMatch.length
      ? Math.max(...gamesForSelectedMatch.map((game) => Number(game.game_no || 0))) + 1
      : 1;
  }, [gamesForSelectedMatch, selectedMatch]);

  const selectedMatchMaxGames = useMemo(() => {
    return getMaxGamesByMode(selectedMatch?.mode);
  }, [selectedMatch]);

  const selectedMatchSeriesState = useMemo(() => {
    if (!selectedMatch) {
      return {
        blueWins: 0,
        redWins: 0,
        requiredWins: 1,
        seriesCompleted: false,
        seriesWinnerTeamId: null,
      };
    }

    let blueWins = 0;
    let redWins = 0;

    gamesForSelectedMatch.forEach((game) => {
      if (String(game.status || "").toLowerCase() !== "finished" || !game.winner_team_id) {
        return;
      }

      if (String(game.winner_team_id) === String(selectedMatch.blue_team_id)) {
        blueWins += 1;
      } else if (String(game.winner_team_id) === String(selectedMatch.red_team_id)) {
        redWins += 1;
      }
    });

    const requiredWins = getRequiredWins(selectedMatch.mode);
    const fallbackWinnerTeamId =
      blueWins >= requiredWins
        ? selectedMatch.blue_team_id
        : redWins >= requiredWins
          ? selectedMatch.red_team_id
          : null;

    return {
      blueWins,
      redWins,
      requiredWins,
      seriesCompleted:
        Boolean(Number(selectedMatch.series_completed)) || blueWins >= requiredWins || redWins >= requiredWins,
      seriesWinnerTeamId: selectedMatch.series_winner_team_id || fallbackWinnerTeamId,
    };
  }, [gamesForSelectedMatch, selectedMatch]);

  const hasReachedSelectedMatchGameLimit = useMemo(() => {
    return gamesForSelectedMatch.length >= selectedMatchMaxGames;
  }, [gamesForSelectedMatch.length, selectedMatchMaxGames]);

  const isSelectedMatchSeriesComplete = selectedMatchSeriesState.seriesCompleted;

  const resetMatchForm = ({ casterIds = [] } = {}) => {
    setMatchForm({ ...emptyMatchForm, match_no: nextMatchNo });
    setSelectedCasterIds(casterIds);
    setHasAutoSelectedCaster(casterIds.length > 0);
  };

  const openNewMatch = (prefill = {}) => {
    setEditingMatchId(null);
    resetMatchForm({ casterIds: getDefaultCasterIds(casters) });
    setMatchForm((prev) => ({
      ...prev,
      ...prefill,
    }));
    setIsNewMatchOpen(true);
  };

  const handleNewMatch = () => {
    openNewMatch();
  };

  const handleAddMatchForGroup = (group) => {
    openNewMatch({
      title: group.title,
      mode: group.defaultMode || "BO1",
      queue_order: group.nextQueueOrder,
    });
  };

  const handleEditMatch = (match) => {
    setEditingMatchId(match.id);
    setMatchForm({
      match_no: match.match_no || "",
      blue_team_id: match.blue_team_id || "",
      red_team_id: match.red_team_id || "",
      mode: match.mode || "BO1",
      title: match.title || "Elimination",
      queue_order: match.queue_order || "",
      blue_score: match.blue_score ?? 0,
      red_score: match.red_score ?? 0,
      status: match.status || "queued",
    });
    const casterIds = match.caster_ids
      ? match.caster_ids
          .split(",")
          .map((id) => Number(id.trim()))
          .filter(Boolean)
      : [];
    setSelectedCasterIds(casterIds);
    setIsEditMatchOpen(true);
  };

  useEffect(() => {
    if (!isNewMatchOpen || editingMatchId) {
      return;
    }
    if (casters.length !== 1) {
      return;
    }
    if (hasAutoSelectedCaster) {
      return;
    }

    setSelectedCasterIds((current) => {
      if (current.length > 0) {
        return current;
      }

      return [casters[0].id];
    });
    setHasAutoSelectedCaster(true);
  }, [isNewMatchOpen, editingMatchId, casters, hasAutoSelectedCaster]);

  useEffect(() => {
    const hasOpenModal =
      isNewMatchOpen || isEditMatchOpen || isGamesOpen || confirmState.open;

    if (!hasOpenModal) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isNewMatchOpen, isEditMatchOpen, isGamesOpen, confirmState.open]);

  const saveMatch = async (payload) => {
    try {
      if (editingMatchId) {
        console.log("Update match payload:", payload);
        await updateMatch(editingMatchId, payload);
        showToast("Match updated.", "success");
        const existingGameCount = games.filter(
          (game) => Number(game.match_id) === Number(editingMatchId)
        ).length;
        if (existingGameCount > getMaxGamesByMode(payload.mode)) {
          showToast(
            "This match already has more games than the selected mode. Please delete extra games manually.",
            "info"
          );
        }
        setIsEditMatchOpen(false);
      } else {
        const result = await createMatch(payload);
        showToast(
          `Match created. ${result?.generated_games || getMaxGamesByMode(payload.mode)} games generated.`,
          "success"
        );
        setIsNewMatchOpen(false);
      }
      resetMatchForm();
      await loadData();
      return true;
    } catch (err) {
      console.error("Failed to save match", err);
      showToast(err?.message || "Failed to save match.", "error");
      return false;
    }
  };

  const handleMatchSave = () => {
    if (!matchForm.blue_team_id || !matchForm.red_team_id) {
      showToast("Blue Team and Red Team are required.", "error");
      return;
    }
    if (matchForm.blue_team_id === matchForm.red_team_id) {
      showToast("Blue Team and Red Team must be different.", "error");
      return;
    }
    if (!matchForm.mode || !matchForm.title) {
      showToast("Mode and Title are required.", "error");
      return;
    }

    const finalQueueOrder = matchForm.queue_order
      ? Number(matchForm.queue_order)
      : nextQueueOrder;

    const payload = {
      ...matchForm,
      match_no: editingMatchId ? Number(matchForm.match_no || 0) : nextMatchNo,
      blue_team_id: Number(matchForm.blue_team_id),
      red_team_id: Number(matchForm.red_team_id),
      queue_order: finalQueueOrder,
      caster_ids: selectedCasterIds.join(","),
    };

    const isEditing = Boolean(editingMatchId);
    openConfirm({
      title: isEditing ? "Save Changes" : "Create Match",
      message: isEditing ? "Apply these changes?" : "Create this match with the entered details?",
      confirmText: isEditing ? "Save Changes" : "Create",
      onConfirm: async () => {
        const didSave = await saveMatch(payload);
        if (didSave) {
          closeConfirm();
        }
      },
    });
  };

  const handleSwitchTeams = () => {
    openConfirm({
      title: "Switch Teams?",
      message: "This will swap Blue/Red teams and their current scores.",
      confirmText: "Switch Teams",
      onConfirm: () => {
        setMatchForm((prev) => buildSwitchedMatchPayload(prev));
        closeConfirm();
      },
    });
  };

  const toggleCaster = (casterId) => {
    setSelectedCasterIds((prev) =>
      prev.includes(casterId)
        ? prev.filter((id) => id !== casterId)
        : [...prev, casterId]
    );
  };

  const handleStartMatch = async (matchId) => {
    try {
      await startMatch(matchId);
      showToast("Match started.", "success");
      await loadData();
    } catch (err) {
      console.error("Failed to start match", err);
      showToast(err?.message || "Failed to start match.", "error");
    }
  };

  const handleFinishMatch = (matchId) => {
    openConfirm({
      title: "Finish Match",
      message: "Are you sure you want to finish this match?",
      confirmText: "Finish",
      variant: "danger",
      onConfirm: async () => {
        try {
          await finishMatch(matchId);
          showToast("Match finished.", "success");
          await loadData();
        } catch (err) {
          console.error("Failed to finish match", err);
          showToast(err?.message || "Failed to finish match.", "error");
        } finally {
          closeConfirm();
        }
      },
    });
  };

  const handleLoadNext = () => {
    openConfirm({
      title: "Load Next Match",
      message: "This will move the next queued match to active.",
      confirmText: "Load Next",
      onConfirm: async () => {
        try {
          const next = await loadNextMatch();
          if (!next) {
            showToast("No queued match found.", "info");
          } else {
            showToast("Next match loaded.", "success");
          }
          await loadData();
        } catch (err) {
          console.error("Failed to load next match", err);
          showToast(err?.message || "Failed to load next match.", "error");
        } finally {
          closeConfirm();
        }
      },
    });
  };

  const handleManageGames = (matchId) => {
    setSelectedMatchId(matchId);
    setGameForm(emptyGameForm);
    setMapDrafts({});
    setIsGamesOpen(true);
  };

  useEffect(() => {
    const requestedMatchId = searchParams.get("matchId");
    const requestedOpen = searchParams.get("open");

    if (requestedOpen !== "games" || !requestedMatchId || matches.length === 0) {
      return;
    }

    const requestedMatch = matches.find(
      (match) => Number(match.id) === Number(requestedMatchId)
    );

    if (!requestedMatch) {
      return;
    }

    handleManageGames(requestedMatch.id);
    setSearchParams({}, { replace: true });
  }, [matches, searchParams, setSearchParams]);

  const openEditMatchFromManageGames = (match) => {
    setIsGamesOpen(false);
    handleEditMatch(match);
  };

  const openManageGamesFromEdit = () => {
    if (!editingMatchId) {
      return;
    }

    setIsEditMatchOpen(false);
    handleManageGames(editingMatchId);
  };

  const handleAddGame = async () => {
    if (!selectedMatch) {
      showToast("Select a match first.", "error");
      return;
    }

    if (isSelectedMatchSeriesComplete) {
      showToast("Series already complete.", "error");
      return;
    }

    if (hasReachedSelectedMatchGameLimit) {
      showToast(`Maximum games reached for ${selectedMatch.mode}.`, "error");
      return;
    }

    try {
      await createGame({
        match_id: Number(selectedMatch.id),
        game_no: nextGameNo,
        map_id: gameForm.map_id || null,
        status: "setup",
      });
      setGameForm(emptyGameForm);
      showToast("Game added.", "success");
      await loadData();
    } catch (err) {
      console.error("Failed to add game", err);
      showToast(err?.message || "Failed to add game.", "error");
    }
  };

  const handleMapDraftChange = (gameId, mapId) => {
    setMapDrafts((prev) => ({
      ...prev,
      [gameId]: mapId,
    }));
  };

  const handleSaveGameMap = async (gameId) => {
    const mapId = mapDrafts[gameId];
    try {
      await updateGame(gameId, { map_id: mapId || null });
      setMapDrafts((prev) => {
        const next = { ...prev };
        delete next[gameId];
        return next;
      });
      showToast("Map updated.", "success");
      await loadData();
    } catch (err) {
      console.error("Failed to update map", err);
      showToast(err?.message || "Failed to update map.", "error");
    }
  };

  const handleGameStatus = async (game, status) => {
    if (
      isSelectedMatchSeriesComplete &&
      status === "live" &&
      String(game.status || "").toLowerCase() !== "live"
    ) {
      showToast("Series already complete.", "error");
      return;
    }

    try {
      await updateGame(game.id, { status });
      showToast(`Game set to ${status}.`, "success");
      await loadData();
    } catch (err) {
      console.error("Failed to update game", err);
      showToast(err?.message || "Failed to update game.", "error");
    }
  };

  const handleSetupMatch = async (matchId) => {
    try {
      await updateMatch(matchId, { status: "queued" });
      showToast("Match set to setup.", "success");
      await loadData();
    } catch (err) {
      console.error("Failed to set match to setup", err);
      showToast(err?.message || "Failed to set match to setup.", "error");
    }
  };

  const handleFinishGame = (game) => {
    openConfirm({
      title: "Finish Game",
      message: "Are you sure you want to finish this game?",
      confirmText: "Finish",
      variant: "danger",
      onConfirm: async () => {
        try {
          await updateGame(game.id, { status: "finished" });
          showToast("Game finished.", "success");
          await loadData();
        } catch (err) {
          console.error("Failed to finish game", err);
          showToast(err?.message || "Failed to finish game.", "error");
        } finally {
          closeConfirm();
        }
      },
    });
  };

  const handleWinner = (game, teamId, sideLabel) => {
    if (isSelectedMatchSeriesComplete && !game.winner_team_id) {
      showToast("Series already complete.", "error");
      return;
    }

    const submitWinner = async () => {
      try {
        await setGameWinner(game.id, { winner_team_id: teamId });
        showToast("Game result saved. Match score updated.", "success");
        await loadData();
      } catch (err) {
        console.error("Failed to set winner", err);
        showToast(err?.message || "Failed to set winner.", "error");
      } finally {
        closeConfirm();
      }
    };

    if (game.winner_team_id && String(game.winner_team_id) !== String(teamId)) {
      openConfirm({
        title: "Change Winner",
        message: `This game already has a winner. Change it to ${sideLabel}?`,
        confirmText: "Change Winner",
        variant: "danger",
        onConfirm: submitWinner,
      });
      return;
    }

    submitWinner();
  };

  const handleResetGameResult = (game) => {
    const submitReset = async () => {
      try {
        await resetGameWinner(game.id);
        showToast("Game result reset. Match score updated.", "success");
        await loadData();
      } catch (err) {
        console.error("Failed to reset game result", err);
        showToast(err?.message || "Failed to reset game result.", "error");
      } finally {
        closeConfirm();
      }
    };

    if (game.winner_team_id) {
      openConfirm({
        title: "Reset game result?",
        message: "This will remove the game winner and update the match score.",
        confirmText: "Reset",
        variant: "danger",
        onConfirm: submitReset,
      });
      return;
    }

    submitReset();
  };

  const handleDeleteGame = (game) => {
    openConfirm({
      title: "Delete Game",
      message: `Delete Game ${game.game_no}? This will also recalculate the match score.`,
      confirmText: "Delete",
      variant: "danger",
      onConfirm: async () => {
        try {
          await deleteGame(game.id);
          setMapDrafts((prev) => {
            const next = { ...prev };
            delete next[game.id];
            return next;
          });
          showToast("Game deleted.", "success");
          await loadData();
        } catch (err) {
          console.error("Failed to delete game", err);
          showToast(err?.message || "Failed to delete game.", "error");
        } finally {
          closeConfirm();
        }
      },
    });
  };

  const handleDeleteMatch = (match) => {
    openConfirm({
      title: "Delete Match",
      message: `Delete Match #${match.match_no}? This also removes its games.`,
      confirmText: "Delete",
      variant: "danger",
      onConfirm: async () => {
        try {
          await deleteMatch(match.id);
          if (Number(selectedMatchId) === Number(match.id)) {
            setSelectedMatchId(null);
            setIsGamesOpen(false);
          }
          showToast("Match deleted.", "success");
          await loadData();
        } catch (err) {
          console.error("Failed to delete match", err);
          showToast(err?.message || "Failed to delete match.", "error");
        } finally {
          closeConfirm();
        }
      },
    });
  };

  const toggleMatchActionPanel = (matchId) => {
    setExpandedMatchActions((prev) => ({
      ...prev,
      [matchId]: !prev[matchId],
    }));
  };

  const getGameSides = (gameNo, match) => {
    if (!match) {
      return { blueTeamId: null, redTeamId: null };
    }
    const isEven = Number(gameNo) % 2 === 0;
    return {
      blueTeamId: isEven ? match.red_team_id : match.blue_team_id,
      redTeamId: isEven ? match.blue_team_id : match.red_team_id,
    };
  };

  const statusClass = (status) => {
    if (!status) return "status-badge status-queued";
    return `status-badge status-${status}`;
  };

  const isLiveMatch = (match) => {
    return ["live", "active", "ongoing"].includes(
      String(match?.status || "").toLowerCase()
    );
  };

  const getWinnerLabel = (game) => {
    if (!game.winner_team_id) {
      return "No winner yet";
    }
    return teamNameById[game.winner_team_id] || game.winner_team_id;
  };

  const getSeriesWinnerLabel = (match, winnerTeamId) => {
    if (!winnerTeamId) {
      return "-";
    }

    return (
      teamNameById[winnerTeamId] ||
      (String(winnerTeamId) === String(match?.blue_team_id)
        ? match?.blue_team_id
        : match?.red_team_id) ||
      winnerTeamId
    );
  };

  return (
    <div className="controller-page">
      <div className="toast-container">
        <Toast message={toast.message} type={toast.type} onClose={closeToast} />
      </div>

      <div className="page-header match-page-header">
        <div className="page-title-group">
          <h1>Matches</h1>
          <div className="page-subtitle">Manage match queue, scores, casters, and games.</div>
        </div>
        <div className="toolbar match-toolbar">
          <button type="button" className="button-secondary" onClick={handleLoadNext}>
            Load Next
          </button>
          <button type="button" className="button-primary" onClick={handleNewMatch}>
            + New Match
          </button>
        </div>
      </div>

      <div className="match-section-stack">
        {groupedMatches.map((group) => (
          <section key={group.title} className="modern-card match-queue-card">
            <div className="panel-header">
              <div>
                <h2>{group.title}</h2>
                <div className="helper-text">
                  {group.defaultMode || "BO1"} · {group.matches.length} match
                  {group.matches.length === 1 ? "" : "es"}
                </div>
              </div>
              <button
                type="button"
                className="button-primary"
                onClick={() => handleAddMatchForGroup(group)}
              >
                {`+ Add ${group.title} Match`}
              </button>
            </div>
            <table className="table-modern">
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Teams</th>
                  <th>Casters</th>
                  <th>Status</th>
                  <th>Queue</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {group.matches.map((match) => (
                  <tr key={match.id} className={isLiveMatch(match) ? "is-live-match" : ""}>
                    <td data-label="Match">
                      #{match.match_no} {match.title || ""}
                    </td>
                    <td data-label="Teams">
                      <div className="match-team-score-stack">
                        <div className="match-team-score-pill match-team-score-blue">
                          <span className="match-team-name">
                            {teamNameById[match.blue_team_id] || match.blue_team_id || "-"}
                          </span>
                          <span className="match-team-score">{match.blue_score ?? 0}</span>
                        </div>
                        <div className="match-team-score-pill match-team-score-red">
                          <span className="match-team-name">
                            {teamNameById[match.red_team_id] || match.red_team_id || "-"}
                          </span>
                          <span className="match-team-score">{match.red_score ?? 0}</span>
                        </div>
                      </div>
                    </td>
                    <td data-label="Casters">{formatCasterNames(match.caster_ids) || "-"}</td>
                    <td data-label="Status">
                      <div className="match-status-stack">
                        <span className={statusClass(match.status)}>{match.status}</span>
                        {Number(match.series_completed) === 1 ? (
                          <small className="helper-text">Series Complete</small>
                        ) : null}
                      </div>
                    </td>
                    <td data-label="Queue">{match.queue_order || "-"}</td>
                    <td data-label="Actions">
                      <div className="match-actions">
                        <div className="action-panel-primary">
                          <button
                            type="button"
                            className="button-secondary"
                            onClick={() => handleManageGames(match.id)}
                          >
                            Manage Games
                          </button>
                          <button
                            type="button"
                            className="button-ghost action-toggle"
                            onClick={() => toggleMatchActionPanel(match.id)}
                          >
                            {expandedMatchActions[match.id] ? "Less" : "More"}
                          </button>
                        </div>
                        {expandedMatchActions[match.id] ? (
                          <div className="action-panel">
                            <div className="action-group">
                              <div className="action-group-label">Manage</div>
                              <div className="action-buttons">
                                <button
                                  type="button"
                                  className="button-ghost"
                                  onClick={() => handleEditMatch(match)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="button-danger-outline button-delete"
                                  onClick={() => handleDeleteMatch(match)}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            <div className="action-group">
                              <div className="action-group-label">Match Controls</div>
                              <div className="action-buttons">
                                <button
                                  type="button"
                                  className="button-ghost button-setup"
                                  onClick={() => handleSetupMatch(match.id)}
                                >
                                  Setup
                                </button>
                                <button
                                  type="button"
                                  className="button-success button-start"
                                  onClick={() => handleStartMatch(match.id)}
                                >
                                  Start
                                </button>
                                <button
                                  type="button"
                                  className="button-warning button-finish"
                                  onClick={() => handleFinishMatch(match.id)}
                                >
                                  Finish
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>

      {isNewMatchOpen
        ? createPortal(
            <div className="modal-backdrop">
              <div className="modal-panel match-modal-panel">
                <div className="modal-header">
                  <h3>New Match</h3>
                </div>
                <div className="modal-body">
                  <section className="modal-section">
                    <div className="modal-section-title">Match Setup</div>
                    <div className="form-grid modal-form-grid">
                      <label className="form-group">
                        Match No
                        <input value={nextMatchNo} readOnly />
                        <span className="helper-text">Auto-generated</span>
                      </label>
                      <div className="form-group">
                        Mode
                        <CustomDropdown
                          value={matchForm.mode}
                          options={modeOptions}
                          placeholder="Select mode"
                          onChange={(selectedValue) =>
                            setMatchForm({ ...matchForm, mode: selectedValue })
                          }
                        />
                      </div>
                      <div className="form-group">
                        Title
                        <CustomDropdown
                          value={matchForm.title}
                          options={titleOptions}
                          placeholder="Select title"
                          onChange={(selectedValue) =>
                            setMatchForm({ ...matchForm, title: selectedValue })
                          }
                        />
                      </div>
                      <label className="form-group">
                        Queue Order
                        <input
                          value={matchForm.queue_order}
                          onChange={(event) =>
                            setMatchForm({
                              ...matchForm,
                              queue_order: event.target.value,
                            })
                          }
                          placeholder="Auto"
                        />
                        <span className="helper-text">
                          Leave blank to auto-place this match at the end of the queue.
                        </span>
                      </label>
                    </div>
                  </section>

                  <section className="modal-section">
                    <div className="modal-section-title">Teams</div>
                    <div className="form-grid modal-form-grid">
                      <div className="form-group">
                        Blue Team
                        <CustomDropdown
                          value={matchForm.blue_team_id}
                          options={teamOptions.filter(
                            (team) =>
                              String(team.value) !== String(matchForm.red_team_id || "")
                          )}
                          placeholder="Select team"
                          onChange={(selectedValue) =>
                            setMatchForm({ ...matchForm, blue_team_id: selectedValue })
                          }
                        />
                      </div>
                      <div className="form-group">
                        Red Team
                        <CustomDropdown
                          value={matchForm.red_team_id}
                          options={teamOptions.filter(
                            (team) =>
                              String(team.value) !== String(matchForm.blue_team_id || "")
                          )}
                          placeholder="Select team"
                          onChange={(selectedValue) =>
                            setMatchForm({ ...matchForm, red_team_id: selectedValue })
                          }
                        />
                      </div>
                    </div>
                  </section>

                  <section className="modal-section">
                    <div className="modal-section-title">Casters</div>
                    <div className="checkbox-list">
                      {casters.length ? (
                        casters.map((caster) => (
                          <label key={caster.id} className="checkbox-item">
                            <input
                              type="checkbox"
                              checked={selectedCasterIds.includes(caster.id)}
                              onChange={() => toggleCaster(caster.id)}
                            />
                            {caster.name}
                          </label>
                        ))
                      ) : (
                        <span className="muted">No casters found.</span>
                      )}
                    </div>
                  </section>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={() => setIsNewMatchOpen(false)}
                  >
                    Cancel
                  </button>
                  <button type="button" className="button-primary" onClick={handleMatchSave}>
                    Create Match
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {isEditMatchOpen
        ? createPortal(
            <div className="modal-backdrop">
              <div className="modal-panel match-modal-panel">
                <div className="modal-header">
                  <div className="modal-title-row">
                    <div>
                      <h3>Edit Match</h3>
                      <div className="modal-subtitle">
                        Update match setup, teams, casters, and score.
                      </div>
                    </div>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={openManageGamesFromEdit}
                    >
                      Manage Games
                    </button>
                  </div>
                </div>
                <div className="modal-body">
                  <section className="modal-section">
                    <div className="modal-section-title">Match Setup</div>
                    <div className="form-grid modal-form-grid">
                      <label className="form-group">
                        Match No
                        <input value={matchForm.match_no} readOnly />
                      </label>
                      <div className="form-group">
                        Mode
                        <CustomDropdown
                          value={matchForm.mode}
                          options={modeOptions}
                          placeholder="Select mode"
                          onChange={(selectedValue) =>
                            setMatchForm({ ...matchForm, mode: selectedValue })
                          }
                        />
                      </div>
                      <div className="form-group">
                        Title
                        <CustomDropdown
                          value={matchForm.title}
                          options={titleOptions}
                          placeholder="Select title"
                          onChange={(selectedValue) =>
                            setMatchForm({ ...matchForm, title: selectedValue })
                          }
                        />
                      </div>
                      <label className="form-group">
                        Queue Order
                        <input
                          value={matchForm.queue_order}
                          onChange={(event) =>
                            setMatchForm({
                              ...matchForm,
                              queue_order: event.target.value,
                            })
                          }
                          placeholder="Auto"
                        />
                      </label>
                    </div>
                  </section>

                  <section className="modal-section">
                    <div className="modal-section-title">Teams</div>
                    <div className="form-grid modal-form-grid modal-team-grid">
                      <div className="form-group">
                        Blue Team
                        <CustomDropdown
                          value={matchForm.blue_team_id}
                          options={teamOptions.filter(
                            (team) =>
                              String(team.value) !== String(matchForm.red_team_id || "")
                          )}
                          placeholder="Select team"
                          onChange={(selectedValue) =>
                            setMatchForm({ ...matchForm, blue_team_id: selectedValue })
                          }
                        />
                      </div>
                      <div className="form-group">
                        Red Team
                        <CustomDropdown
                          value={matchForm.red_team_id}
                          options={teamOptions.filter(
                            (team) =>
                              String(team.value) !== String(matchForm.blue_team_id || "")
                          )}
                          placeholder="Select team"
                          onChange={(selectedValue) =>
                            setMatchForm({ ...matchForm, red_team_id: selectedValue })
                          }
                        />
                      </div>
                      <div className="form-group modal-switch-group">
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={handleSwitchTeams}
                        >
                          Switch Teams
                        </button>
                      </div>
                    </div>
                  </section>

                  <section className="modal-section">
                    <div className="modal-section-title">Casters</div>
                    <div className="checkbox-list">
                      {casters.length ? (
                        casters.map((caster) => (
                          <label key={caster.id} className="checkbox-item">
                            <input
                              type="checkbox"
                              checked={selectedCasterIds.includes(caster.id)}
                              onChange={() => toggleCaster(caster.id)}
                            />
                            {caster.name}
                          </label>
                        ))
                      ) : (
                        <span className="muted">No casters found.</span>
                      )}
                    </div>
                  </section>

                  <section className="modal-section">
                    <div className="modal-section-title">Score</div>
                    <div className="form-grid modal-form-grid">
                      <label className="form-group">
                        Blue Score
                        <input
                          type="number"
                          value={matchForm.blue_score}
                          onChange={(event) =>
                            setMatchForm({ ...matchForm, blue_score: event.target.value })
                          }
                        />
                      </label>
                      <label className="form-group">
                        Red Score
                        <input
                          type="number"
                          value={matchForm.red_score}
                          onChange={(event) =>
                            setMatchForm({ ...matchForm, red_score: event.target.value })
                          }
                        />
                      </label>
                    </div>
                  </section>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={() => setIsEditMatchOpen(false)}
                  >
                    Cancel
                  </button>
                  <button type="button" className="button-primary" onClick={handleMatchSave}>
                    Save Changes
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {isGamesOpen && selectedMatch
        ? createPortal(
            <div className="modal-backdrop">
              <div className="modal-panel games-modal-panel">
                <div className="modal-header">
                  <div>
                    <h3>
                      Manage Games - Match #{selectedMatch.match_no} {selectedMatch.title || ""}
                    </h3>
                    <div className="modal-subtitle">
                      {teamNameById[selectedMatch.blue_team_id] || "-"} vs{" "}
                      {teamNameById[selectedMatch.red_team_id] || "-"}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => openEditMatchFromManageGames(selectedMatch)}
                  >
                    Edit Match
                  </button>
                </div>
                <div className="modal-body">
                  <div className="modern-card games-summary-card">
                    <div className="games-summary-item">
                      <span className="games-summary-label">Teams</span>
                      <strong>
                        {teamNameById[selectedMatch.blue_team_id] || "-"} vs{" "}
                        {teamNameById[selectedMatch.red_team_id] || "-"}
                      </strong>
                    </div>
                    <div className="games-summary-item">
                      <span className="games-summary-label">Mode</span>
                      <strong>{selectedMatch.mode || "-"}</strong>
                    </div>
                    <div className="games-summary-item">
                      <span className="games-summary-label">Score</span>
                      <strong>
                        {selectedMatch.blue_score ?? 0} - {selectedMatch.red_score ?? 0}
                      </strong>
                    </div>
                    <div className="games-summary-item">
                      <span className="games-summary-label">Status</span>
                      <span className={statusClass(selectedMatch.status)}>
                        {selectedMatch.status || "queued"}
                      </span>
                    </div>
                    <div className="games-summary-item">
                      <span className="games-summary-label">Series</span>
                      <strong>
                        {selectedMatchSeriesState.blueWins} - {selectedMatchSeriesState.redWins}
                      </strong>
                    </div>
                  </div>

                  {isSelectedMatchSeriesComplete ? (
                    <div className="modern-card game-limit-compact">
                      <span className="game-count-badge">Series Complete</span>
                      <small className="game-limit-warning">
                        Winner:{" "}
                        {getSeriesWinnerLabel(
                          selectedMatch,
                          selectedMatchSeriesState.seriesWinnerTeamId
                        )}
                      </small>
                      <small className="helper-text">
                        Finish match when Results Overlay is no longer needed.
                      </small>
                    </div>
                  ) : null}

                  {isSelectedMatchSeriesComplete ? (
                    <div className="modern-card game-limit-compact">
                      <span className="game-count-badge">
                        Games {gamesForSelectedMatch.length} / {selectedMatchMaxGames}
                      </span>
                      <small className="game-limit-warning">Series already complete.</small>
                    </div>
                  ) : hasReachedSelectedMatchGameLimit ? (
                    <div className="modern-card game-limit-compact">
                      <span className="game-count-badge">
                        Games {gamesForSelectedMatch.length} / {selectedMatchMaxGames}
                      </span>
                      <small className="game-limit-warning">
                        Maximum games reached for {selectedMatch.mode}.
                      </small>
                    </div>
                  ) : (
                    <div className="modern-card games-create-card">
                      <div className="game-record-header">
                        <div>
                          <div className="game-record-title">Add Game</div>
                          <div className="helper-text">
                            Game number stays auto-generated per match.
                          </div>
                        </div>
                        <div className="game-count-badge">
                          Games {gamesForSelectedMatch.length} / {selectedMatchMaxGames}
                        </div>
                      </div>
                      <div className="form-grid games-create-grid">
                        <label className="form-group">
                          Game No
                          <input value={nextGameNo || ""} readOnly />
                          <span className="helper-text">Auto per match</span>
                        </label>
                        <div className="form-group">
                          Map
                          <CustomDropdown
                            value={gameForm.map_id}
                            options={addGameMapOptions}
                            placeholder="Select map"
                            onChange={(selectedValue) => setGameForm({ map_id: selectedValue })}
                          />
                          <span className="helper-text">
                            Map can be assigned now and revealed later.
                          </span>
                        </div>
                        <div className="form-actions games-create-actions">
                          <button
                            type="button"
                            className="button-primary"
                            onClick={handleAddGame}
                          >
                            Add Game
                          </button>
                        </div>
                      </div>
                      <div className="helper-text">
                        Maximum {selectedMatchMaxGames} games for {selectedMatch.mode}.
                      </div>
                    </div>
                  )}

                  <div className="games-grid">
                    {gamesForSelectedMatch.length ? (
                      gamesForSelectedMatch.map((game) => {
                        const sides = getGameSides(game.game_no, selectedMatch);
                        const blueSideName = sides.blueTeamId
                          ? teamNameById[sides.blueTeamId] || sides.blueTeamId
                          : "-";
                        const redSideName = sides.redTeamId
                          ? teamNameById[sides.redTeamId] || sides.redTeamId
                          : "-";
                        const mapValue = mapDrafts[game.id] ?? game.map_id ?? "";
                        const hasMapChanged =
                          String(mapDrafts[game.id] ?? "") !== String(game.map_id ?? "");
                        const isGameFinished =
                          String(game.status || "").toLowerCase() === "finished";
                        const isUnnecessaryExtraGame =
                          isSelectedMatchSeriesComplete && !isGameFinished && !game.winner_team_id;

                        return (
                          <article key={game.id} className="game-record-card">
                            <div className="game-record-header">
                              <div>
                                <div className="game-record-title">Game {game.game_no}</div>
                                <div className="helper-text">
                                  Sides auto-switch on even game numbers.
                                </div>
                              </div>
                              <span className={statusClass(game.status)}>
                                {game.status || "queued"}
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
                                      value={mapValue}
                                      options={mapOptions}
                                      placeholder="Select map"
                                      onChange={(selectedValue) =>
                                        handleMapDraftChange(game.id, selectedValue)
                                      }
                                    />
                                    {hasMapChanged ? (
                                      <button
                                        type="button"
                                        className="button-ghost button-compact save-map-btn"
                                        onClick={() => handleSaveGameMap(game.id)}
                                      >
                                        Save Map
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              </div>

                              <div className="game-record-section">
                                <div className="game-record-label">Winner</div>
                                <div className="winner-label">{getWinnerLabel(game)}</div>
                                {isUnnecessaryExtraGame ? (
                                  <div className="helper-text">Series already complete.</div>
                                ) : null}
                              </div>
                            </div>

                            <div className="game-record-actions">
                              <div className="game-action-group status-actions">
                                <div className="action-group-label">Status</div>
                                <div className="action-buttons">
                                  <button
                                    type="button"
                                    className="button-ghost button-setup"
                                    onClick={() => handleGameStatus(game, "setup")}
                                    disabled={isUnnecessaryExtraGame}
                                  >
                                    Setup
                                  </button>
                                  <button
                                    type="button"
                                    className="button-success button-start"
                                    onClick={() => handleGameStatus(game, "live")}
                                    disabled={isUnnecessaryExtraGame}
                                  >
                                    Start
                                  </button>
                                  <button
                                    type="button"
                                    className="button-warning button-finish"
                                    onClick={() => handleFinishGame(game)}
                                    disabled={isUnnecessaryExtraGame}
                                  >
                                    Finish
                                  </button>
                                </div>
                              </div>
                              <div className="game-action-group scoring-actions">
                                <div className="action-group-label">Scoring</div>
                                <div className="action-buttons">
                                  <button
                                    type="button"
                                    className="button-blue button-winner-blue"
                                    onClick={() =>
                                      handleWinner(game, sides.blueTeamId, blueSideName)
                                    }
                                    disabled={!sides.blueTeamId || isUnnecessaryExtraGame}
                                  >
                                    Winner Blue
                                  </button>
                                  <button
                                    type="button"
                                    className="button-red button-winner-red"
                                    onClick={() =>
                                      handleWinner(game, sides.redTeamId, redSideName)
                                    }
                                    disabled={!sides.redTeamId || isUnnecessaryExtraGame}
                                  >
                                    Winner Red
                                  </button>
                                  <button
                                    type="button"
                                    className="button-ghost button-reset"
                                    onClick={() => handleResetGameResult(game)}
                                  >
                                    Reset
                                  </button>
                                </div>
                              </div>
                              <div className="game-action-group game-action-group-danger danger-actions">
                                <div className="action-group-label">Danger</div>
                                <div className="action-buttons">
                                  <button
                                    type="button"
                                    className="button-danger-outline button-delete"
                                    onClick={() => handleDeleteGame(game)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          </article>
                        );
                      })
                    ) : (
                      <div className="modern-card muted">No games yet for this match.</div>
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={() => setIsGamesOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

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

export default MatchConfig;
