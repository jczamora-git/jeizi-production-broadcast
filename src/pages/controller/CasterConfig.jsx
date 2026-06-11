import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ConfirmationModal from "../../components/common/ConfirmationModal";
import { createCaster, deleteCaster, getCasters, updateCaster } from "../../services/api";
import { resolveAssetUrl } from "../../utils/assetUrl";

const emptyForm = { name: "", photo: "" };

function CasterConfig() {
  const [casters, setCasters] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [isCasterModalOpen, setIsCasterModalOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [brokenPhotos, setBrokenPhotos] = useState({});
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

  const loadCasters = async () => {
    const data = await getCasters();
    setCasters(data);
  };

  useEffect(() => {
    loadCasters();
  }, []);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(photoFile);
    setPhotoPreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [photoFile]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setPhotoFile(null);
    setPhotoPreview("");
  };

  const openAddCasterModal = () => {
    resetForm();
    setIsCasterModalOpen(true);
  };

  const openEditCasterModal = (caster) => {
    setForm({
      name: caster.name || "",
      photo: caster.photo || "",
    });
    setEditingId(caster.id);
    setPhotoFile(null);
    setPhotoPreview("");
    setIsCasterModalOpen(true);
  };

  const closeCasterModal = () => {
    setIsCasterModalOpen(false);
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

  const saveCaster = async (payload) => {
    if (editingId) {
      await updateCaster(editingId, payload);
    } else {
      await createCaster(payload);
    }

    resetForm();
    await loadCasters();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      return;
    }

    const payload = new FormData();
    payload.append("name", form.name);
    if (photoFile) {
      payload.append("photo", photoFile);
    }

    const isEditing = Boolean(editingId);
    openConfirm({
      title: isEditing ? "Save Changes" : "Create Caster",
      message: isEditing
        ? "Apply these changes?"
        : "Create this caster with the entered details?",
      confirmText: isEditing ? "Save Changes" : "Create",
      onConfirm: async () => {
        await saveCaster(payload);
        closeConfirm();
        setIsCasterModalOpen(false);
      },
    });
  };

  const handleEdit = (caster) => {
    openEditCasterModal(caster);
  };

  const handleDelete = (caster) => {
    openConfirm({
      title: "Delete Caster",
      message: `Are you sure you want to delete ${caster.name}? This action cannot be undone.`,
      confirmText: "Delete",
      variant: "danger",
      onConfirm: async () => {
        await deleteCaster(caster.id);
        await loadCasters();
        closeConfirm();
      },
    });
  };

  const handlePhotoPick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = (event) => {
    setPhotoFile(event.target.files?.[0] || null);
  };

  const handleRemovePhoto = (event) => {
    event.stopPropagation();
    setPhotoFile(null);
  };

  const previewUrl = photoPreview || resolveAssetUrl(form.photo);

  return (
    <div className="controller-page">
      <div className="page-header match-page-header">
        <div className="page-title-group">
          <h1>Casters</h1>
          <div className="page-subtitle">Manage caster profiles and photos.</div>
        </div>
        <div className="toolbar match-toolbar">
          <button type="button" className="button-primary" onClick={openAddCasterModal}>
            + Add Caster
          </button>
        </div>
      </div>

      <section className="panel">
        <h2>Caster List</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Photo</th>
              <th>Name</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {casters.map((caster) => (
              <tr key={caster.id}>
                <td>{caster.id}</td>
                <td>
                  {caster.photo ? (
                    <>
                      {!brokenPhotos[caster.id] && (
                        <img
                          className="table-image-preview"
                          src={resolveAssetUrl(caster.photo)}
                          alt={caster.name}
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                            setBrokenPhotos((prev) => ({ ...prev, [caster.id]: true }));
                          }}
                        />
                      )}
                      {brokenPhotos[caster.id] && (
                        <div className="table-image-placeholder">
                          {resolveAssetUrl(caster.photo)}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="table-image-placeholder">No Photo</span>
                  )}
                </td>
                <td>{caster.name}</td>
                <td>
                  <button onClick={() => handleEdit(caster)}>Edit</button>
                  <button className="secondary" onClick={() => handleDelete(caster)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {isCasterModalOpen
        ? createPortal(
            <div className="modal-backdrop" role="dialog" aria-modal="true">
              <form className="modal-panel" onSubmit={handleSubmit}>
                <div className="modal-header">
                  <h3>{editingId ? "Edit Caster" : "Add Caster"}</h3>
                </div>
                <div className="modal-body">
                  <section className="modal-section">
                    <div className="modal-section-title">Caster Details</div>
                    <div className="form-grid modal-form-grid">
                      <label className="form-group">
                        Caster Name
                        <input
                          value={form.name}
                          onChange={(event) => setForm({ ...form, name: event.target.value })}
                          required
                        />
                      </label>
                    </div>
                  </section>
                  <section className="modal-section">
                    <div className="modal-section-title">Caster Image</div>
                    <div className="form-grid modal-form-grid">
                      <label className="form-group">
                        Caster Photo Upload
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                          style={{ display: "none" }}
                          onChange={handlePhotoChange}
                        />
                        <div
                          className="custom-upload"
                          role="button"
                          tabIndex={0}
                          onClick={handlePhotoPick}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              handlePhotoPick();
                            }
                          }}
                        >
                          {previewUrl ? (
                            <div className="custom-upload-preview">
                              <img className="upload-thumb" src={previewUrl} alt="Caster preview" />
                              <div className="upload-file-name">
                                {photoFile ? photoFile.name : "Using saved photo"}
                              </div>
                            </div>
                          ) : (
                            <div className="custom-upload-placeholder">Choose Caster Photo</div>
                          )}
                          <div className="custom-upload-actions">
                            <button
                              type="button"
                              className="btn-upload"
                              onClick={(event) => {
                                event.stopPropagation();
                                handlePhotoPick();
                              }}
                            >
                              {previewUrl ? "Change" : "Choose Caster Photo"}
                            </button>
                            {photoFile && (
                              <button type="button" className="btn-remove" onClick={handleRemovePhoto}>
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
                  <button type="button" className="button-ghost" onClick={closeCasterModal}>
                    Cancel
                  </button>
                  <button type="submit" className="button-primary">
                    {editingId ? "Update Caster" : "Add Caster"}
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

export default CasterConfig;
