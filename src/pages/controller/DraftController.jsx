import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import ConfirmationModal from "../../components/common/ConfirmationModal";
import Toast from "../../components/common/Toast";
import {
  createDraftAction,
  clearDraftSlots,
  createDraftSession,
  getCurrentOverlayData,
  getDraftSession,
  getDraftSlots,
  getHeroes,
  getMaps,
  saveDraftSlots,
  updateGame,
  updateDraftSession,
} from "../../services/api";
import { resolveAssetUrl } from "../../utils/assetUrl";

const ROLE_OPTIONS = [
  "Tank",
  "Fighter",
  "Assassin",
  "Mage",
  "Marksman",
  "Support",
];

const LANE_OPTIONS = ["Gold Lane", "Jungle", "Roam", "Mid Lane", "Exp Lane"];

const splitCsv = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const hasCsvValue = (value, selected) => {
  if (!selected || selected === "All") return true;
  return splitCsv(value).some((item) => item.toLowerCase() === selected.toLowerCase());
};

const matchesSearch = (hero, search) => {
  const keyword = String(search || "").trim().toLowerCase();
  if (!keyword) return true;
  return String(hero?.name || "").toLowerCase().includes(keyword);
};

const DRAFT_PHASES = [
  {
    id: 1,
    label: "Blue Ban 1",
    duration: 50,
    slots: [{ team: "blue", type: "ban", index: 0, actionOrder: 1 }],
  },
  {
    id: 2,
    label: "Red Ban 1",
    duration: 50,
    slots: [{ team: "red", type: "ban", index: 0, actionOrder: 2 }],
  },
  {
    id: 3,
    label: "Blue Ban 2",
    duration: 50,
    slots: [{ team: "blue", type: "ban", index: 1, actionOrder: 3 }],
  },
  {
    id: 4,
    label: "Red Ban 2",
    duration: 50,
    slots: [{ team: "red", type: "ban", index: 1, actionOrder: 4 }],
  },
  {
    id: 5,
    label: "Blue Ban 3",
    duration: 50,
    slots: [{ team: "blue", type: "ban", index: 2, actionOrder: 5 }],
  },
  {
    id: 6,
    label: "Red Ban 3",
    duration: 50,
    slots: [{ team: "red", type: "ban", index: 2, actionOrder: 6 }],
  },
  {
    id: 7,
    label: "Blue Pick 1",
    duration: 50,
    slots: [{ team: "blue", type: "pick", index: 0, actionOrder: 7 }],
  },
  {
    id: 8,
    label: "Red Pick 1 & 2",
    duration: 50,
    slots: [
      { team: "red", type: "pick", index: 0, actionOrder: 8 },
      { team: "red", type: "pick", index: 1, actionOrder: 9 },
    ],
  },
  {
    id: 9,
    label: "Blue Pick 2 & 3",
    duration: 50,
    slots: [
      { team: "blue", type: "pick", index: 1, actionOrder: 10 },
      { team: "blue", type: "pick", index: 2, actionOrder: 11 },
    ],
  },
  {
    id: 10,
    label: "Red Pick 3",
    duration: 50,
    slots: [{ team: "red", type: "pick", index: 2, actionOrder: 12 }],
  },
  {
    id: 11,
    label: "Red Ban 4",
    duration: 50,
    slots: [{ team: "red", type: "ban", index: 3, actionOrder: 13 }],
  },
  {
    id: 12,
    label: "Blue Ban 4",
    duration: 50,
    slots: [{ team: "blue", type: "ban", index: 3, actionOrder: 14 }],
  },
  {
    id: 13,
    label: "Red Ban 5",
    duration: 50,
    slots: [{ team: "red", type: "ban", index: 4, actionOrder: 15 }],
  },
  {
    id: 14,
    label: "Blue Ban 5",
    duration: 50,
    slots: [{ team: "blue", type: "ban", index: 4, actionOrder: 16 }],
  },
  {
    id: 15,
    label: "Red Pick 4",
    duration: 50,
    slots: [{ team: "red", type: "pick", index: 3, actionOrder: 17 }],
  },
  {
    id: 16,
    label: "Blue Pick 4 & 5",
    duration: 50,
    slots: [
      { team: "blue", type: "pick", index: 3, actionOrder: 18 },
      { team: "blue", type: "pick", index: 4, actionOrder: 19 },
    ],
  },
  {
    id: 17,
    label: "Red Pick 5",
    duration: 50,
    slots: [{ team: "red", type: "pick", index: 4, actionOrder: 20 }],
  },
];

const slotKey = (slot) => `${slot.team}-${slot.type}-${slot.index}`;

const SLOT_DEFS = DRAFT_PHASES.flatMap((phase) => phase.slots || []);
const SLOT_BY_KEY = SLOT_DEFS.reduce((acc, slot) => {
  acc[slotKey(slot)] = slot;
  return acc;
}, {});

const buildInitialDraftState = () => ({
  phaseIndex: 0,
  blue: {
    bans: [null, null, null, null, null],
    picks: [null, null, null, null, null],
  },
  red: {
    bans: [null, null, null, null, null],
    picks: [null, null, null, null, null],
  },
  timer: {
    remaining: DRAFT_PHASES[0].duration,
    running: false,
  },
  status: "idle",
});

const normalizeSlotArray = (value, size) => {
  const arr = Array.isArray(value) ? value : [];
  return Array.from({ length: size }, (_, index) => arr[index] || null);
};

const getSlotLabel = (slot) =>
  `${slot.type === "ban" ? "Ban" : "Pick"} ${slot.index + 1}`;

const formatTimer = (seconds) => {
  const total = Math.max(0, Number(seconds || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return mins > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : `${secs}`;
};

const getMapImagePath = (map) =>
  map?.map_image || map?.image_path || map?.image || map?.icon_path || "";

function DraftController() {
  const [overlayData, setOverlayData] = useState(null);
  const [heroes, setHeroes] = useState([]);
  const [maps, setMaps] = useState([]);
  const [selectedMap, setSelectedMap] = useState(null);
  const [draftSession, setDraftSession] = useState(null);
  const [draftState, setDraftState] = useState(buildInitialDraftState);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedRoleTab, setSelectedRoleTab] = useState("All");
  const [selectedLaneFilter, setSelectedLaneFilter] = useState("All");
  const [heroSearch, setHeroSearch] = useState("");
  const [toast, setToast] = useState({ message: "", type: "info" });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [hasLoadedSession, setHasLoadedSession] = useState(false);
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    variant: "",
    onConfirm: () => {},
  });

  const currentGame = overlayData?.game || null;
  const currentMatch = overlayData?.match || null;
  const blueTeam = overlayData?.overlay_blue_team || overlayData?.blue_team || null;
  const redTeam = overlayData?.overlay_red_team || overlayData?.red_team || null;
  const currentGameId = currentGame?.id || null;
  const currentGameNumber = currentGame?.game_no || null;
  const currentMatchId = currentMatch?.id || null;
  const visibleMaps = maps.slice(0, 4);
  const selectedMapImagePath = getMapImagePath(selectedMap);

  const heroesById = useMemo(() => {
    const map = new Map();
    heroes.forEach((hero) => {
      map.set(hero.id, hero);
    });
    return map;
  }, [heroes]);

  const getSlotMeta = (slot) => SLOT_BY_KEY[slotKey(slot)] || slot;

  const getSlotHero = (draft, slot) => {
    const group = slot.type === "ban" ? "bans" : "picks";
    return draft?.[slot.team]?.[group]?.[slot.index] || null;
  };

  const isHeroAlreadyUsed = (heroId, ignoreSlot) => {
    if (!heroId) return false;
    const shouldIgnore = (slot) =>
      ignoreSlot &&
      slot.team === ignoreSlot.team &&
      slot.type === ignoreSlot.type &&
      slot.index === ignoreSlot.index;

    const checkSlots = (team, type, list) => {
      for (let index = 0; index < list.length; index += 1) {
        const slot = { team, type, index };
        if (shouldIgnore(slot)) {
          continue;
        }
        const hero = list[index];
        if (hero?.id === heroId) {
          return true;
        }
      }
      return false;
    };

    return (
      checkSlots("blue", "ban", draftState.blue.bans) ||
      checkSlots("red", "ban", draftState.red.bans) ||
      checkSlots("blue", "pick", draftState.blue.picks) ||
      checkSlots("red", "pick", draftState.red.picks)
    );
  };

  const areSlotsComplete = (draft) => {
    const allSlots = [
      ...draft.blue.bans,
      ...draft.red.bans,
      ...draft.blue.picks,
      ...draft.red.picks,
    ];
    return allSlots.every((hero) => hero?.id);
  };

  const isDraftEmpty = (draft) => {
    const allSlots = [
      ...draft.blue.bans,
      ...draft.red.bans,
      ...draft.blue.picks,
      ...draft.red.picks,
    ];
    return allSlots.every((hero) => !hero?.id);
  };

  const currentPhase = DRAFT_PHASES[draftState.phaseIndex] || DRAFT_PHASES[0];

  const closeToast = () => setToast({ message: "", type: "info" });

  const showToast = (message, type = "info") => {
    setToast({ message, type });
  };

  useEffect(() => {
    const stored = localStorage.getItem("jeizi_draft_simulation_mode");
    if (stored) {
      setIsSimulationMode(stored === "true");
    }
  }, []);

  useEffect(() => {
    if (overlayData?.map) {
      setSelectedMap(overlayData.map);
      return;
    }

    if (currentGame?.map_id != null) {
      const matchedMap = maps.find((map) => String(map.id) === String(currentGame.map_id));
      setSelectedMap(matchedMap || null);
      return;
    }

    setSelectedMap(null);
  }, [currentGame?.id, currentGame?.map_id, overlayData?.map, maps]);

  const closeConfirm = () => {
    setConfirmState((prev) => ({
      ...prev,
      open: false,
      onConfirm: () => {},
    }));
  };

  const openConfirm = ({
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "",
    onConfirm,
  }) => {
    setConfirmState({
      open: true,
      title,
      message,
      confirmText,
      cancelText,
      variant,
      onConfirm,
    });
  };
  const buildHeroFromSlot = (slot) => {
    if (!slot?.hero_id) return null;
    return (
      heroesById.get(slot.hero_id) || {
        id: slot.hero_id,
        name: slot.hero_name || "Unknown",
        role: slot.hero_role || "",
        lane: slot.hero_lane || "",
        image_path: slot.hero_image_path || "",
      }
    );
  };

  const buildDraftFromSlots = (slots = [], session = null) => {
    const nextDraft = buildInitialDraftState();
    nextDraft.blue.bans = normalizeSlotArray(nextDraft.blue.bans, 5);
    nextDraft.red.bans = normalizeSlotArray(nextDraft.red.bans, 5);
    nextDraft.blue.picks = normalizeSlotArray(nextDraft.blue.picks, 5);
    nextDraft.red.picks = normalizeSlotArray(nextDraft.red.picks, 5);

    slots.forEach((slot) => {
      const team = String(slot.team_side || "").toLowerCase();
      const type = String(slot.slot_type || "").toLowerCase();
      if (!nextDraft[team]) return;
      const group = type === "ban" ? "bans" : type === "pick" ? "picks" : null;
      if (!group) return;
      const index = Number(slot.slot_index || 0);
      if (!Number.isFinite(index)) return;
      nextDraft[team][group][index] = buildHeroFromSlot(slot);
    });

    if (session) {
      const nextPhaseIndex = Number.isFinite(Number(session.phase_index))
        ? Number(session.phase_index)
        : getFirstIncompletePhaseIndex(nextDraft);
      const phase = DRAFT_PHASES[nextPhaseIndex] || DRAFT_PHASES[0];
      nextDraft.phaseIndex = nextPhaseIndex;
      nextDraft.timer.remaining = Number.isFinite(Number(session.timer_remaining))
        ? Number(session.timer_remaining)
        : phase.duration;
      nextDraft.timer.running = Boolean(session.timer_running);
      nextDraft.status = session.status || nextDraft.status;
    }

    return nextDraft;
  };

  const isSlotFilled = (draft, slot) => {
    const group = slot.type === "ban" ? "bans" : "picks";
    return Boolean(draft?.[slot.team]?.[group]?.[slot.index]);
  };

  const isSlotInPhase = (slot, phase) =>
    Boolean(
      phase?.slots?.some(
        (phaseSlot) =>
          phaseSlot.team === slot.team &&
          phaseSlot.type === slot.type &&
          phaseSlot.index === slot.index
      )
    );

  const isPhaseComplete = (draft, phase) =>
    Boolean(
      phase?.slots?.length &&
        phase.slots.every((slot) => isSlotFilled(draft, slot))
    );

  const getFirstIncompletePhaseIndex = (draft) => {
    const index = DRAFT_PHASES.findIndex(
      (phase) => phase.slots.length && !isPhaseComplete(draft, phase)
    );
    return index === -1 ? DRAFT_PHASES.length - 1 : index;
  };

  const applyHeroToDraft = (draft, slot, hero) => {
    const group = slot.type === "ban" ? "bans" : "picks";
    const nextGroup = draft[slot.team][group].map((item, idx) =>
      idx === slot.index ? hero : item
    );
    return {
      ...draft,
      [slot.team]: {
        ...draft[slot.team],
        [group]: nextGroup,
      },
    };
  };

  const advanceDraftState = (draft, nextIndex, nextRunning) => {
    const clampedIndex = Math.min(Math.max(nextIndex, 0), DRAFT_PHASES.length - 1);
    const nextPhase = DRAFT_PHASES[clampedIndex] || DRAFT_PHASES[0];
    return {
      ...draft,
      phaseIndex: clampedIndex,
      timer: {
        remaining: nextPhase.duration,
        running: Boolean(nextRunning),
      },
    };
  };

  const persistSession = async (updates) => {
    if (isSimulationMode) {
      return null;
    }
    if (!draftSession?.id) {
      return null;
    }
    try {
      const updated = await updateDraftSession(draftSession.id, updates);
      setDraftSession(updated || { ...draftSession, ...updates });
      return updated;
    } catch (error) {
      showToast(error?.message || "Failed to update draft session.", "error");
      return null;
    }
  };

  const loadDraftSession = async () => {
    if (!currentMatchId || !currentGameNumber) {
      setDraftSession(null);
      setDraftState(buildInitialDraftState());
      return;
    }

    if (isSimulationMode) {
      setDraftSession(null);
      setDraftState(buildInitialDraftState());
      setSelectedSlot(null);
      return;
    }

    const existingSession = await getDraftSession(currentMatchId, currentGameNumber);
    let session = existingSession;
    if (!session) {
      session = await createDraftSession({
        match_id: currentMatchId,
        game_id: currentGameId || null,
        game_number: currentGameNumber,
        blue_team_id: blueTeam?.id || null,
        red_team_id: redTeam?.id || null,
        mode: currentMatch?.mode || null,
        phase_index: 0,
        phase_label: DRAFT_PHASES[0].label,
        timer_remaining: DRAFT_PHASES[0].duration,
        timer_running: 0,
        status: "idle",
      });
    }

    setDraftSession(session);
    const slots = await getDraftSlots(session.id);
    const nextDraft = buildDraftFromSlots(slots, session);
    setDraftState(nextDraft);
    setSelectedSlot(null);
    if (!hasLoadedSession) {
      showToast("Draft session loaded.", "info");
      setHasLoadedSession(true);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadBaseData = async () => {
      setIsLoading(true);
      setLoadError("");
      try {
        const [heroResult, overlayResult, mapsResult] = await Promise.allSettled([
          getHeroes(),
          getCurrentOverlayData(),
          getMaps(),
        ]);
        if (heroResult.status !== "fulfilled" || overlayResult.status !== "fulfilled") {
          throw new Error(
            heroResult.status !== "fulfilled"
              ? heroResult.reason?.message || "Failed to load draft data."
              : overlayResult.reason?.message || "Failed to load draft data."
          );
        }
        if (!isMounted) return;
        setHeroes(heroResult.value || []);
        setOverlayData(overlayResult.value || null);
        if (mapsResult.status === "fulfilled") {
          setMaps(mapsResult.value || []);
        } else {
          setMaps([]);
          showToast(mapsResult.reason?.message || "Failed to load maps.", "error");
        }
      } catch (error) {
        if (!isMounted) return;
        setLoadError(error?.message || "Failed to load draft data.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadBaseData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      try {
        await loadDraftSession();
      } catch (error) {
        if (!isMounted) return;
        showToast(error?.message || "Failed to load draft session.", "error");
      }
    };

    loadSession();

    return () => {
      isMounted = false;
    };
  }, [currentMatchId, currentGameNumber, currentGameId, heroesById, isSimulationMode]);

  useEffect(() => {
    if (!draftState.timer.running) {
      return undefined;
    }

    const interval = setInterval(() => {
      setDraftState((prev) => {
        if (!prev.timer.running) return prev;
        const nextRemaining = Math.max(prev.timer.remaining - 1, 0);
        return {
          ...prev,
          timer: {
            remaining: nextRemaining,
            running: nextRemaining > 0 ? prev.timer.running : false,
          },
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [draftState.timer.running]);

  const toggleTimer = () => {
    const nextRunning = draftState.timer.remaining > 0 ? !draftState.timer.running : false;
    setDraftState((prev) => ({
      ...prev,
      timer: {
        ...prev.timer,
        running: nextRunning,
      },
    }));
    persistSession({
      phase_index: draftState.phaseIndex,
      phase_label: currentPhase.label,
      timer_remaining: draftState.timer.remaining,
      timer_running: nextRunning ? 1 : 0,
      status: "drafting",
    });
    if (isSimulationMode) {
      showToast("Simulation mode: changes are not saved.", "info");
    }
  };

  const resetTimer = () => {
    setDraftState((prev) => ({
      ...prev,
      timer: { remaining: currentPhase.duration, running: false },
    }));
    persistSession({
      phase_index: draftState.phaseIndex,
      phase_label: currentPhase.label,
      timer_remaining: currentPhase.duration,
      timer_running: 0,
      status: "drafting",
    });
    if (isSimulationMode) {
      showToast("Simulation mode: changes are not saved.", "info");
    }
  };

  const goToPhase = (nextIndex, keepRunning = true) => {
    const clampedIndex = Math.min(Math.max(nextIndex, 0), DRAFT_PHASES.length - 1);
    const nextPhase = DRAFT_PHASES[clampedIndex] || currentPhase;
    setDraftState((prev) =>
      advanceDraftState(prev, clampedIndex, keepRunning ? prev.timer.running : false)
    );
    persistSession({
      phase_index: clampedIndex,
      phase_label: nextPhase.label,
      timer_remaining: nextPhase.duration,
      timer_running: keepRunning && draftState.timer.running ? 1 : 0,
      status: "drafting",
    });
    if (isSimulationMode) {
      showToast("Simulation mode: changes are not saved.", "info");
    }
  };

  const goNextPhase = () => {
    goToPhase(draftState.phaseIndex + 1, true);
    setSelectedSlot(null);
  };

  const goPrevPhase = () => {
    goToPhase(draftState.phaseIndex - 1, false);
    setSelectedSlot(null);
  };

  const getActiveTargetSlot = () => {
    if (!currentPhase?.slots?.length) return null;
    return currentPhase.slots.find((slot) => !isSlotFilled(draftState, slot)) || null;
  };

  const logDraftAction = async (slot, hero, phaseIndex, phaseLabel) => {
    if (isSimulationMode) {
      return;
    }
    await createDraftAction({
      draft_session_id: draftSession?.id || null,
      game_id: currentGameId ? Number(currentGameId) : null,
      team_side: slot.team === "red" ? "RED" : "BLUE",
      action_type: slot.type === "ban" ? "BAN" : "PICK",
      hero_id: hero?.id || null,
      action_order: slot.actionOrder || null,
      phase_index: phaseIndex,
      phase_label: phaseLabel,
      slot_index: slot.index,
      locked: true,
    });
  };

  const buildSlotPayloads = (draft) => {
    const payloads = [];
    const pushSlots = (team, type, list) => {
      list.forEach((hero, index) => {
        payloads.push({
          team_side: team,
          slot_type: type,
          slot_index: index,
          phase_index: draft.phaseIndex,
          phase_label: DRAFT_PHASES[draft.phaseIndex]?.label || currentPhase.label,
          hero_id: hero?.id || null,
          hero_name: hero?.name || null,
          hero_role: hero?.role || null,
          hero_lane: hero?.lane || null,
          hero_image_path: hero?.image_path || null,
          is_locked: 1,
        });
      });
    };

    pushSlots("blue", "ban", draft.blue.bans);
    pushSlots("red", "ban", draft.red.bans);
    pushSlots("blue", "pick", draft.blue.picks);
    pushSlots("red", "pick", draft.red.picks);
    return payloads;
  };

  const handleSaveSlots = async () => {
    if (isSimulationMode) {
      showToast("Disable Simulation Mode to save draft slots.", "info");
      return;
    }
    if (!draftSession?.id) {
      showToast("No active draft session.", "error");
      return;
    }
    if (!areSlotsComplete(draftState)) {
      showToast("Complete all draft slots before saving.", "warning");
      return;
    }

    try {
      const slots = buildSlotPayloads(draftState);
      await saveDraftSlots(draftSession.id, { slots });
      await persistSession({
        status: "locked",
        timer_running: 0,
        timer_remaining: 0,
        set_completed_at: !draftSession?.completed_at,
        set_locked_at: true,
      });
      showToast("Draft slots saved.", "success");
    } catch (error) {
      showToast(error?.message || "Failed to save draft slots.", "error");
    }
  };

  const handleHeroSelect = async (hero) => {
    if (!currentGameId) {
      showToast("No active match selected.", "error");
      return;
    }

    const rawSlot = selectedSlot || getActiveTargetSlot();
    const targetSlot = rawSlot ? getSlotMeta(rawSlot) : null;
    if (!targetSlot) {
      showToast("Select a draft slot first.", "warning");
      return;
    }

    const existingHero = getSlotHero(draftState, targetSlot);
    const isReplacement = Boolean(selectedSlot && existingHero?.id && existingHero.id !== hero.id);
    if (isHeroAlreadyUsed(hero.id, targetSlot) && existingHero?.id !== hero.id) {
      showToast("That hero is already used.", "warning");
      return;
    }
    let nextDraft = draftState;
    let shouldAdvance = false;
    let shouldStart = false;
    let shouldComplete = false;
    let nextPhaseIndex = draftState.phaseIndex;
    let phaseIndexAtSelection = draftState.phaseIndex;
    let phaseLabelAtSelection = currentPhase.label;
    let nextPhaseLabel = currentPhase.label;
    let nextTimerRunning = draftState.timer.running;
    let nextTimerRemaining = draftState.timer.remaining;

    setDraftState((prev) => {
      const phaseAtSelection = DRAFT_PHASES[prev.phaseIndex] || currentPhase;
      const wasEmpty = isDraftEmpty(prev);
      const updated = applyHeroToDraft(prev, targetSlot, hero);
      shouldStart = wasEmpty;
      shouldAdvance =
        isSlotInPhase(targetSlot, phaseAtSelection) && isPhaseComplete(updated, phaseAtSelection);
      phaseIndexAtSelection = prev.phaseIndex;
      phaseLabelAtSelection = phaseAtSelection.label;
      nextTimerRunning = shouldStart ? true : prev.timer.running;
      const nextBaseRemaining =
        Number.isFinite(prev.timer.remaining) && prev.timer.remaining > 0
          ? prev.timer.remaining
          : phaseAtSelection.duration;

      const rawNextPhaseIndex = shouldAdvance ? prev.phaseIndex + 1 : prev.phaseIndex;
      nextPhaseIndex = Math.min(rawNextPhaseIndex, DRAFT_PHASES.length - 1);
      const nextPhase = DRAFT_PHASES[nextPhaseIndex] || phaseAtSelection;
      nextPhaseLabel = nextPhase.label;
      nextTimerRemaining = shouldAdvance ? nextPhase.duration : nextBaseRemaining;
      nextDraft = shouldAdvance
        ? advanceDraftState(updated, nextPhaseIndex, nextTimerRunning)
        : {
            ...updated,
            timer: {
              remaining: nextBaseRemaining,
              running: nextTimerRunning,
            },
          };

      shouldComplete = areSlotsComplete(nextDraft);
      if (shouldComplete) {
        nextDraft = {
          ...nextDraft,
          timer: {
            remaining: 0,
            running: false,
          },
          status: "completed",
        };
        nextTimerRunning = false;
        nextTimerRemaining = 0;
      }
      return nextDraft;
    });
    setSelectedSlot(null);

    try {
      try {
        await logDraftAction(targetSlot, hero, phaseIndexAtSelection, phaseLabelAtSelection);
      } catch (error) {
        showToast(error?.message || "Failed to create draft action.", "error");
      }
      showToast(
        isSimulationMode
          ? "Simulation mode: changes are not saved."
          : isReplacement
            ? "Hero replaced."
            : "Hero selected.",
        isSimulationMode ? "info" : "success"
      );

      if (!isSimulationMode && (shouldAdvance || shouldStart || shouldComplete)) {
        await persistSession({
          phase_index: shouldAdvance ? nextPhaseIndex : phaseIndexAtSelection,
          phase_label: shouldAdvance ? nextPhaseLabel : phaseLabelAtSelection,
          timer_remaining: shouldAdvance ? nextTimerRemaining : nextTimerRemaining,
          timer_running: nextTimerRunning ? 1 : 0,
          status: shouldComplete
            ? "completed"
            : shouldStart || shouldAdvance
              ? "drafting"
              : undefined,
          set_started_at: shouldStart && !draftSession?.started_at,
          set_completed_at: shouldComplete && !draftSession?.completed_at,
        });
      }
    } catch (error) {
      showToast(error?.message || "Failed to save draft action.", "error");
    }
  };

  const handleResetDraft = () => {
    openConfirm({
      title: "Reset Draft",
      message: "Clear all picks and bans for this game?",
      confirmText: "Reset Draft",
      variant: "danger",
      onConfirm: async () => {
        try {
          if (isSimulationMode) {
            setDraftState(buildInitialDraftState());
            setSelectedSlot(null);
            showToast("Simulation draft reset.", "info");
          } else if (draftSession?.id) {
            await clearDraftSlots(draftSession.id);
            await persistSession({
              phase_index: 0,
              phase_label: DRAFT_PHASES[0].label,
              timer_remaining: DRAFT_PHASES[0].duration,
              timer_running: 0,
              status: "idle",
              clear_started_at: true,
              clear_completed_at: true,
              clear_locked_at: true,
            });
            setDraftState(buildInitialDraftState());
            setSelectedSlot(null);
            showToast("Draft reset.", "success");
          }
        } catch (error) {
          showToast(error?.message || "Failed to reset draft.", "error");
        } finally {
          closeConfirm();
        }
      },
    });
  };

  const syncSelectedMapState = (map) => {
    setSelectedMap(map);
    setOverlayData((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        game: prev.game
          ? {
              ...prev.game,
              map_id: map?.id || null,
            }
          : prev.game,
        map,
      };
    });
  };

  const applyMapSelection = async (map, successMessage) => {
    const previousMap = selectedMap;
    syncSelectedMapState(map);

    if (!isSimulationMode && currentGameId) {
      try {
        await updateGame(currentGameId, { map_id: map?.id || null });
      } catch (error) {
        syncSelectedMapState(previousMap);
        showToast(error?.message || "Failed to save map.", "error");
        return;
      }
    }

    showToast(successMessage, map ? "success" : "info");
  };

  const handleSelectMap = async (map) => {
    if (!visibleMaps.length) {
      showToast("No maps available.", "warning");
      return;
    }

    await applyMapSelection(map, `Map selected: ${map.name}`);
  };

  const handleClearMap = async () => {
    await applyMapSelection(null, "Map cleared.");
  };

  const filteredHeroes = heroes.filter(
    (hero) =>
      hasCsvValue(hero.role, selectedRoleTab) &&
      hasCsvValue(hero.lane, selectedLaneFilter) &&
      matchesSearch(hero, heroSearch)
  );

  const renderSlotCard = (slot) => {
    const slotMeta = getSlotMeta(slot);
    const group = slot.type === "ban" ? "bans" : "picks";
    const hero = draftState[slot.team][group][slot.index];
    const activeSlot = selectedSlot || getActiveTargetSlot();
    const isPhaseTarget = isSlotInPhase(slot, currentPhase);
    const isActive =
      isPhaseTarget ||
      (activeSlot &&
        activeSlot.team === slot.team &&
        activeSlot.type === slot.type &&
        activeSlot.index === slot.index);
    const isSelected =
      selectedSlot &&
      selectedSlot.team === slot.team &&
      selectedSlot.type === slot.type &&
      selectedSlot.index === slot.index;

    const hasImage = Boolean(hero?.image_path);
    const shouldGlow = isPhaseTarget && !hasImage;
    const slotClassName = [
      `draft-slot draft-slot--${slot.type}`,
      hasImage ? "is-filled" : "",
      isActive ? "is-active" : "",
      isSelected ? "is-selected" : "",
      shouldGlow ? "is-active-empty" : "",
      shouldGlow ? `is-active-${slot.type}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    return (
      <button
        key={`${slot.team}-${slot.type}-${slot.index}`}
        type="button"
        className={slotClassName}
        onClick={() =>
          setSelectedSlot((prev) =>
            prev &&
            prev.team === slotMeta.team &&
            prev.type === slotMeta.type &&
            prev.index === slotMeta.index
              ? null
              : slotMeta
          )
        }
      >
        {hasImage ? (
          <img
            className="draft-slot-cover"
            src={resolveAssetUrl(hero.image_path)}
            alt={hero.name}
          />
        ) : hero ? (
          <div className="draft-slot-placeholder">{hero.name}</div>
        ) : (
          <div className="draft-slot-placeholder">{getSlotLabel(slot)}</div>
        )}
      </button>
    );
  };

  return (
    <div className="controller-page">
      <div className="toast-container">
        <Toast message={toast.message} type={toast.type} onClose={closeToast} />
      </div>

      <div className="page-header match-page-header">
        <div className="page-title-group">
          <h1>Draft Controller</h1>
          <div className="page-subtitle">Run MLBB draft picks and bans live.</div>
        </div>
        <div className="toolbar match-toolbar">
          <button
            type="button"
            className={isSimulationMode ? "button-secondary" : "button-ghost"}
            onClick={() => {
              const nextValue = !isSimulationMode;
              setIsSimulationMode(nextValue);
              localStorage.setItem("jeizi_draft_simulation_mode", String(nextValue));
              if (nextValue) {
                setDraftState(buildInitialDraftState());
                setSelectedSlot(null);
                showToast("Simulation mode enabled. Local draft reset.", "info");
              } else {
                showToast("Database draft mode restored.", "success");
              }
            }}
          >
            {isSimulationMode ? "Simulation Mode: On" : "Simulation Mode"}
          </button>
          <button
            type="button"
            className="button-primary"
            onClick={handleSaveSlots}
            disabled={!areSlotsComplete(draftState) || isSimulationMode}
          >
            Save Slots
          </button>
          <button type="button" className="button-danger" onClick={handleResetDraft}>
            Reset Draft
          </button>
        </div>
      </div>

      <section className="draft-controller">
        {isLoading ? <div className="draft-message">Loading draft data...</div> : null}
        {loadError ? <div className="draft-message is-error">{loadError}</div> : null}

        <div className="draft-context-card">
          {isSimulationMode ? (
            <div className="draft-message is-warning">
              <strong>SIMULATION MODE</strong>
              <span>Database saving disabled.</span>
            </div>
          ) : null}
          <div className="draft-message">
            {areSlotsComplete(draftState) ? "Ready to save slots." : "Drafting in progress."}
          </div>
          <div className="draft-context-row">
            <div className="draft-context-item">
              <span className="draft-context-label">Match</span>
              <span className="draft-context-value">
                {currentMatch
                  ? currentMatch.title || currentMatch.round_name || `Match ${currentMatch.id}`
                  : "No active match"}
              </span>
            </div>
            <div className="draft-context-item">
              <span className="draft-context-label">Game</span>
              <span className="draft-context-value">
                {currentGame ? `Game ${currentGame.game_no}` : "-"}
              </span>
            </div>
            <div className="draft-context-item">
              <span className="draft-context-label">Mode</span>
              <span className="draft-context-value">{currentMatch?.mode || "-"}</span>
            </div>
            <div className="draft-context-item">
              <span className="draft-context-label">Map</span>
              <span
                className={`draft-context-value${
                  selectedMapImagePath ? " draft-context-value--map" : ""
                }`}
              >
                {selectedMapImagePath ? (
                  <img
                    className="draft-context-map-thumb"
                    src={resolveAssetUrl(selectedMapImagePath)}
                    alt={selectedMap?.name || "Map"}
                  />
                ) : null}
                <span>{selectedMap?.name || "No map"}</span>
              </span>
              <div className="draft-map-buttons">
                {visibleMaps.length ? (
                  visibleMaps.map((map) => {
                    const isSelected = String(selectedMap?.id || "") === String(map.id);
                    return (
                      <button
                        key={map.id}
                        type="button"
                        className={`button-secondary draft-map-button${
                          isSelected ? " is-selected" : ""
                        }`}
                        onClick={() => handleSelectMap(map)}
                      >
                        {map.name}
                      </button>
                    );
                  })
                ) : (
                  <span className="draft-map-empty">No maps available</span>
                )}
                <button
                  type="button"
                  className={`button-ghost draft-map-button draft-map-button--clear${
                    !selectedMap ? " is-selected" : ""
                  }`}
                  onClick={handleClearMap}
                >
                  No Map
                </button>
              </div>
            </div>
          </div>
          <div className="draft-context-row">
            <div className="draft-context-item">
              <span className="draft-context-label">Blue Side</span>
              <span className="draft-context-value">{blueTeam?.name || "Blue"}</span>
            </div>
            <div className="draft-context-item">
              <span className="draft-context-label">Red Side</span>
              <span className="draft-context-value">{redTeam?.name || "Red"}</span>
            </div>
          </div>
        </div>

        {!currentGameId ? (
          <div className="draft-empty-state">
            <strong>No active match selected.</strong>
            <span>Please start or select a match first.</span>
          </div>
        ) : (
          <div className="draft-board">
            <aside className="draft-team-panel is-blue">
              <div className="draft-team-header">
                {blueTeam?.logo ? (
                  <img
                    className="draft-team-logo"
                    src={resolveAssetUrl(blueTeam.logo)}
                    alt={blueTeam.name || "Blue"}
                  />
                ) : (
                  <div className="draft-team-logo placeholder">B</div>
                )}
                <div>
                  <div className="draft-team-name">{blueTeam?.name || "Blue Side"}</div>
                  <div className="draft-team-sub">Blue Side</div>
                </div>
              </div>
              <div className="draft-slot-group">
                <div className="draft-slot-title">Picks</div>
                <div className="draft-slot-row draft-pick-slots">
                  {[0, 1, 2, 3, 4].map((index) =>
                    renderSlotCard({ team: "blue", type: "pick", index })
                  )}
                </div>
              </div>
              <div className="draft-slot-group">
                <div className="draft-slot-title">Bans</div>
                <div className="draft-slot-row draft-ban-slots">
                  {[0, 1, 2, 3, 4].map((index) =>
                    renderSlotCard({ team: "blue", type: "ban", index })
                  )}
                </div>
              </div>
            </aside>

            <section className="draft-phase-panel">
              <div className="draft-phase-label">Current Phase</div>
              <div className="draft-phase-name">{currentPhase.label}</div>
              <div className="draft-phase-timer">{formatTimer(draftState.timer.remaining)}</div>
              <div className="draft-phase-actions">
                <button
                  type="button"
                  className="button-primary"
                  onClick={toggleTimer}
                  disabled={draftState.timer.remaining === 0}
                >
                  {draftState.timer.running ? "Pause" : "Start"}
                </button>
                <button type="button" className="button-secondary" onClick={resetTimer}>
                  Reset Timer
                </button>
              </div>
              <div className="draft-phase-controls">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={goPrevPhase}
                  disabled={draftState.phaseIndex === 0}
                >
                  Previous Phase
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={goNextPhase}
                  disabled={draftState.phaseIndex >= DRAFT_PHASES.length - 1}
                >
                  Next Phase
                </button>
              </div>
              <div className="draft-phase-hint">
                {selectedSlot
                  ? `Replacing ${selectedSlot.team} ${selectedSlot.type} ${
                      selectedSlot.index + 1
                    }`
                  : "Select a hero to fill the active slot."}
              </div>
            </section>

            <aside className="draft-team-panel is-red">
              <div className="draft-team-header">
                {redTeam?.logo ? (
                  <img
                    className="draft-team-logo"
                    src={resolveAssetUrl(redTeam.logo)}
                    alt={redTeam.name || "Red"}
                  />
                ) : (
                  <div className="draft-team-logo placeholder">R</div>
                )}
                <div>
                  <div className="draft-team-name">{redTeam?.name || "Red Side"}</div>
                  <div className="draft-team-sub">Red Side</div>
                </div>
              </div>
              <div className="draft-slot-group">
                <div className="draft-slot-title">Picks</div>
                <div className="draft-slot-row draft-pick-slots">
                  {[0, 1, 2, 3, 4].map((index) =>
                    renderSlotCard({ team: "red", type: "pick", index })
                  )}
                </div>
              </div>
              <div className="draft-slot-group">
                <div className="draft-slot-title">Bans</div>
                <div className="draft-slot-row draft-ban-slots">
                  {[0, 1, 2, 3, 4].map((index) =>
                    renderSlotCard({ team: "red", type: "ban", index })
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}

        <section className="draft-hero-selector">
          <div className="draft-hero-header">
            <div className="hero-role-tabs">
              {["All", ...ROLE_OPTIONS].map((role) => (
                <button
                  key={role}
                  type="button"
                  className={role === selectedRoleTab ? "hero-tab is-active" : "hero-tab"}
                  onClick={() => setSelectedRoleTab(role)}
                >
                  {role}
                </button>
              ))}
            </div>
            <div className="draft-hero-filters">
              <label className="draft-hero-filter">
                Lane
                <select
                  value={selectedLaneFilter}
                  onChange={(event) => setSelectedLaneFilter(event.target.value)}
                >
                  {["All", ...LANE_OPTIONS].map((lane) => (
                    <option key={lane} value={lane}>
                      {lane}
                    </option>
                  ))}
                </select>
              </label>
              <label className="draft-hero-filter">
                Search
                <input
                  type="search"
                  placeholder="Search heroes"
                  value={heroSearch}
                  onChange={(event) => setHeroSearch(event.target.value)}
                />
              </label>
            </div>
          </div>

          {filteredHeroes.length === 0 ? (
            <div className="draft-empty-state">
              <strong>No heroes found</strong>
              <span>Try changing the role, lane, or search keyword.</span>
            </div>
          ) : (
            <div className="draft-hero-grid">
              {filteredHeroes.map((hero) => {
                const isDisabled = isHeroAlreadyUsed(hero.id, selectedSlot);
                const imageUrl = hero.image_path ? resolveAssetUrl(hero.image_path) : "";

                return (
                  <button
                    key={hero.id}
                    type="button"
                    className={`draft-hero-card${isDisabled ? " is-disabled" : ""}`}
                    onClick={() => !isDisabled && handleHeroSelect(hero)}
                    disabled={isDisabled}
                  >
                    <div className="draft-hero-media">
                      {imageUrl ? (
                        <img
                          className="draft-hero-card-cover"
                          src={imageUrl}
                          alt={hero.name}
                        />
                      ) : (
                        <div className="draft-hero-placeholder">No Image</div>
                      )}
                      <div className="draft-hero-gradient" aria-hidden="true" />
                      <div className="draft-hero-name">{hero.name}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </section>

      {confirmState.open
        ? createPortal(
            <ConfirmationModal
              open={confirmState.open}
              title={confirmState.title}
              message={confirmState.message}
              confirmText={confirmState.confirmText}
              cancelText={confirmState.cancelText}
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

export default DraftController;
