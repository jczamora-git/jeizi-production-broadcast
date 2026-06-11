import "../../styles/overlays/overlay-pattern.css";
import bgPattern from "../../game_ui/bg-pattern.png";

export default function OverlayPatternPage() {
  return (
    <div className="overlay-pattern-page">
      <div className="overlay-pattern-viewport">
        <div className="overlay-pattern-track">
          <img
            src={bgPattern}
            alt=""
            className="overlay-pattern-image"
            draggable="false"
          />
          <img
            src={bgPattern}
            alt=""
            className="overlay-pattern-image"
            draggable="false"
          />
        </div>
      </div>
    </div>
  );
}
