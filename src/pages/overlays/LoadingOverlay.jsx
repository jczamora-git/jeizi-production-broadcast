import { useEffect, useState } from "react";
import { getCurrentOverlayData, getOverlaySettings } from "../../services/api";
import loadingBg from "../../game_ui/loading.png";
import { resolveAssetUrl } from "../../utils/assetUrl";
import "../../styles/overlays/overlay-base.css";
import "../../styles/overlays/loading-overlay.css";

const getTeamLogo = (team) =>
  team?.logo_url ||
  team?.logo ||
  team?.image_url ||
  team?.image ||
  team?.team_logo_url ||
  team?.team_logo ||
  "";

const getTeamShortName = (team, fallback) =>
  String(team?.shortname || team?.short_name || team?.name || fallback).toUpperCase();

function LoadingOverlay() {
  const [data, setData] = useState({
    match: null,
    blue_team: null,
    red_team: null,
    game: null,
  });
  const [isLoadingOverlayEnabled, setIsLoadingOverlayEnabled] = useState(true);

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

  if (!isLoadingOverlayEnabled) {
    return null;
  }

  const match = data.match || {};
  const blueTeam = data.blue_team || {};
  const redTeam = data.red_team || {};
  const game = data.game || {};
  const casterLabel = data.casters
    ?.map((caster) => caster.name)
    .filter(Boolean)
    .join(" / ") || "";
  const blueTeamShortName = getTeamShortName(blueTeam, "BLUE");
  const redTeamShortName = getTeamShortName(redTeam, "RED");
  const blueLogo = getTeamLogo(blueTeam);
  const redLogo = getTeamLogo(redTeam);
  const resolvedBlueLogo = blueLogo ? resolveAssetUrl(blueLogo) : "";
  const resolvedRedLogo = redLogo ? resolveAssetUrl(redLogo) : "";

  return (
    <div className="overlay-canvas overlay-stage">
      <img className="overlay-bg" src={loadingBg} alt="" />
     

      {resolvedBlueLogo ? (
        <div className="loading-team-logo-mask loading-team-logo-mask-blue">
          <img
            className="loading-team-logo"
            src={resolvedBlueLogo}
            alt={`${blueTeamShortName} logo`}
            draggable="false"
          />
        </div>
      ) : null}
      <div className="overlay-text loading-team-shortname loading-team-shortname-blue">
        {blueTeamShortName}
      </div>

      {resolvedRedLogo ? (
        <div className="loading-team-logo-mask loading-team-logo-mask-red">
          <img
            className="loading-team-logo"
            src={resolvedRedLogo}
            alt={`${redTeamShortName} logo`}
            draggable="false"
          />
        </div>
      ) : null}
      <div className="overlay-text loading-team-shortname loading-team-shortname-red">
        {redTeamShortName}
      </div>
    </div>
  );
}

export default LoadingOverlay;
