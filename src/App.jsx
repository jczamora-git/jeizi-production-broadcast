import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import ControllerLayout from "./components/common/ControllerLayout.jsx";
import Dashboard from "./pages/controller/Dashboard.jsx";
import TeamConfig from "./pages/controller/TeamConfig.jsx";
import MatchConfig from "./pages/controller/MatchConfig.jsx";
import BracketGenerator from "./pages/controller/BracketGenerator.jsx";
import GameConfig from "./pages/controller/GameConfig.jsx";
import DraftController from "./pages/controller/DraftController.jsx";
import HeroConfig from "./pages/controller/HeroConfig.jsx";
import MapConfig from "./pages/controller/MapConfig.jsx";
import CasterConfig from "./pages/controller/CasterConfig.jsx";
import OverlayLinks from "./pages/controller/OverlayLinks.jsx";
import OverlayControlsPage from "./pages/controller/OverlayControlsPage.jsx";
import SchedulePage from "./pages/controller/SchedulePage.jsx";
import StandingsPage from "./pages/controller/StandingsPage.jsx";
import LoadingOverlay from "./pages/overlays/LoadingOverlay.jsx";
import LoadingOverlayV2 from "./pages/overlays/LoadingOverlayV2.jsx";
import DraftOverlay from "./pages/overlays/DraftOverlay.jsx";
import LegacyDraftOverlay from "./pages/overlays/LegacyDraftOverlay.jsx";
import GameplayOverlay from "./pages/overlays/GameplayOverlay.jsx";
import ResultsOverlay from "./pages/overlays/ResultsOverlay.jsx";
import MapChangeOverlay from "./pages/overlays/MapChangeOverlay.jsx";
import OverlayPatternPage from "./pages/overlays/OverlayPatternPage.jsx";
import ScheduleOverlay from "./pages/overlays/ScheduleOverlay.jsx";
import VictoryOverlay from "./pages/overlays/VictoryOverlay.jsx";
import BracketPreviewPage from "./pages/public/BracketPreviewPage.jsx";
import "./styles/controller.css";

function AppRoutes() {
  const location = useLocation();

  useEffect(() => {
    const isOverlayRoute =
      location.pathname.startsWith("/overlay/") || location.pathname.startsWith("/overlays/");
    document.body.classList.toggle("is-overlay-route", isOverlayRoute);
    document.documentElement.classList.toggle("is-overlay-route", isOverlayRoute);

    return () => {
      document.body.classList.remove("is-overlay-route");
      document.documentElement.classList.remove("is-overlay-route");
    };
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/config" replace />} />
      <Route path="/config" element={<ControllerLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="teams" element={<TeamConfig />} />
        <Route path="matches" element={<MatchConfig />} />
        <Route path="bracket" element={<BracketGenerator />} />
        <Route path="games" element={<GameConfig />} />
        <Route path="draft" element={<DraftController />} />
        <Route path="heroes" element={<HeroConfig />} />
        <Route path="maps" element={<MapConfig />} />
        <Route path="casters" element={<CasterConfig />} />
        <Route path="overlays" element={<OverlayLinks />} />
        <Route path="overlay-controls" element={<OverlayControlsPage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="standings" element={<StandingsPage />} />
      </Route>

      <Route path="/overlay/loading" element={<LoadingOverlay />} />
      <Route path="/overlay/loading-v2" element={<LoadingOverlayV2 />} />
      <Route path="/overlay/draft" element={<DraftOverlay />} />
      <Route path="/overlay/legacy-draft" element={<LegacyDraftOverlay />} />
      <Route path="/overlay/gameplay" element={<GameplayOverlay />} />
      <Route path="/overlay/results" element={<ResultsOverlay />} />
      <Route path="/overlay/map-change" element={<MapChangeOverlay />} />
      <Route path="/overlay/victory" element={<VictoryOverlay />} />
      <Route path="/overlays/pattern" element={<OverlayPatternPage />} />
      <Route path="/overlays/schedule" element={<ScheduleOverlay />} />
      <Route path="/bracket-preview" element={<BracketPreviewPage />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
