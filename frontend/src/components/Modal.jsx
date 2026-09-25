import { useEffect } from "react";

export const Modal = ({
  isOpen,
  onClose,
  title,
  icon,
  children,
  maxWidth = "520px",
  preventBackdropClose = false
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    // Prevent background scrolling when modal is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-glass-backdrop"
      onClick={preventBackdropClose ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-glass-title"
    >
      <div
        className="modal-glass-panel"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-glass-header">
          <div className="modal-glass-title-wrap">
            {icon && <span className="modal-glass-icon">{icon}</span>}
            <h3 id="modal-glass-title" className="modal-glass-title">
              {title}
            </h3>
          </div>
          <button
            type="button"
            className="modal-glass-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        <div className="modal-glass-body">{children}</div>
      </div>
    </div>
  );
};
