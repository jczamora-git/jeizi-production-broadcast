import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import BracketTreePreview from "../../components/bracket/BracketTreePreview";
import CustomDropdown from "../../components/common/CustomDropdown";
import Toast from "../../components/common/Toast";
import { getTeams, previewBracket } from "../../services/api";

export const BRACKET_PREVIEW_STORAGE_KEY = "jeizi-bracket-preview";

const defaultRoundModes = {
  Elimination: "BO1",
  "Top 16": "BO1",
  "Quarter-Finals": "BO3",
  "Semi-Finals": "BO3",
  Finals: "BO5",
};

const modeOptions = ["BO1", "BO3", "BO5", "BO7"].map((mode) => ({
  value: mode,
  label: mode,
}));

const roundModeKeys = [
  "Elimination",
  "Top 16",
  "Quarter-Finals",
  "Semi-Finals",
  "Finals",
];

const thirdPlaceModeOptions = ["BO1", "BO3", "BO5", "BO7"].map((mode) => ({
  value: mode,
  label: mode,
}));

function getTeamName(team) {
  return team.name || team.team_name || team.short_name || `Team #${team.id}`;
}

function BracketGenerator() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [roundModes, setRoundModes] = useState(defaultRoundModes);
  const [thirdPlaceMode, setThirdPlaceMode] = useState("BO3");
  const [preview, setPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "info" });

  useEffect(() => {
    const loadTeams = async () => {
      try {
        const teamData = await getTeams();
        setTeams(Array.isArray(teamData) ? teamData : []);
      } catch (error) {
        console.error("Failed to load teams", error);
        setTeams([]);
        setToast({ message: error?.message || "Failed to load teams.", type: "error" });
      } finally {
        setIsLoading(false);
      }
    };

    loadTeams();
  }, []);

  useEffect(() => {
    if (teams.length > 0 && selectedTeams.length === 0) {
      setSelectedTeams(teams);
    }
  }, [teams, selectedTeams.length]);

  const closeToast = () => setToast({ message: "", type: "info" });

  const handleMoveTeam = (index, direction) => {
    setSelectedTeams((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(nextIndex, 0, moved);
      return next;
    });
  };

  const handleRemoveTeam = (teamId) => {
    setSelectedTeams((current) => current.filter((team) => Number(team.id) !== Number(teamId)));
  };

  const handleShuffleTeams = () => {
    setSelectedTeams((prev) => {
      const shuffled = [...prev];
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    });
  };

  const handleResetOrder = () => {
    setSelectedTeams(teams);
  };

  const handleOpenFullView = () => {
    if (!preview) {
      return;
    }

    localStorage.setItem(BRACKET_PREVIEW_STORAGE_KEY, JSON.stringify(preview));
    navigate("/bracket-preview");
  };

  const handlePreview = async () => {
    if (selectedTeams.length < 2) {
      setToast({ message: "Select at least 2 teams to preview a bracket.", type: "error" });
      return;
    }

    setIsPreviewing(true);

    try {
      const payload = {
        participants: selectedTeams.map((team, index) => ({
          team_id: Number(team.id),
          seed: index + 1,
          name: getTeamName(team),
        })),
        roundModes: {
          ...roundModes,
          "Battle for Third": thirdPlaceMode,
        },
        options: {
          bracketType: "single_elimination",
          seedingMode: "manual",
          includeThirdPlace: true,
        },
      };

      const result = await previewBracket(payload);
      setPreview(result?.bracket || null);
      if (result?.bracket) {
        localStorage.setItem(BRACKET_PREVIEW_STORAGE_KEY, JSON.stringify(result.bracket));
      }
      setToast({ message: "Bracket preview generated.", type: "success" });
    } catch (error) {
      console.error("Failed to preview bracket", error);
      setPreview(null);
      setToast({ message: error?.message || "Failed to preview bracket.", type: "error" });
    } finally {
      setIsPreviewing(false);
    }
  };

  return (
    <div className="controller-page bracket-page">
      <div className="toast-container">
        <Toast message={toast.message} type={toast.type} onClose={closeToast} />
      </div>

      <div className="page-header match-page-header bracket-page-header">
        <div className="page-title-group">
          <h1>Bracket</h1>
          <div className="page-subtitle">
            Preview a single-elimination bracket without creating matches yet.
          </div>
        </div>
        <div className="toolbar match-toolbar bracket-actions">
          <button
            type="button"
            className="button-secondary"
            onClick={handleShuffleTeams}
            disabled={selectedTeams.length < 2}
          >
            Shuffle Seeds
          </button>
          <button
            type="button"
            className="button-ghost"
            onClick={handleResetOrder}
            disabled={!teams.length}
          >
            Reset Order
          </button>
          <button
            type="button"
            className="button-primary"
            onClick={handlePreview}
            disabled={isPreviewing}
          >
            {isPreviewing ? "Generating..." : "Preview Bracket"}
          </button>
          <button
            type="button"
            className="button-ghost"
            onClick={handleOpenFullView}
            disabled={!preview}
          >
            Open Full View
          </button>
        </div>
      </div>

      <div className="match-section-stack bracket-workspace">
        <section className="modern-card bracket-setup-card" style={{ overflow: "visible" }}>
          <div className="panel-header">
            <h2>Bracket Setup</h2>
            <div className="helper-text">Single Elimination</div>
          </div>

          <div className="bracket-summary-row">
            <div className="bracket-summary-item">
              <span className="helper-text">Total Teams</span>
              <strong>{teams.length}</strong>
            </div>
            <div className="bracket-summary-item">
              <span className="helper-text">Bracket Size</span>
              <strong>{preview?.bracket_size || "-"}</strong>
            </div>
            <div className="bracket-summary-item">
              <span className="helper-text">BYEs</span>
              <strong>{preview?.byes ?? "-"}</strong>
            </div>
            <div className="bracket-summary-item">
              <span className="helper-text">Bracket Type</span>
              <strong>Single Elimination</strong>
            </div>
          </div>

          <div className="bracket-seed-controls">
            <button
              type="button"
              className="button-secondary"
              onClick={handleShuffleTeams}
              disabled={selectedTeams.length < 2}
            >
              Shuffle Seeds
            </button>
            <button
              type="button"
              className="button-ghost"
              onClick={handleResetOrder}
              disabled={!teams.length}
            >
              Reset Order
            </button>
          </div>

          <div className="bracket-setup-grid bracket-setup-layout">
            <div className="bracket-setup-copy">
              <div className="helper-text">
                All tournament teams are automatically added to Selected Teams. The visible order is
                the current seed order used for preview.
              </div>
              <div className="modern-card muted">
                {isLoading ? "Loading teams..." : `${teams.length} teams loaded and ready for seeding.`}
              </div>
            </div>

            <div className="bracket-seed-panel bracket-selected-teams-panel">
              <div className="panel-header" style={{ padding: 0 }}>
                <h2>Selected Teams</h2>
                <div className="helper-text">{selectedTeams.length} participants</div>
              </div>

              {selectedTeams.length ? (
                <div className="seed-table-wrap">
                  <table className="seed-table">
                    <thead>
                      <tr>
                        <th>Seed</th>
                        <th>Team</th>
                        <th>Code</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTeams.map((team, index) => (
                        <tr key={team.id}>
                          <td>{index + 1}</td>
                          <td className="seed-team-name">{getTeamName(team)}</td>
                          <td>{team.shortname || team.short_name || `T${team.id}`}</td>
                          <td>
                            <div className="seed-row-actions">
                              <button
                                type="button"
                                className="button-ghost"
                                onClick={() => handleMoveTeam(index, -1)}
                                disabled={index === 0}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="button-ghost"
                                onClick={() => handleMoveTeam(index, 1)}
                                disabled={index === selectedTeams.length - 1}
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                className="button-danger-outline"
                                onClick={() => handleRemoveTeam(team.id)}
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="modern-card muted">Select teams to start building the bracket.</div>
              )}
            </div>
          </div>
        </section>

        <section className="modern-card bracket-round-modes-card" style={{ overflow: "visible" }}>
          <div className="panel-header">
            <h2>Round Modes</h2>
          </div>

          <div
            className="form-grid modal-form-grid bracket-round-modes-grid round-mode-grid"
          >
            {roundModeKeys.map((roundKey) => (
              <div key={roundKey} className="form-group">
                {roundKey}
                <CustomDropdown
                  value={roundModes[roundKey]}
                  options={modeOptions}
                  placeholder="Select mode"
                  onChange={(selectedValue) =>
                    setRoundModes((current) => ({
                      ...current,
                      [roundKey]: selectedValue,
                    }))
                  }
                />
              </div>
            ))}
            <div className="form-group">
              Battle for Third
              <CustomDropdown
                value={thirdPlaceMode}
                options={thirdPlaceModeOptions}
                placeholder="Select mode"
                onChange={(selectedValue) => setThirdPlaceMode(selectedValue)}
              />
            </div>
          </div>
        </section>

        <section className="modern-card bracket-preview-card bracket-preview-section">
          <div className="panel-header">
            <h2>Bracket Preview</h2>
            <div className="bracket-preview-toolbar">
              <span className="bracket-preview-stat">
                <span className="helper-text">Bracket Size</span>
                <strong>{preview?.bracket_size || "-"}</strong>
              </span>
              <span className="bracket-preview-stat">
                <span className="helper-text">Participants</span>
                <strong>{preview?.participant_count || selectedTeams.length}</strong>
              </span>
              <span className="bracket-preview-stat">
                <span className="helper-text">BYEs</span>
                <strong>
                  {preview ? `${preview.byes} auto-advanced` : "-"}
                </strong>
              </span>
              <span className="bracket-preview-stat">
                <span className="helper-text">Third Place</span>
                <strong>Enabled</strong>
              </span>
            </div>
          </div>

          {!preview ? (
            <div className="bracket-preview-empty">
              Shuffle or adjust seeds, then click Preview Bracket.
            </div>
          ) : (
            <div className="bracket-preview-layout">
              <section className="bracket-canvas bracket-tree-canvas bracket-preview-canvas">
                <BracketTreePreview preview={preview} variant="controller" />
              </section>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default BracketGenerator;
