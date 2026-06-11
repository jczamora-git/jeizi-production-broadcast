import { useMemo, useState } from "react";
import Toast from "../../components/common/Toast";
import bgPatternPreview from "../../game_ui/bg-pattern.png";

const overlays = [
  {
    name: "Loading Overlay",
    route: "/overlay/loading",
    description: "Pre-match loading or holding scene.",
  },
  {
    name: "Loading Overlay V2",
    route: "/overlay/loading-v2",
    description: "Draft pick showcase loading screen with matchup panel.",
  },
  {
    name: "Draft Overlay",
    route: "/overlay/draft",
    description: "Hero pick and ban draft screen.",
  },
  {
    name: "Legacy Draft Overlay",
    route: "/overlay/legacy-draft",
    description: "Static/manual draft layout without draft table data.",
  },
  {
    name: "Gameplay Overlay",
    route: "/overlay/gameplay",
    description: "Live match gameplay overlay.",
  },
  {
    name: "Results Overlay",
    route: "/overlay/results",
    description: "Post-game or match results screen.",
  },
  {
    name: "Map Change Overlay",
    route: "/overlay/map-change",
    description: "Map or event change announcement overlay.",
  },
  {
    name: "Victory Overlay",
    route: "/overlay/victory",
    description: "Victory announcement overlay with configurable winner lines.",
  },
  {
    name: "Overlay Pattern",
    route: "/overlays/pattern",
    description: "Seamless animated pattern background for OBS.",
    preview: bgPatternPreview,
  },
  {
    name: "Schedule Overlay",
    route: "/overlays/schedule",
    description: "Broadcast-style upcoming matches list for OBS.",
  },
];

function OverlayLinks() {
  const [toast, setToast] = useState({ message: "", type: "info" });

  const overlayCards = useMemo(() => overlays, []);

  const closeToast = () => setToast({ message: "", type: "info" });

  const notify = (message, type = "success") => {
    setToast({ message, type });
  };

  const getFullUrl = (route) => `${window.location.origin}${route}`;

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error("Failed to copy link:", error);

      try {
        window.prompt("Copy overlay link:", text);
      } catch (promptError) {
        console.error("Prompt fallback failed:", promptError);
      }

      return false;
    }
  };

  const handleCopyOverlay = async (route) => {
    const url = getFullUrl(route);
    const copied = await copyToClipboard(url);
    notify(copied ? "Overlay link copied." : "Copy failed. Link shown for manual copy.", copied ? "success" : "error");
  };

  const handleOpenOverlay = async (route) => {
    const url = getFullUrl(route);
    const copied = await copyToClipboard(url);
    window.open(url, "_blank", "noopener,noreferrer");
    notify(
      copied ? "Overlay link copied and opened." : "Overlay opened, but copy failed.",
      copied ? "success" : "error"
    );
  };

  return (
    <div className="controller-page">
      <div className="toast-container">
        <Toast message={toast.message} type={toast.type} onClose={closeToast} />
      </div>

      <div className="page-header">
        <div className="page-title-group">
          <h1>Overlays</h1>
          <div className="page-subtitle">
            Open OBS browser-source overlays and copy their links.
          </div>
        </div>
      </div>

      <div className="overlay-grid">
        {overlayCards.map((overlay) => (
          <article
            key={overlay.route}
            className="overlay-card"
            onClick={() => handleOpenOverlay(overlay.route)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleOpenOverlay(overlay.route);
              }
            }}
          >
            <div
              className="overlay-preview-frame overlay-preview-live"
              onClick={(event) => {
                event.stopPropagation();
                handleOpenOverlay(overlay.route);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  handleOpenOverlay(overlay.route);
                }
              }}
            >
              {overlay.preview ? (
                <img
                  className="overlay-preview-iframe"
                  src={overlay.preview}
                  alt={`${overlay.name} preview`}
                  loading="lazy"
                  draggable="false"
                  style={{ objectFit: "cover" }}
                />
              ) : (
                <iframe
                  className="overlay-preview-iframe"
                  src={overlay.route}
                  title={`${overlay.name} preview`}
                  loading="lazy"
                />
              )}
              <div className="overlay-preview-label">{overlay.name}</div>
            </div>

            <div className="overlay-card-body">
              <div className="overlay-card-title">{overlay.name}</div>
              <div className="overlay-card-description">{overlay.description}</div>
              <div className="overlay-route-pill">{overlay.route}</div>
            </div>

            <div className="overlay-card-actions">
              <button
                type="button"
                className="button-primary"
                onClick={(event) => {
                  event.stopPropagation();
                  handleOpenOverlay(overlay.route);
                }}
              >
                Open
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={(event) => {
                  event.stopPropagation();
                  handleCopyOverlay(overlay.route);
                }}
              >
                Copy Link
              </button>
            </div>
          </article>
        ))}
      </div>

      <section className="modern-card overlay-help-card">
        <div className="panel-header">
          <h2>OBS Browser Source Setup</h2>
        </div>
        <div className="dashboard-note-list">
          <div className="dashboard-note-item">
            <strong>1. Open or Copy</strong>
            <span>Click Open to preview an overlay in a new tab, or Copy Link if you only need the URL.</span>
          </div>
          <div className="dashboard-note-item">
            <strong>2. Add Browser Source</strong>
            <span>In OBS, add a Browser Source and paste the copied overlay link.</span>
          </div>
          <div className="dashboard-note-item">
            <strong>3. Use 1920 x 1080</strong>
            <span>Set Width to 1920 and Height to 1080, and use separate Browser Sources per overlay route.</span>
          </div>
        </div>
      </section>
    </div>
  );
}

export default OverlayLinks;
