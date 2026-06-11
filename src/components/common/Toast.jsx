import { useEffect } from "react";
import { createPortal } from "react-dom";

function Toast({ message, type = "info", onClose }) {
  useEffect(() => {
    if (!message) {
      return undefined;
    }

    const timer = setTimeout(() => {
      onClose?.();
    }, 3000);

    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) {
    return null;
  }

  const toast = (
    <div className={`app-toast app-toast-${type}`} role="status">
      <span>{message}</span>
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  );

  return createPortal(toast, document.body);
}

export default Toast;
