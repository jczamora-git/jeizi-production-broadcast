import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ConfirmationModal from "../../components/common/ConfirmationModal";
import { createHero, deleteHero, getHeroes, updateHero } from "../../services/api";
import { resolveAssetUrl } from "../../utils/assetUrl";

const emptyForm = { name: "", role: "", lane: "", image_path: "" };

const ROLE_OPTIONS = [
  "Tank",
  "Fighter",
  "Assassin",
  "Mage",
  "Marksman",
  "Support",
];

const LANE_OPTIONS = ["Gold Lane", "Jungle", "Roam", "Mid Lane", "Exp Lane"];

const splitCsv = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const hasCsvValue = (value, selected) => {
  if (!selected || selected === "All") return true;
  return splitCsv(value).some((item) => item.toLowerCase() === selected.toLowerCase());
};

const matchesSearch = (hero, search) => {
  const keyword = String(search || "").trim().toLowerCase();
  if (!keyword) return true;
  return String(hero?.name || "").toLowerCase().includes(keyword);
};

function HeroConfig() {
  const [heroes, setHeroes] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [isHeroModalOpen, setIsHeroModalOpen] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [selectedRoleTab, setSelectedRoleTab] = useState("All");
  const [selectedLaneFilter, setSelectedLaneFilter] = useState("All");
  const [heroSearch, setHeroSearch] = useState("");
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [selectedLanes, setSelectedLanes] = useState([]);
  const [brokenImages, setBrokenImages] = useState({});
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
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

  const loadHeroes = async () => {
    const data = await getHeroes();
    setHeroes(data);
  };

  useEffect(() => {
    loadHeroes();
  }, []);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(imageFile);
    setImagePreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [imageFile]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setImageFile(null);
    setImagePreview("");
    setSelectedRoles([]);
    setSelectedLanes([]);
    setFormError("");
  };

  const openAddHeroModal = () => {
    resetForm();
    setIsHeroModalOpen(true);
  };

  const openEditHeroModal = (hero) => {
    setForm({
      name: hero.name || "",
      role: hero.role || "",
      lane: hero.lane || "",
      image_path: hero.image_path || "",
    });
    setSelectedRoles(splitCsv(hero.role));
    setSelectedLanes(splitCsv(hero.lane));
    setEditingId(hero.id);
    setImageFile(null);
    setImagePreview("");
    setIsHeroModalOpen(true);
  };

  const closeHeroModal = () => {
    setIsHeroModalOpen(false);
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

  const saveHero = async (payload) => {
    if (editingId) {
      await updateHero(editingId, payload);
    } else {
      await createHero(payload);
    }

    resetForm();
    await loadHeroes();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      return;
    }

    const payload = new FormData();
    payload.append("name", form.name.trim());
    payload.append("role", selectedRoles.join(", "));
    payload.append("lane", selectedLanes.join(", "));
    if (imageFile) {
      payload.append("image", imageFile);
    }

    const isEditing = Boolean(editingId);
    openConfirm({
      title: isEditing ? "Save Changes" : "Create Hero",
      message: isEditing ? "Apply these changes?" : "Create this hero with the entered details?",
      confirmText: isEditing ? "Save Changes" : "Create",
      onConfirm: async () => {
        try {
          setFormError("");
          setPageError("");
          await saveHero(payload);
          closeConfirm();
          setIsHeroModalOpen(false);
        } catch (error) {
          setFormError(error?.message || "Failed to save hero.");
          closeConfirm();
        }
      },
    });
  };

  const handleEdit = (hero) => {
    openEditHeroModal(hero);
  };

  const handleImagePick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (event) => {
    setImageFile(event.target.files?.[0] || null);
  };

  const handleRemoveImage = (event) => {
    event.stopPropagation();
    setImageFile(null);
  };

  const previewUrl = imagePreview || resolveAssetUrl(form.image_path);

  const handleDelete = (hero) => {
    openConfirm({
      title: "Delete Hero",
      message: `Are you sure you want to delete ${hero.name}? This action cannot be undone.`,
      confirmText: "Delete",
      variant: "danger",
      onConfirm: async () => {
        try {
          setPageError("");
          await deleteHero(hero.id);
          await loadHeroes();
          closeConfirm();
        } catch (error) {
          setPageError(error?.message || "Failed to delete hero.");
          closeConfirm();
        }
      },
    });
  };

  const handleRoleToggle = (role) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((item) => item !== role) : [...prev, role]
    );
  };

  const handleLaneToggle = (lane) => {
    setSelectedLanes((prev) =>
      prev.includes(lane) ? prev.filter((item) => item !== lane) : [...prev, lane]
    );
  };

  const filteredHeroes = heroes.filter(
    (hero) =>
      hasCsvValue(hero.role, selectedRoleTab) &&
      hasCsvValue(hero.lane, selectedLaneFilter) &&
      matchesSearch(hero, heroSearch)
  );
  const heroCountLabel = `${filteredHeroes.length} ${
    filteredHeroes.length === 1 ? "hero" : "heroes"
  }`;

  return (
    <div className="controller-page">
      <div className="page-header match-page-header">
        <div className="page-title-group">
          <h1>Heroes</h1>
          <div className="page-subtitle">Manage hero profiles, roles, and images.</div>
        </div>
        <div className="toolbar match-toolbar">
          <button type="button" className="button-primary" onClick={openAddHeroModal}>
            + Add Hero
          </button>
        </div>
      </div>

      <section className="hero-browser">
        <div className="hero-browser-header">
          <div className="hero-role-tabs">
            {["All", ...ROLE_OPTIONS].map((role) => (
              <button
                key={role}
                type="button"
                className={
                  role === selectedRoleTab ? "hero-tab is-active" : "hero-tab"
                }
                onClick={() => setSelectedRoleTab(role)}
              >
                {role}
              </button>
            ))}
          </div>
          <div className="hero-filter-row">
            <label className="hero-lane-filter">
              Lane
              <select
                value={selectedLaneFilter}
                onChange={(event) => setSelectedLaneFilter(event.target.value)}
              >
                {["All", ...LANE_OPTIONS].map((lane) => (
                  <option key={lane} value={lane}>
                    {lane}
                  </option>
                ))}
              </select>
            </label>
            <div className="hero-search">
              <div className="hero-filter-label-row">
                <label htmlFor="hero-search-input">Search</label>
                <span className="hero-count-label">{heroCountLabel}</span>
              </div>
              <div className="hero-search-input-wrap">
                <input
                  id="hero-search-input"
                  type="search"
                  placeholder="Search heroes"
                  value={heroSearch}
                  onChange={(event) => setHeroSearch(event.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {pageError ? <div className="hero-message is-error">{pageError}</div> : null}

        {filteredHeroes.length === 0 ? (
          <div className="hero-empty-state">
            <strong>No heroes found</strong>
            <span>Try changing the role, lane, or search keyword.</span>
          </div>
        ) : (
          <div className="hero-grid">
            {filteredHeroes.map((hero) => {
              const imageUrl = hero.image_path ? resolveAssetUrl(hero.image_path) : "";
              const roleText = splitCsv(hero.role).join(" / ");
              const laneText = splitCsv(hero.lane).join(" / ");

              return (
                <article key={hero.id} className="hero-card">
                  <div className="hero-card-media">
                    {imageUrl && !brokenImages[hero.id] ? (
                      <img
                        src={imageUrl}
                        alt={hero.name}
                        onError={() =>
                          setBrokenImages((prev) => ({ ...prev, [hero.id]: true }))
                        }
                      />
                    ) : (
                      <div className="hero-card-placeholder">No Image</div>
                    )}
                  </div>
                  <div className="hero-card-body">
                    <div className="hero-card-title">
                      <strong>{hero.name}</strong>
                    </div>
                    <div className="hero-card-meta">
                      {roleText ? <span>{roleText}</span> : <span>No role</span>}
                      {laneText ? <span>{laneText}</span> : <span>No lane</span>}
                    </div>
                    <div className="hero-card-actions">
                      <button type="button" onClick={() => handleEdit(hero)}>
                        Edit
                      </button>
                      <button type="button" className="secondary" onClick={() => handleDelete(hero)}>
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {isHeroModalOpen
        ? createPortal(
            <div className="modal-backdrop" role="dialog" aria-modal="true">
              <form className="modal-panel" onSubmit={handleSubmit}>
                <div className="modal-header">
                  <h3>{editingId ? "Edit Hero" : "Add Hero"}</h3>
                </div>
                <div className="modal-body">
                  <section className="modal-section hero-modal-section hero-modal-name-section">
                    <div className="modal-section-title">Hero Name</div>
                    <div className="form-grid modal-form-grid">
                      <label className="form-group">
                        Hero Name
                        <input
                          value={form.name}
                          onChange={(event) => setForm({ ...form, name: event.target.value })}
                          required
                        />
                      </label>
                    </div>
                  </section>
                  <section className="modal-section hero-modal-section">
                    <div className="modal-section-title">Role & Lanes</div>
                    <div className="hero-modal-role-lane-grid">
                      <div className="hero-modal-check-group">
                        <div className="hero-modal-check-title">Roles</div>
                        <div className="checkbox-list hero-modal-check-grid">
                          {ROLE_OPTIONS.map((role) => (
                            <label key={role} className="checkbox-item hero-modal-check-item">
                              <input
                                type="checkbox"
                                checked={selectedRoles.includes(role)}
                                onChange={() => handleRoleToggle(role)}
                              />
                              {role}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="hero-modal-check-group">
                        <div className="hero-modal-check-title">Lanes</div>
                        <div className="checkbox-list hero-modal-check-grid">
                          {LANE_OPTIONS.map((lane) => (
                            <label key={lane} className="checkbox-item hero-modal-check-item">
                              <input
                                type="checkbox"
                                checked={selectedLanes.includes(lane)}
                                onChange={() => handleLaneToggle(lane)}
                              />
                              {lane}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                  <section className="modal-section hero-modal-section hero-modal-image-section">
                    <div className="modal-section-title">Hero Image</div>
                    <div className="form-grid modal-form-grid">
                      <label className="form-group">
                        Hero Image Upload
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                          style={{ display: "none" }}
                          onChange={handleImageChange}
                        />
                        <div
                          className="custom-upload"
                          role="button"
                          tabIndex={0}
                          onClick={handleImagePick}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              handleImagePick();
                            }
                          }}
                        >
                          {previewUrl ? (
                            <div className="custom-upload-preview">
                              <img className="upload-thumb" src={previewUrl} alt="Hero preview" />
                              <div className="upload-file-name">
                                {imageFile ? imageFile.name : "Using saved image"}
                              </div>
                            </div>
                          ) : (
                            <div className="custom-upload-placeholder">Choose Hero Image</div>
                          )}
                          <div className="custom-upload-actions">
                            <button type="button" className="btn-upload" onClick={(event) => {
                              event.stopPropagation();
                              handleImagePick();
                            }}>
                              {previewUrl ? "Change" : "Choose Hero Image"}
                            </button>
                            {imageFile && (
                              <button type="button" className="btn-remove" onClick={handleRemoveImage}>
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      </label>
                    </div>
                  </section>
                </div>
                {formError ? <div className="hero-message is-error">{formError}</div> : null}
                <div className="modal-footer">
                  <button type="button" className="button-ghost" onClick={closeHeroModal}>
                    Cancel
                  </button>
                  <button type="submit" className="button-primary">
                    {editingId ? "Update Hero" : "Add Hero"}
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

export default HeroConfig;
