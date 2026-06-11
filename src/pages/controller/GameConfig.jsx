import { Link } from "react-router-dom";

function GameConfig() {
  return (
    <div className="controller-page">
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Games</h1>
          <p className="page-subtitle">
            Game management lives inside Match Config so series flow stays in one place.
          </p>
        </div>
      </div>
      <div className="controller-card">
        <p>Game setup is now managed inside Match Config.</p>
        <Link className="btn-primary" to="/config/matches">
          Go to Match Config
        </Link>
      </div>
    </div>
  );
}

export default GameConfig;
