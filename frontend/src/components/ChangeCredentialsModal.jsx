import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { Modal } from "./Modal";

export const ChangeCredentialsModal = ({ isOpen, onClose }) => {
  const { user, updateProfile } = useAuth();
  const { t } = useI18n();

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (user && isOpen) {
      setName(user.name || "");
      setPassword("");
      setConfirmPassword("");
      setError("");
      setSuccess("");
    }
  }, [user, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Username / Display Name cannot be empty.");
      return;
    }

    if (password) {
      if (password.length < 6) {
        setError("New password must be at least 6 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setError("New password and confirm password do not match.");
        return;
      }
    }

    // Only update fields that were changed
    const payload = {};
    if (trimmedName !== user.name) {
      payload.name = trimmedName;
    }
    if (password) {
      payload.password = password;
    }

    if (Object.keys(payload).length === 0) {
      setError("No changes were made.");
      return;
    }

    setLoading(true);
    try {
      await updateProfile(payload);
      setSuccess("Account information updated successfully!");
      setPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update profile credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="My Account Credentials"
      maxWidth="480px"
      icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      }
    >
      <form onSubmit={handleSubmit} className="stack" style={{ gap: "1rem" }}>
        <div style={{
          padding: "0.75rem 0.9rem",
          background: "var(--input-bg, rgba(100,116,139,0.06))",
          borderRadius: "12px",
          border: "1px solid var(--border)",
          fontSize: "0.85rem"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
            <span className="muted">Role</span>
            <strong style={{ textTransform: "capitalize", color: "var(--primary)" }}>{user?.role || "user"}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="muted">Email</span>
            <span style={{ fontWeight: 500 }}>{user?.email}</span>
          </div>
        </div>

        {error && (
          <div style={{
            padding: "0.6rem 0.8rem",
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            borderRadius: "8px",
            color: "#ef4444",
            fontSize: "0.85rem",
            fontWeight: 500
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            padding: "0.6rem 0.8rem",
            background: "rgba(16, 185, 129, 0.12)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            borderRadius: "8px",
            color: "#10b981",
            fontSize: "0.85rem",
            fontWeight: 500
          }}>
            {success}
          </div>
        )}

        <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>
            Username / Full Name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your username"
            style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "10px" }}
          />
        </div>

        <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>
              New Password <span className="muted" style={{ fontWeight: 400 }}>(leave empty to keep current)</span>
            </label>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--primary)",
                fontSize: "0.78rem",
                cursor: "pointer",
                padding: 0
              }}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <input
            type={showPassword ? "text" : "password"}
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "10px" }}
          />
        </div>

        {password && (
          <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>
              Confirm New Password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your new password"
              style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "10px" }}
            />
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", marginTop: "0.5rem" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={loading}
            style={{ background: "var(--btn-secondary-bg, #64748b)", color: "#fff" }}
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            type="submit"
            className="btn"
            disabled={loading}
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
};
