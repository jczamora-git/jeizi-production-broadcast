import { useEffect, useMemo, useState } from "react";
import {
  getCurrentOverlayData,
  getDraftSession,
  getDraftSlots,
  getOverlaySettings,
} from "../../services/api";
import { resolveAssetUrl } from "../../utils/assetUrl";
import "../../styles/overlays/overlay-base.css";
import "../../styles/overlays/loading-overlay-v2.css";

const SLOT_COUNT = 5;

const normalizeValue = (value) => String(value || "").trim().toLowerCase();

const getTeamName = (team, fallback) =>
  String(team?.shortname || team?.short_name || team?.name || fallback).toUpperCase();

const buildPickSlots = (slots, side) => {
  const picks = slots
    .filter(
      (slot) =>
        normalizeValue(slot?.team_side) === side &&
        normalizeValue(slot?.slot_type) === "pick"
    )
    .sort((a, b) => Number(a?.slot_index || 0) - Number(b?.slot_index || 0));

  return Array.from({ length: SLOT_COUNT }, (_, index) => {
    return picks.find((slot) => Number(slot?.slot_index) === index) || null;
  });
};

function LoadingOverlayV2() {
  const [data, setData] = useState({
    match: null,
    blue_team: null,
    red_team: null,
    game: null,
  });
  const [draftSlots, setDraftSlots] = useState([]);
  const [isLoadingOverlayEnabled, setIsLoadingOverlayEnabled] = useState(true);
  const [screenIndex, setScreenIndex] = useState(0);
  const [matchDoorsOpen, setMatchDoorsOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      try {
        const settings = await getOverlaySettings();
        if (!isMounted) {
          return;
        }
        setIsLoadingOverlayEnabled(settings?.loading_overlay !== false);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setIsLoadingOverlayEnabled(true);
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

  const matchId = data.match?.id || null;
  const gameNumber = data.game?.game_no || null;

  useEffect(() => {
    let isMounted = true;

    const loadDraftSlots = async () => {
      if (!matchId || !gameNumber) {
        setDraftSlots([]);
        return;
      }

      try {
        const session = await getDraftSession(matchId, gameNumber);
        if (!isMounted) {
          return;
        }

        if (!session?.id) {
          setDraftSlots([]);
          return;
        }

        const slots = await getDraftSlots(session.id);
        if (isMounted) {
          setDraftSlots(Array.isArray(slots) ? slots : []);
        }
      } catch (error) {
        if (isMounted) {
          setDraftSlots([]);
        }
      }
    };

    loadDraftSlots();
    const timer = setInterval(loadDraftSlots, 1000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [matchId, gameNumber]);

  useEffect(() => {
    if (!isLoadingOverlayEnabled) {
      return undefined;
    }

    const interval = setInterval(() => {
      setScreenIndex((prev) => (prev + 1) % 3);
    }, 7000);

    return () => clearInterval(interval);
  }, [isLoadingOverlayEnabled]);

  useEffect(() => {
    if (screenIndex !== 2) {
      setMatchDoorsOpen(false);
      return undefined;
    }

    setMatchDoorsOpen(false);
    const timer = setTimeout(() => {
      setMatchDoorsOpen(true);
    }, 250);

    return () => clearTimeout(timer);
  }, [screenIndex]);

  if (!isLoadingOverlayEnabled) {
    return null;
  }

  const blueTeam = data.blue_team || data.overlay_blue_team || {};
  const redTeam = data.red_team || data.overlay_red_team || {};
  const blueName = getTeamName(blueTeam, "BLUE TEAM");
  const redName = getTeamName(redTeam, "RED TEAM");

  const bluePicks = useMemo(
    () => buildPickSlots(draftSlots, "blue"),
    [draftSlots]
  );
  const redPicks = useMemo(
    () => buildPickSlots(draftSlots, "red"),
    [draftSlots]
  );

  const getHeroImage = (slot) =>
    slot?.hero_image_path ? resolveAssetUrl(slot.hero_image_path) : "";

  const renderPanel = (slot, index, side) => {
    const heroName = slot?.hero_name || `Pick ${index + 1}`;
    const heroImage = getHeroImage(slot);
    const accent = side;
    const cutClass = index % 2 === 0 ? "loading-v2-panel-top" : "loading-v2-panel-bottom";

    return (
      <div key={`${side}-${index}`} className={`loading-v2-panel ${cutClass}`}>
        {heroImage ? (
          <img src={heroImage} alt={heroName} draggable="false" />
        ) : (
          <div className="loading-v2-panel-placeholder">TBD</div>
        )}
        <div className={`loading-v2-panel-overlay loading-v2-${accent}`} />
      </div>
    );
  };

  return (
    <div className="overlay-canvas overlay-stage loading-v2">
      <div className="loading-v2-bg" />
      <div className="loading-v2-stage">
        <div
          className={`loading-v2-team-display loading-v2-team-blue${
            screenIndex === 0 ? " is-active" : ""
          }`}
        >
          {blueName}
        </div>
        <div
          className={`loading-v2-team-display loading-v2-team-red${
            screenIndex === 1 ? " is-active" : ""
          }`}
        >
          {redName}
        </div>

        <section
          className={`loading-v2-screen loading-v2-screen-blue${
            screenIndex === 0 ? " is-active" : ""
          }`}
        >
          <div className="loading-v2-strip">
            {bluePicks.map((slot, index) => renderPanel(slot, index, "blue"))}
          </div>
        </section>

        <section
          className={`loading-v2-screen loading-v2-screen-red${
            screenIndex === 1 ? " is-active" : ""
          }`}
        >
          <div className="loading-v2-strip">
            {redPicks.map((slot, index) => renderPanel(slot, index, "red"))}
          </div>
        </section>

        <section
          className={`loading-v2-screen loading-v2-screen-match${
            screenIndex === 2 ? " is-active" : ""
          }`}
        >
          <div
            className={`loading-v2-matchup-stage${
              matchDoorsOpen ? " is-open" : ""
            }`}
          >
            <div className="loading-v2-match-row">
              {bluePicks.map((slot, index) => {
                const heroImage = getHeroImage(slot);
                const accent = "blue";
                return (
                  <div
                    key={`match-blue-${index}`}
                    className="loading-v2-match-panel"
                  >
                    {heroImage ? (
                      <img
                        src={heroImage}
                        alt={slot?.hero_name || `Pick ${index + 1}`}
                        draggable="false"
                      />
                    ) : (
                      <div className="loading-v2-panel-placeholder">TBD</div>
                    )}
                    <div className={`loading-v2-panel-overlay loading-v2-${accent}`} />
                  </div>
                );
              })}
            </div>

            <div className="loading-v2-vs-banner">
              <span className="loading-v2-vs-team loading-v2-vs-team-blue">
                {blueName}
              </span>
              <span className="loading-v2-vs-text">VS</span>
              <span className="loading-v2-vs-team loading-v2-vs-team-red">
                {redName}
              </span>
            </div>

            <div className="loading-v2-match-row">
              {redPicks.map((slot, index) => {
                const heroImage = getHeroImage(slot);
                const accent = "red";
                return (
                  <div
                    key={`match-red-${index}`}
                    className="loading-v2-match-panel"
                  >
                    {heroImage ? (
                      <img
                        src={heroImage}
                        alt={slot?.hero_name || `Pick ${index + 1}`}
                        draggable="false"
                      />
                    ) : (
                      <div className="loading-v2-panel-placeholder">TBD</div>
                    )}
                    <div className={`loading-v2-panel-overlay loading-v2-${accent}`} />
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default LoadingOverlayV2;
