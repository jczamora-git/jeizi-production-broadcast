import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ConfirmationModal from "../../components/common/ConfirmationModal";
import Toast from "../../components/common/Toast";
import { createTeam, deleteTeam, getTeams, updateTeam } from "../../services/api";
import { resolveAssetUrl } from "../../utils/assetUrl";

const emptyForm = { name: "", shortname: "", logoPath: "" };

function TeamConfig() {
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [brokenLogos, setBrokenLogos] = useState({});
  const [toast, setToast] = useState({ message: "", type: "info" });
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    variant: "",
    onConfirm: () => {},
  });
  const fileInputRef = useRef(null);

  const loadTeams = async () => {
    const data = await getTeams();
    setTeams(data);
  };

  const closeToast = () => setToast({ message: "", type: "info" });

  const showToast = (message, type = "info") => {
    setToast({ message, type });
  };

  useEffect(() => {
    loadTeams();
  }, []);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(logoFile);
    setLogoPreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [logoFile]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setLogoFile(null);
    setLogoPreview("");
  };

  const openAddTeamModal = () => {
    resetForm();
    setIsTeamModalOpen(true);
  };

  const openEditTeamModal = (team) => {
    setForm({
      name: team.name || "",
      shortname: team.shortname || "",
      logoPath: team.logo || "",
    });
    setEditingId(team.id);
    setLogoFile(null);
    setLogoPreview("");
    setIsTeamModalOpen(true);
  };

  const closeTeamModal = () => {
    setIsTeamModalOpen(false);
    resetForm();
  };

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

  const saveTeam = async (payload) => {
    if (editingId) {
      await updateTeam(editingId, payload);
      showToast("Team updated.", "success");
    } else {
      await createTeam(payload);
      showToast("Team created.", "success");
    }

    resetForm();
    await loadTeams();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      return;
    }

    const payload = new FormData();
    payload.append("name", form.name);
    if (form.shortname) {
      payload.append("shortname", form.shortname);
    }
    if (logoFile) {
      payload.append("logo", logoFile);
    }

    await saveTeam(payload);
    setIsTeamModalOpen(false);
  };

  const handleLogoPick = () => {
    fileInputRef.current?.click();
  };

  const handleLogoChange = (event) => {
    setLogoFile(event.target.files?.[0] || null);
  };

  const handleRemoveLogo = (event) => {
    event.stopPropagation();
    setLogoFile(null);
  };

  const previewUrl = logoPreview || resolveAssetUrl(form.logoPath);

  const handleDelete = (team) => {
    openConfirm({
      title: "Delete Team",
      message: `Are you sure you want to delete ${team.name}? This action cannot be undone.`,
      confirmText: "Delete",
      variant: "danger",
      onConfirm: async () => {
        try {
          const result = await deleteTeam(team.id);
          await loadTeams();
          showToast(
            result?.deleted_match_count
              ? "Team deleted. Related matches were also removed."
              : "Team deleted.",
            "success"
          );
          closeConfirm();
        } catch (error) {
          showToast(error?.message || "Failed to delete team.", "error");
        }
      },
    });
  };

  return (
    <div className="controller-page">
      <div className="toast-container">
        <Toast message={toast.message} type={toast.type} onClose={closeToast} />
      </div>

      <div className="page-header match-page-header">
        <div className="page-title-group">
          <h1>Teams</h1>
          <div className="page-subtitle">Manage team profiles, logos, and shortnames.</div>
        </div>
        <div className="toolbar match-toolbar">
          <button type="button" className="button-primary" onClick={openAddTeamModal}>
            + Add Team
          </button>
        </div>
      </div>

      <section className="panel">
        <h2>Team List</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Shortname</th>
              <th>Logo</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => (
              <tr key={team.id}>
                <td>{team.id}</td>
                <td>{team.name}</td>
                <td>{team.shortname || "-"}</td>
                <td>
                  {team.logo ? (
                    <>
                      {!brokenLogos[team.id] && (
                        <img
                          className="table-image-preview"
                          src={resolveAssetUrl(team.logo)}
                          alt={team.name}
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                            setBrokenLogos((prev) => ({ ...prev, [team.id]: true }));
                          }}
                        />
                      )}
                      {brokenLogos[team.id] && (
                        <div className="table-image-placeholder">
                          {resolveAssetUrl(team.logo)}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="table-image-placeholder">No Logo</span>
                  )}
                </td>
                <td>
                  <button onClick={() => openEditTeamModal(team)}>Edit</button>
                  <button className="secondary" onClick={() => handleDelete(team)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {isTeamModalOpen
        ? createPortal(
            <div className="modal-backdrop" role="dialog" aria-modal="true">
              <form className="modal-panel" onSubmit={handleSubmit}>
                <div className="modal-header">
                  <h3>{editingId ? "Edit Team" : "Add Team"}</h3>
                </div>
                <div className="modal-body">
                  <section className="modal-section">
                    <div className="modal-section-title">Team Details</div>
                    <div className="form-grid modal-form-grid">
                      <label className="form-group">
                        Team Name
                        <input
                          value={form.name}
                          onChange={(event) => setForm({ ...form, name: event.target.value })}
                          required
                        />
                      </label>
                      <label className="form-group">
                        Shortname
                        <input
                          value={form.shortname}
                          onChange={(event) => setForm({ ...form, shortname: event.target.value })}
                        />
                      </label>
                    </div>
                  </section>
                  <section className="modal-section">
                    <div className="modal-section-title">Logo</div>
                    <div className="form-grid modal-form-grid">
                      <label className="form-group">
                        Logo Upload
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                          style={{ display: "none" }}
                          onChange={handleLogoChange}
                        />
                        <div
                          className="custom-upload"
                          role="button"
                          tabIndex={0}
                          onClick={handleLogoPick}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              handleLogoPick();
                            }
                          }}
                        >
                          {previewUrl ? (
                            <div className="custom-upload-preview">
                              <img className="upload-thumb" src={previewUrl} alt="Logo preview" />
                              <div className="upload-file-name">
                                {logoFile ? logoFile.name : "Using saved logo"}
                              </div>
                            </div>
                          ) : (
                            <div className="custom-upload-placeholder">Choose Logo</div>
                          )}
                          <div className="custom-upload-actions">
                            <button
                              type="button"
                              className="btn-upload"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleLogoPick();
                              }}
                            >
                              {previewUrl ? "Change" : "Choose Logo"}
                            </button>
                            {logoFile && (
                              <button type="button" className="btn-remove" onClick={handleRemoveLogo}>
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      </label>
                    </div>
                  </section>
                </div>
                <div className="modal-footer">
                  <button type="button" className="button-ghost" onClick={closeTeamModal}>
                    Cancel
                  </button>
                  <button type="submit" className="button-primary">
                    {editingId ? "Update Team" : "Add Team"}
                  </button>
                </div>
              </form>
            </div>,
            document.body
          )
        : null}

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

export default TeamConfig;
