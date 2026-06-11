import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BracketTreePreview from "../../components/bracket/BracketTreePreview.jsx";
import { BRACKET_PREVIEW_STORAGE_KEY } from "../controller/BracketGenerator.jsx";

function BracketPreviewPage() {
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    try {
      const storedPreview = localStorage.getItem(BRACKET_PREVIEW_STORAGE_KEY);
      setPreview(storedPreview ? JSON.parse(storedPreview) : null);
    } catch (error) {
      console.error("Failed to load stored bracket preview", error);
      setPreview(null);
    }
  }, []);

  return (
    <div className="bracket-full-view-page">
      <header className="bracket-full-view-header">
        <div>
          <h1>Bracket Preview</h1>
          <p>Read-only tournament bracket view with BYE auto-advance and Battle for Third.</p>
        </div>
        <div className="bracket-full-view-actions">
          <Link className="button-ghost bracket-full-view-link" to="/config/bracket">
            Back to Controller
          </Link>
        </div>
      </header>

      {!preview ? (
        <section className="bracket-full-view-empty">
          <strong>No bracket preview available.</strong>
          <span>Generate a preview first from the Bracket page.</span>
        </section>
      ) : (
        <div className="bracket-full-view-shell">
          <div className="bracket-full-view-summary">
            <span className="bracket-preview-stat">
              <span className="helper-text">Bracket Size</span>
              <strong>{preview.bracket_size}</strong>
            </span>
            <span className="bracket-preview-stat">
              <span className="helper-text">Participants</span>
              <strong>{preview.participant_count}</strong>
            </span>
            <span className="bracket-preview-stat">
              <span className="helper-text">BYEs</span>
              <strong>{preview.byes} auto-advanced</strong>
            </span>
            <span className="bracket-preview-stat">
              <span className="helper-text">Third Place</span>
              <strong>Enabled</strong>
            </span>
          </div>

          <section className="bracket-canvas bracket-full-view-canvas">
            <BracketTreePreview preview={preview} variant="full" />
          </section>
        </div>
      )}
    </div>
  );
}

export default BracketPreviewPage;
