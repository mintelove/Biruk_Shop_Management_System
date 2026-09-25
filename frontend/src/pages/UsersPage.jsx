import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useI18n } from "../context/I18nContext";
import { useAuth } from "../context/AuthContext";
import { Modal } from "../components/Modal";
import { PageLoader } from "../components/PageLoader";

const initialForm = {
  name: "",
  email: "",
  password: "",
  role: "salesman"
};

const initialProfileForm = {
  name: "",
  email: "",
  password: "",
  confirmPassword: ""
};

export const UsersPage = () => {
  const { t } = useI18n();
  const { user, logout, refreshUser } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [profileForm, setProfileForm] = useState(initialProfileForm);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Modal states for popup CRUD operations
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", password: "", role: "" });
  const [deletingUser, setDeletingUser] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [tableMessage, setTableMessage] = useState("");

  const fetchUsers = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setInitialLoading(true);
      setLoadError("");
    }
    try {
      const res = await api.get("/auth/users");
      setUsers(res.data);
      setLoadError("");
    } catch (err) {
      console.error("Users fetch error:", err);
      if (isInitial) {
        setLoadError("Unable to load user accounts.");
      }
    } finally {
      if (isInitial) {
        setInitialLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchUsers(true);
  }, [fetchUsers]);

  useEffect(() => {
    if (user) {
      setProfileForm((prev) => ({
        ...prev,
        name: user.name || "",
        email: user.email || ""
      }));
    }
  }, [user]);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase().trim();
    return users.filter((u) =>
      (u.name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.role || "").toLowerCase().includes(q)
    );
  }, [users, search]);

  const salesmanUsers = useMemo(() => filteredUsers.filter((account) => account.role !== "admin"), [filteredUsers]);
  const adminUsers = useMemo(() => filteredUsers.filter((account) => account.role === "admin"), [filteredUsers]);

  const onAddSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setActionLoading(true);
    try {
      await api.post("/auth/users", form);
      setTableMessage(t("users.created") || "User created successfully.");
      setForm(initialForm);
      setShowAddModal(false);
      fetchUsers();
      setTimeout(() => setTableMessage(""), 3500);
    } catch (err) {
      const apiMessage = err.response?.data?.message;
      const validationErrors = err.response?.data?.errors;
      if (Array.isArray(validationErrors) && validationErrors.length > 0) {
        const details = validationErrors.map((error) => `${error.path}: ${error.msg}`).join(" | ");
        setMessage(`${t("users.validationPrefix") || "Validation error:"} ${details}`);
      } else {
        setMessage(apiMessage || t("users.failed") || "Failed to create user.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const onToggleStatus = async (targetUser) => {
    setTableMessage("");
    try {
      await api.patch(`/auth/users/${targetUser._id}/status`, { isActive: !targetUser.isActive });
      setTableMessage(targetUser.isActive ? (t("users.deactivated") || "User deactivated.") : (t("users.activated") || "User activated."));
      fetchUsers();
      setTimeout(() => setTableMessage(""), 3000);
    } catch (err) {
      setTableMessage(err.response?.data?.message || "Failed to update status.");
    }
  };

  const onStartEdit = (targetUser) => {
    setEditingUser(targetUser);
    setEditForm({
      name: targetUser.name,
      email: targetUser.email,
      password: "",
      role: targetUser.role || "salesman"
    });
  };

  const onSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setTableMessage("");
    const payload = { name: editForm.name, email: editForm.email };
    if (editForm.password) payload.password = editForm.password;
    if (editForm.role) payload.role = editForm.role;

    setActionLoading(true);
    try {
      await api.patch(`/auth/users/${editingUser._id}`, payload);
      setTableMessage(t("users.updated") || "User updated successfully.");
      setEditingUser(null);
      setEditForm({ name: "", email: "", password: "", role: "" });
      fetchUsers();
      setTimeout(() => setTableMessage(""), 3000);
    } catch (err) {
      alert(err.response?.data?.message || t("users.failed") || "Failed to update user.");
    } finally {
      setActionLoading(false);
    }
  };

  const onConfirmDelete = async () => {
    if (!deletingUser) return;
    setActionLoading(true);
    try {
      await api.delete(`/auth/users/${deletingUser._id}`);
      setTableMessage(t("users.deleted") || "User deleted successfully.");
      setDeletingUser(null);
      fetchUsers();
      setTimeout(() => setTableMessage(""), 3000);
    } catch (err) {
      alert(err.response?.data?.message || t("users.deleteFailed") || "Failed to delete user.");
    } finally {
      setActionLoading(false);
    }
  };

  const onUpdateProfile = async (e) => {
    e.preventDefault();
    if (profileForm.password && profileForm.password !== profileForm.confirmPassword) {
      setProfileMessage(t("users.passwordMismatch") || "Passwords do not match.");
      return;
    }
    const payload = { name: profileForm.name, email: profileForm.email };
    if (profileForm.password) payload.password = profileForm.password;

    try {
      await api.patch("/auth/me", payload);
      setProfileMessage(t("users.profileUpdated") || "Profile updated successfully.");
      if (profileForm.password) {
        logout();
      } else {
        await refreshUser();
        fetchUsers();
        setTimeout(() => setProfileMessage(""), 3000);
      }
    } catch (err) {
      setProfileMessage(err.response?.data?.message || "Failed to update profile.");
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case "admin":
        return <span className="user-role-badge" style={{ background: "rgba(124, 58, 237, 0.15)", color: "#7c3aed", border: "1px solid rgba(124, 58, 237, 0.3)" }}>Admin</span>;
      case "purchaser":
        return <span className="user-role-badge" style={{ background: "rgba(14, 165, 233, 0.15)", color: "#0284c7", border: "1px solid rgba(14, 165, 233, 0.3)" }}>Purchaser</span>;
      default:
        return <span className="user-role-badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#059669", border: "1px solid rgba(16, 185, 129, 0.3)" }}>Salesman</span>;
    }
  };

  if (initialLoading) {
    return <PageLoader loading={true} message="Please wait while user data is being loaded." />;
  }

  if (loadError && !users.length) {
    return (
      <PageLoader
        loading={false}
        error={loadError}
        onRetry={() => fetchUsers(true)}
      />
    );
  }

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      {/* Page Header */}
      <div className="row-between" style={{ alignItems: "center", flexWrap: "wrap", gap: "0.8rem" }}>
        <div>
          <h2 style={{ margin: 0 }}>{t("users.title") || "User Management"}</h2>
          <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.85rem" }}>
            Manage staff accounts, roles, access permissions, and credentials
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setForm(initialForm);
            setMessage("");
            setShowAddModal(true);
          }}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
        >
          <span>+</span> {t("users.createBtn") || "Add New User"}
        </button>
      </div>

      {tableMessage && (
        <div style={{
          padding: "0.75rem 1rem",
          borderRadius: "10px",
          background: "rgba(16, 185, 129, 0.12)",
          border: "1px solid rgba(16, 185, 129, 0.25)",
          color: "var(--primary)",
          fontWeight: 600,
          fontSize: "0.9rem"
        }}>
          {tableMessage}
        </div>
      )}

      {/* Search and Summary Bar */}
      <div className="card row-between" style={{ alignItems: "center", flexWrap: "wrap", gap: "0.8rem" }}>
        <input
          placeholder="Search by name, email, or role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: "240px", flex: 1, padding: "0.55rem 0.8rem", borderRadius: "10px" }}
        />
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <span className="user-role-badge" style={{ background: "var(--card-bg)", border: "1px solid var(--border)", fontSize: "0.82rem" }}>
            Total Users: <strong>{users.length}</strong>
          </span>
          <span className="user-role-badge" style={{ background: "var(--card-bg)", border: "1px solid var(--border)", fontSize: "0.82rem" }}>
            Admins: <strong>{users.filter(u => u.role === "admin").length}</strong>
          </span>
          <span className="user-role-badge" style={{ background: "var(--card-bg)", border: "1px solid var(--border)", fontSize: "0.82rem" }}>
            Staff: <strong>{users.filter(u => u.role !== "admin").length}</strong>
          </span>
        </div>
      </div>

      {/* Staff Accounts (Salesman & Purchaser) */}
      <div className="card">
        <h3 style={{ marginBottom: "0.8rem" }}>Staff Accounts (Salesman & Purchaser)</h3>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>{t("auth.email")}</th>
                <th>Role</th>
                <th>{t("users.status")}</th>
                <th>{t("products.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {salesmanUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="no-results">No staff accounts found.</td>
                </tr>
              ) : (
                salesmanUsers.map((account) => (
                  <tr key={account._id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <div className="user-avatar-circle" style={{ width: "32px", height: "32px", fontSize: "0.85rem" }}>
                          {(account.name?.charAt(0) || "U").toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600 }}>{account.name}</span>
                      </div>
                    </td>
                    <td>{account.email}</td>
                    <td>{getRoleBadge(account.role)}</td>
                    <td>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: "0.3rem",
                        padding: "0.15rem 0.5rem", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 700,
                        background: account.isActive ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                        color: account.isActive ? "#10b981" : "#ef4444"
                      }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: account.isActive ? "#10b981" : "#ef4444" }} />
                        {account.isActive ? t("users.active") : t("users.inactive")}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                        <button className="btn secondary" onClick={() => onStartEdit(account)}>
                          {t("common.edit")}
                        </button>
                        <button
                          className={`btn ${account.isActive ? "btn-danger" : ""}`}
                          onClick={() => onToggleStatus(account)}
                          style={{ padding: "0.3rem 0.7rem", fontSize: "0.8rem" }}
                        >
                          {account.isActive ? t("users.deactivate") : t("users.activate")}
                        </button>
                        <button
                          className="btn secondary"
                          onClick={() => setDeletingUser(account)}
                          style={{ color: "var(--danger, #ef4444)" }}
                        >
                          {t("common.delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Accounts */}
      <div className="card">
        <h3 style={{ marginBottom: "0.8rem" }}>{t("users.adminAccounts") || "Administrator Accounts"}</h3>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Administrator</th>
                <th>{t("auth.email")}</th>
                <th>Role</th>
                <th>{t("users.status")}</th>
                <th>{t("products.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {adminUsers.map((account) => (
                <tr key={account._id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <div className="user-avatar-circle" style={{ width: "32px", height: "32px", fontSize: "0.85rem", background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}>
                        {(account.name?.charAt(0) || "A").toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600 }}>{account.name}</span>
                      {account._id === user._id && (
                        <span style={{ fontSize: "0.72rem", background: "rgba(100,116,139,0.15)", padding: "0.1rem 0.4rem", borderRadius: "10px", color: "var(--muted)" }}>
                          (You)
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{account.email}</td>
                  <td>{getRoleBadge("admin")}</td>
                  <td>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: "0.3rem",
                      padding: "0.15rem 0.5rem", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 700,
                      background: account.isActive ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                      color: account.isActive ? "#10b981" : "#ef4444"
                    }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: account.isActive ? "#10b981" : "#ef4444" }} />
                      {account.isActive ? t("users.active") : t("users.inactive")}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                      <button className="btn secondary" onClick={() => onStartEdit(account)}>
                        {t("common.edit")}
                      </button>
                      {account._id !== user._id && (
                        <>
                          <button
                            className={`btn ${account.isActive ? "btn-danger" : ""}`}
                            onClick={() => onToggleStatus(account)}
                            style={{ padding: "0.3rem 0.7rem", fontSize: "0.8rem" }}
                          >
                            {account.isActive ? t("users.deactivate") : t("users.activate")}
                          </button>
                          <button
                            className="btn secondary"
                            onClick={() => setDeletingUser(account)}
                            style={{ color: "var(--danger, #ef4444)" }}
                          >
                            {t("common.delete")}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Own Profile Management Card */}
      <form className="card form" onSubmit={onUpdateProfile}>
        <h3>{t("users.adminAccount") || "My Administrator Profile"}</h3>
        <p className="muted" style={{ margin: "0 0 0.8rem", fontSize: "0.85rem" }}>
          Update your display username or set a new secure password
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.8rem" }}>
          <div>
            <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
              Username
            </label>
            <input
              placeholder={t("products.name")}
              required
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              style={{ width: "100%", padding: "0.6rem 0.8rem", borderRadius: "10px" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
              Email Address
            </label>
            <input
              type="email"
              placeholder={t("auth.email")}
              required
              value={profileForm.email}
              onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              style={{ width: "100%", padding: "0.6rem 0.8rem", borderRadius: "10px" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
              New Password <span className="muted">(optional)</span>
            </label>
            <input
              type="password"
              minLength={6}
              placeholder={t("users.newPasswordOptional")}
              value={profileForm.password}
              onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })}
              style={{ width: "100%", padding: "0.6rem 0.8rem", borderRadius: "10px" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
              Confirm Password
            </label>
            <input
              type="password"
              minLength={6}
              placeholder={t("users.confirmPassword")}
              value={profileForm.confirmPassword}
              onChange={(e) => setProfileForm({ ...profileForm, confirmPassword: e.target.value })}
              style={{ width: "100%", padding: "0.6rem 0.8rem", borderRadius: "10px" }}
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.8rem" }}>
          <button className="btn" type="submit">
            {t("users.updateProfile") || "Save Profile"}
          </button>
        </div>
        {profileMessage ? <p className="stock-status stock-status--healthy" style={{ marginTop: "0.6rem" }}>{profileMessage}</p> : null}
      </form>

      {/* ADD USER POPUP MODAL */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={t("users.createBtn") || "Create New User Account"}
        maxWidth="500px"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
        }
      >
        <form onSubmit={onAddSubmit} className="stack" style={{ gap: "0.9rem" }}>
          {message && (
            <div style={{
              padding: "0.6rem 0.8rem",
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              borderRadius: "8px",
              color: "#ef4444",
              fontSize: "0.85rem"
            }}>
              {message}
            </div>
          )}

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.3rem" }}>
              Full Name *
            </label>
            <input
              placeholder="e.g. John Doe"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={{ width: "100%", padding: "0.65rem 0.8rem", borderRadius: "10px" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.3rem" }}>
              {t("auth.email")} *
            </label>
            <input
              type="email"
              placeholder="e.g. user@shop.com"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              style={{ width: "100%", padding: "0.65rem 0.8rem", borderRadius: "10px" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.3rem" }}>
              Password (min 6 characters) *
            </label>
            <input
              type="password"
              placeholder="••••••••"
              minLength={6}
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              style={{ width: "100%", padding: "0.65rem 0.8rem", borderRadius: "10px" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.3rem" }}>
              User Role *
            </label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              style={{ width: "100%", padding: "0.65rem 0.8rem", borderRadius: "10px" }}
            >
              <option value="salesman">{t("common.salesman") || "Salesman"}</option>
              <option value="purchaser">{t("common.purchaser") || "Purchaser"}</option>
              <option value="admin">{t("common.admin") || "Admin"}</option>
            </select>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", marginTop: "0.6rem" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowAddModal(false)}
              disabled={actionLoading}
              style={{ background: "#64748b", color: "#fff" }}
            >
              {t("common.cancel", "Cancel")}
            </button>
            <button
              type="submit"
              className="btn"
              disabled={actionLoading}
            >
              {actionLoading ? "Creating..." : (t("users.createBtn") || "Create User")}
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT USER POPUP MODAL */}
      <Modal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        title={`Edit User: ${editingUser?.name || ""}`}
        maxWidth="500px"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        }
      >
        <form onSubmit={onSaveEdit} className="stack" style={{ gap: "0.9rem" }}>
          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.3rem" }}>
              Full Name *
            </label>
            <input
              required
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              style={{ width: "100%", padding: "0.65rem 0.8rem", borderRadius: "10px" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.3rem" }}>
              Email Address *
            </label>
            <input
              type="email"
              required
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              style={{ width: "100%", padding: "0.65rem 0.8rem", borderRadius: "10px" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.3rem" }}>
              Role
            </label>
            <select
              value={editForm.role}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
              style={{ width: "100%", padding: "0.65rem 0.8rem", borderRadius: "10px" }}
            >
              <option value="salesman">{t("common.salesman") || "Salesman"}</option>
              <option value="purchaser">{t("common.purchaser") || "Purchaser"}</option>
              <option value="admin">{t("common.admin") || "Admin"}</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.3rem" }}>
              Set New Password <span className="muted">(leave blank to keep current)</span>
            </label>
            <input
              type="password"
              minLength={6}
              placeholder="Leave blank to keep unchanged"
              value={editForm.password}
              onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
              style={{ width: "100%", padding: "0.65rem 0.8rem", borderRadius: "10px" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", marginTop: "0.6rem" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setEditingUser(null)}
              disabled={actionLoading}
              style={{ background: "#64748b", color: "#fff" }}
            >
              {t("common.cancel", "Cancel")}
            </button>
            <button
              type="submit"
              className="btn"
              disabled={actionLoading}
            >
              {actionLoading ? "Saving..." : (t("users.save") || "Save Changes")}
            </button>
          </div>
        </form>
      </Modal>

      {/* DELETE USER CONFIRMATION POPUP MODAL */}
      <Modal
        isOpen={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        title="Confirm User Account Deletion"
        maxWidth="460px"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        }
      >
        {deletingUser && (
          <div className="stack" style={{ gap: "1rem" }}>
            <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.5 }}>
              Are you sure you want to delete the user account:
            </p>
            <div style={{
              padding: "0.75rem 1rem",
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              borderRadius: "10px"
            }}>
              <strong style={{ fontSize: "1.05rem", color: "#ef4444" }}>{deletingUser.name}</strong>
              <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                Email: {deletingUser.email} • Role: {deletingUser.role}
              </div>
            </div>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--muted)" }}>
              This action cannot be undone. The user will immediately lose system access.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", marginTop: "0.4rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingUser(null)}
                disabled={actionLoading}
                style={{ background: "#64748b", color: "#fff" }}
              >
                {t("common.cancel", "Cancel")}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={onConfirmDelete}
                disabled={actionLoading}
              >
                {actionLoading ? "Deleting..." : "Yes, Delete Account"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
