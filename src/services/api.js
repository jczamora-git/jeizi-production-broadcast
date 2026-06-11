const API_ORIGIN = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_ORIGIN || "http://localhost:3000";
const API_BASE = `${API_ORIGIN.replace(/\/$/, "").replace(/\/api$/, "")}/api`;

const cleanErrorMessage = (text, response) => {
  if (!text) {
    return `Request failed: ${response.status} ${response.statusText}`;
  }

  try {
    const parsed = JSON.parse(text);
    return (
      parsed?.message ||
      parsed?.error ||
      `Request failed: ${response.status} ${response.statusText}`
    );
  } catch (error) {
    const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(text);
    if (looksLikeHtml) {
      return `Request failed: ${response.status} ${response.statusText}`;
    }

    if (
      response.status >= 400 &&
      (/^Cannot\s+/i.test(text) || response.status === 404 || response.status === 405)
    ) {
      return `Request failed: ${response.status} ${response.statusText}`;
    }

    return text;
  }
};

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = { ...(options.headers || {}) };

  if (!isFormData) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  const body =
    options.body === undefined
      ? undefined
      : isFormData || typeof options.body === "string"
        ? options.body
        : JSON.stringify(options.body);

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(cleanErrorMessage(message, response));
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const getTeams = () => request("/teams");
export const createTeam = (payload) =>
  request("/teams", { method: "POST", body: payload });
export const updateTeam = (id, payload) =>
  request(`/teams/${id}`, { method: "PUT", body: payload });
export const deleteTeam = (id) => request(`/teams/${id}`, { method: "DELETE" });

export const getMatches = () => request("/matches");
export const getCurrentMatch = () => request("/matches/current");
export const createMatch = async (payload) => {
  const response = await fetch("/api/matches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(result?.message || result?.error || "Failed to create match");
  }

  return result;
};
export const deleteMatch = (id) => request(`/matches/${id}`, { method: "DELETE" });
export async function updateMatch(id, data) {
  const res = await fetch(`/api/matches/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const result = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(result?.error || result?.message || "Failed to update match");
  }

  return result;
}
export const startMatch = (id) => request(`/matches/${id}/start`, { method: "PUT" });
export const finishMatch = (id) => request(`/matches/${id}/finish`, { method: "PUT" });
export const updateMatchScore = (id, payload) =>
  request(`/matches/${id}/score`, { method: "PUT", body: JSON.stringify(payload) });
export const loadNextMatch = () => request("/matches/load-next", { method: "PUT" });

export const getGames = () => request("/games");
export const getCurrentGame = () => request("/games/current");
export const createGame = (payload) =>
  request("/games", { method: "POST", body: JSON.stringify(payload) });
export const updateGame = (id, payload) =>
  request(`/games/${id}`, { method: "PUT", body: JSON.stringify(payload) });
export const deleteGame = (id) => request(`/games/${id}`, { method: "DELETE" });
export const setGameWinner = (id, payload) =>
  request(`/games/${id}/winner`, { method: "PUT", body: JSON.stringify(payload) });
export const resetGameWinner = (id) =>
  request(`/games/${id}/reset-result`, { method: "PUT" });

export const getMaps = () => request("/maps");
export const createMap = (payload) =>
  request("/maps", { method: "POST", body: payload });
export const updateMap = (id, payload) =>
  request(`/maps/${id}`, { method: "PUT", body: payload });
export const deleteMap = (id) => request(`/maps/${id}`, { method: "DELETE" });

export const getHeroes = () => request("/heroes");
export const createHero = (payload) =>
  request("/heroes", { method: "POST", body: payload });
export const updateHero = (id, payload) =>
  request(`/heroes/${id}`, { method: "PUT", body: payload });
export const deleteHero = (id) => request(`/heroes/${id}`, { method: "DELETE" });

export const getCasters = () => request("/casters");
export const createCaster = (payload) =>
  request("/casters", { method: "POST", body: payload });
export const updateCaster = (id, payload) =>
  request(`/casters/${id}`, { method: "PUT", body: payload });
export const deleteCaster = (id) => request(`/casters/${id}`, { method: "DELETE" });

export const getDraftActions = (gameId) => request(`/draft/${gameId}`);
export const createDraftAction = (payload) =>
  request("/draft", { method: "POST", body: JSON.stringify(payload) });
export const updateDraftAction = (id, payload) =>
  request(`/draft/${id}`, { method: "PUT", body: JSON.stringify(payload) });
export const deleteDraftAction = (id) => request(`/draft/${id}`, { method: "DELETE" });
export const getDraftSession = (matchId, gameNumber) =>
  request(`/draft/session?match_id=${matchId}&game_number=${gameNumber}`);
export const createDraftSession = (payload) =>
  request("/draft/session", { method: "POST", body: JSON.stringify(payload) });
export const updateDraftSession = (id, payload) =>
  request(`/draft/session/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
export const getDraftSlots = (sessionId) => request(`/draft/sessions/${sessionId}/slots`);
export const upsertDraftSlot = (sessionId, payload) =>
  request(`/draft/sessions/${sessionId}/slots`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
export const clearDraftSlots = (sessionId) =>
  request(`/draft/sessions/${sessionId}/slots`, { method: "DELETE" });
export const saveDraftSlots = (sessionId, payload) =>
  request(`/draft/sessions/${sessionId}/save-slots`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getCurrentOverlayData = () => request("/current-overlay-data");
export const getSchedule = () => request("/schedule");
export const previewBracket = (payload) =>
  request("/bracket/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getOverlaySettings = () => request("/overlay-settings");
export const updateOverlaySetting = (overlayKey, isEnabled) =>
  request(`/overlay-settings/${overlayKey}`, {
    method: "PUT",
    body: JSON.stringify({ is_enabled: isEnabled }),
  });

export const getStandings = () => request("/standings");
