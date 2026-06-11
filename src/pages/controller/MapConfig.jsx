import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ConfirmationModal from "../../components/common/ConfirmationModal";
import { createMap, deleteMap, getMaps, updateMap } from "../../services/api";
import { resolveAssetUrl } from "../../utils/assetUrl";

const emptyForm = { name: "", icon_path: "", map_image: "" };

function MapConfig() {
  const [maps, setMaps] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [iconFile, setIconFile] = useState(null);
  const [iconPreview, setIconPreview] = useState("");
  const [mapImageFile, setMapImageFile] = useState(null);
  const [mapImagePreview, setMapImagePreview] = useState("");
  const [brokenIcons, setBrokenIcons] = useState({});
  const [brokenMapImages, setBrokenMapImages] = useState({});
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    variant: "",
    onConfirm: () => {},
  });
  const iconInputRef = useRef(null);
  const mapImageInputRef = useRef(null);

  const loadMaps = async () => {
    const data = await getMaps();
    setMaps(data);
  };

  useEffect(() => {
    loadMaps();
  }, []);

  useEffect(() => {
    if (!iconFile) {
      setIconPreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(iconFile);
    setIconPreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [iconFile]);

  useEffect(() => {
    if (!mapImageFile) {
      setMapImagePreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(mapImageFile);
    setMapImagePreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [mapImageFile]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setIconFile(null);
    setIconPreview("");
    setMapImageFile(null);
    setMapImagePreview("");
  };

  const openAddMapModal = () => {
    resetForm();
    setIsMapModalOpen(true);
  };

  const openEditMapModal = (map) => {
    setForm({
      name: map.name || "",
      icon_path: map.icon_path || "",
      map_image: map.map_image || "",
    });
    setEditingId(map.id);
    setIconFile(null);
    setIconPreview("");
    setMapImageFile(null);
    setMapImagePreview("");
    setIsMapModalOpen(true);
  };

  const closeMapModal = () => {
    setIsMapModalOpen(false);
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

  const saveMap = async (payload) => {
    if (editingId) {
      await updateMap(editingId, payload);
    } else {
      await createMap(payload);
    }

    resetForm();
    await loadMaps();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      return;
    }

    const payload = new FormData();
    payload.append("name", form.name);

    if (iconFile) {
      payload.append("icon", iconFile);
    }

    if (mapImageFile) {
      payload.append("map_image", mapImageFile);
    }

    const isEditing = Boolean(editingId);
    openConfirm({
      title: isEditing ? "Save Changes" : "Create Map",
      message: isEditing ? "Apply these changes?" : "Create this map with the entered details?",
      confirmText: isEditing ? "Save Changes" : "Create",
      onConfirm: async () => {
        await saveMap(payload);
        closeConfirm();
        setIsMapModalOpen(false);
      },
    });
  };

  const handleEdit = (map) => {
    openEditMapModal(map);
  };

  const handleIconPick = () => {
    iconInputRef.current?.click();
  };

  const handleMapImagePick = () => {
    mapImageInputRef.current?.click();
  };

  const handleIconChange = (event) => {
    setIconFile(event.target.files?.[0] || null);
  };

  const handleMapImageChange = (event) => {
    setMapImageFile(event.target.files?.[0] || null);
  };

  const handleRemoveIcon = (event) => {
    event.stopPropagation();
    setIconFile(null);
  };

  const handleRemoveMapImage = (event) => {
    event.stopPropagation();
    setMapImageFile(null);
  };

  const handleDelete = (map) => {
    openConfirm({
      title: "Delete Map",
      message: `Are you sure you want to delete ${map.name}? This action cannot be undone.`,
      confirmText: "Delete",
      variant: "danger",
      onConfirm: async () => {
        await deleteMap(map.id);
        await loadMaps();
        closeConfirm();
      },
    });
  };

  const iconPreviewUrl = iconPreview || resolveAssetUrl(form.icon_path);
  const mapImagePreviewUrl = mapImagePreview || resolveAssetUrl(form.map_image);

  return (
    <div className="controller-page">
      <div className="page-header match-page-header">
        <div className="page-title-group">
          <h1>Maps</h1>
          <div className="page-subtitle">Manage map details, icons, and images.</div>
        </div>
        <div className="toolbar match-toolbar">
          <button type="button" className="button-primary" onClick={openAddMapModal}>
            + Add Map
          </button>
        </div>
      </div>

      <section className="panel">
        <h2>Map List</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Icon</th>
              <th>Map Image</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {maps.map((map) => (
              <tr key={map.id}>
                <td>{map.id}</td>
                <td>{map.name}</td>
                <td>
                  {map.icon_path ? (
                    <>
                      {!brokenIcons[map.id] && (
                        <img
                          className="table-image-preview"
                          src={resolveAssetUrl(map.icon_path)}
                          alt={map.name}
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                            setBrokenIcons((prev) => ({ ...prev, [map.id]: true }));
                          }}
                        />
                      )}
                      {brokenIcons[map.id] && (
                        <div className="table-image-placeholder">
                          {resolveAssetUrl(map.icon_path)}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="table-image-placeholder">No Icon</span>
                  )}
                </td>
                <td>
                  {map.map_image ? (
                    <>
                      {!brokenMapImages[map.id] && (
                        <img
                          className="table-image-preview table-image-preview-wide"
                          src={resolveAssetUrl(map.map_image)}
                          alt={`${map.name} map image`}
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                            setBrokenMapImages((prev) => ({ ...prev, [map.id]: true }));
                          }}
                        />
                      )}
                      {brokenMapImages[map.id] && (
                        <div className="table-image-placeholder">
                          {resolveAssetUrl(map.map_image)}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="table-image-placeholder">No Map Image</span>
                  )}
                </td>
                <td>
                  <button onClick={() => handleEdit(map)}>Edit</button>
                  <button className="secondary" onClick={() => handleDelete(map)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {isMapModalOpen
        ? createPortal(
            <div className="modal-backdrop" role="dialog" aria-modal="true">
              <form className="modal-panel" onSubmit={handleSubmit}>
                <div className="modal-header">
                  <h3>{editingId ? "Edit Map" : "Add Map"}</h3>
                </div>
                <div className="modal-body">
                  <section className="modal-section">
                    <div className="modal-section-title">Map Details</div>
                    <div className="form-grid modal-form-grid">
                      <label className="form-group">
                        Map Name
                        <input
                          value={form.name}
                          onChange={(event) => setForm({ ...form, name: event.target.value })}
                          required
                        />
                      </label>
                    </div>
                  </section>
                  <section className="modal-section">
                    <div className="modal-section-title">Map Media</div>
                    <div className="form-grid modal-form-grid">
                      <label className="form-group">
                        Map Icon Upload
                        <input
                          ref={iconInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                          style={{ display: "none" }}
                          onChange={handleIconChange}
                        />
                        <div
                          className="custom-upload"
                          role="button"
                          tabIndex={0}
                          onClick={handleIconPick}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              handleIconPick();
                            }
                          }}
                        >
                          {iconPreviewUrl ? (
                            <div className="custom-upload-preview">
                              <img className="upload-thumb" src={iconPreviewUrl} alt="Map icon preview" />
                              <div className="upload-file-name">
                                {iconFile ? iconFile.name : "Using saved icon"}
                              </div>
                            </div>
                          ) : (
                            <div className="custom-upload-placeholder">Choose Map Icon</div>
                          )}
                          <div className="custom-upload-actions">
                            <button
                              type="button"
                              className="btn-upload"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleIconPick();
                              }}
                            >
                              {iconPreviewUrl ? "Change" : "Choose Map Icon"}
                            </button>
                            {iconFile && (
                              <button type="button" className="btn-remove" onClick={handleRemoveIcon}>
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      </label>
                      <label className="form-group">
                        Map Image Upload
                        <input
                          ref={mapImageInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                          style={{ display: "none" }}
                          onChange={handleMapImageChange}
                        />
                        <div
                          className="custom-upload"
                          role="button"
                          tabIndex={0}
                          onClick={handleMapImagePick}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              handleMapImagePick();
                            }
                          }}
                        >
                          {mapImagePreviewUrl ? (
                            <div className="custom-upload-preview">
                              <img
                                className="upload-thumb upload-thumb-wide"
                                src={mapImagePreviewUrl}
                                alt="Map image preview"
                              />
                              <div className="upload-file-name">
                                {mapImageFile ? mapImageFile.name : "Using saved map image"}
                              </div>
                            </div>
                          ) : (
                            <div className="custom-upload-placeholder">Choose Map Image</div>
                          )}
                          <div className="custom-upload-actions">
                            <button
                              type="button"
                              className="btn-upload"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleMapImagePick();
                              }}
                            >
                              {mapImagePreviewUrl ? "Change" : "Choose Map Image"}
                            </button>
                            {mapImageFile && (
                              <button type="button" className="btn-remove" onClick={handleRemoveMapImage}>
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
                  <button type="button" className="button-ghost" onClick={closeMapModal}>
                    Cancel
                  </button>
                  <button type="submit" className="button-primary">
                    {editingId ? "Update Map" : "Add Map"}
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

export default MapConfig;
