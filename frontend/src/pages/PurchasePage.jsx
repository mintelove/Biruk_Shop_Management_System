import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { formatCurrency } from "../utils/currency";
import { useI18n } from "../context/I18nContext";
import { useSocket } from "../hooks/useSocket";
import { useAuth } from "../context/AuthContext";

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 17v2a2 2 0 002 2h10a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ONE_HOUR = 60 * 60 * 1000;

const statusBadge = (status) => {
  const colors = {
    active: "#22c55e",
    returned: "#f59e0b",
    reversed: "#ef4444",
    pending_return: "#eab308",
    return_rejected: "#ef4444"
  };
  const labels = {
    active: "active",
    returned: "returned",
    reversed: "reversed",
    pending_return: "pending return",
    return_rejected: "return rejected"
  };
  return (
    <span style={{
      display: "inline-block", padding: "0.15rem 0.5rem", borderRadius: "6px", fontSize: "0.72rem", fontWeight: 700,
      background: `${colors[status] || "#94a3b8"}22`, color: colors[status] || "#94a3b8", textTransform: "uppercase"
    }}>{labels[status] || status}</span>
  );
};

const adminPriceBadge = (price) => (
  <div style={{
    padding: "0.4rem 0.7rem", borderRadius: "8px", fontSize: "0.82rem", fontWeight: 600,
    background: "rgba(59,130,246,0.08)", color: "#2563eb", border: "1px solid rgba(59,130,246,0.15)",
    marginBottom: "0.5rem"
  }}>
    💰 Minimum Allowed Price: <strong>Br {Number(price).toFixed(2)}</strong>
  </div>
);

export const PurchasePage = () => {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  
  const [data, setData] = useState({ transactions: [], byProduct: [], totalProfit: 0 });
  const [dateFilter, setDateFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");

  // Edit modal (Salesman direct edit or Admin edit)
  const [editTx, setEditTx] = useState(null);
  const [editForm, setEditForm] = useState({ sellingPrice: "" });
  const [editError, setEditError] = useState("");

  // Request modal (Salesman price_change / return request)
  const [reqTx, setReqTx] = useState(null);
  const [reqType, setReqType] = useState("price_change"); // "price_change" or "return"
  const [reqReason, setReqReason] = useState("");
  const [reqNewPrice, setReqNewPrice] = useState("");
  const [reqError, setReqError] = useState("");
  const [reqSuccess, setReqSuccess] = useState("");

  // Admin: pending edit/return requests
  const [editRequests, setEditRequests] = useState([]);
  const [activeTab, setActiveTab] = useState("price_change"); // "price_change" or "return"
  const [rejectingReq, setRejectingReq] = useState(null);
  const [rejectionNote, setRejectionNote] = useState("");

  // Salesman: own requests list
  const [myRequests, setMyRequests] = useState([]);

  const fetchData = useCallback(async () => {
    const params = {};
    if (dateFilter) params.date = dateFilter;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    try {
      const res = await api.get("/sales/purchases", { params });
      setData(res.data);
    } catch { /* silent */ }
  }, [dateFilter, startDate, endDate]);

  const fetchEditRequests = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await api.get("/edit-requests");
      setEditRequests(res.data);
    } catch { /* silent */ }
  }, [isAdmin]);

  const fetchMyRequests = useCallback(async () => {
    if (isAdmin) return;
    try {
      const res = await api.get("/edit-requests/mine");
      setMyRequests(res.data);
    } catch { /* silent */ }
  }, [isAdmin]);

  useEffect(() => {
    fetchData();
    fetchEditRequests();
    fetchMyRequests();
    const interval = setInterval(() => {
      fetchData();
      fetchMyRequests();
      if (isAdmin) fetchEditRequests();
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchData, fetchEditRequests, fetchMyRequests, isAdmin]);

  useSocket("stock:update", () => {
    fetchData();
    fetchEditRequests();
    fetchMyRequests();
  });

  const getRequestStatus = (txId) => {
    const reqs = myRequests.filter(r => String(r.transaction_id?._id || r.transaction_id) === String(txId));
    if (reqs.length === 0) return null;
    const sorted = [...reqs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sorted[0];
  };

  const filteredTransactions = useMemo(() => {
    if (!search.trim()) return data.transactions;
    const q = search.toLowerCase().trim();
    return data.transactions.filter((tx) =>
      (tx.product_name || "").toLowerCase().includes(q) || (tx.salesman || "").toLowerCase().includes(q)
    );
  }, [data.transactions, search]);

  const onExport = (format) => {
    const params = new URLSearchParams();
    if (dateFilter) params.set("date", dateFilter);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    const token = localStorage.getItem("token");
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
    const url = `${baseUrl}/sales/purchases/export/${format}?${params.toString()}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `profit_report_${new Date().toISOString().slice(0, 10)}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      })
      .catch(() => {});
  };

  // Salesman: direct edit price allowed only once, within 1 hour
  const canEditPrice = (tx) => {
    if (tx.status !== "active" && tx.status !== "return_rejected") return false;
    if (user?.role !== "salesman") return false;
    const userId = user?.id || user?._id;
    const isOwner = String(tx.salesman_id) === String(userId);
    if (!isOwner || tx.edited || tx.priceEditedDirectly) return false;
    return (Date.now() - new Date(tx.date).getTime()) <= ONE_HOUR;
  };

  // Salesman: request price change allowed after 1 hour, or after first edit, indefinitely
  const canRequestPriceChange = (tx) => {
    if (tx.status !== "active" && tx.status !== "return_rejected") return false;
    if (user?.role !== "salesman") return false;
    const userId = user?.id || user?._id;
    const isOwner = String(tx.salesman_id) === String(userId);
    if (!isOwner) return false;

    const diffMs = Date.now() - new Date(tx.date).getTime();
    const isAfterHour = diffMs > ONE_HOUR;
    const isAlreadyEdited = tx.edited || tx.priceEditedDirectly;

    if (!isAfterHour && !isAlreadyEdited) return false;

    const latest = getRequestStatus(tx._id);
    if (latest && latest.status === "pending") return false;
    return true;
  };

  // Salesman: return request allowed within 1 hour of original sale
  const canRequestReturn = (tx) => {
    if (tx.status !== "active" && tx.status !== "return_rejected") return false;
    if (user?.role !== "salesman") return false;
    const userId = user?.id || user?._id;
    const isOwner = String(tx.salesman_id) === String(userId);
    if (!isOwner) return false;

    const withinHour = (Date.now() - new Date(tx.date).getTime()) <= ONE_HOUR;
    if (!withinHour) return false;

    const latest = getRequestStatus(tx._id);
    if (latest && latest.status === "pending") return false;
    return true;
  };

  // Salesman/Admin direct edit price submission
  const onEditSubmit = async () => {
    setEditError("");
    const newPriceVal = Number(editForm.sellingPrice);
    if (!newPriceVal || newPriceVal <= 0) {
      setEditError("Please enter a valid selling price.");
      return;
    }
    
    // Enforce minSellingPrice validation
    if (editTx.minSellingPrice && newPriceVal < editTx.minSellingPrice) {
      setEditError("Requested price is below the minimum selling price.");
      return;
    }

    try {
      await api.put(`/sales/${editTx._id}`, { sellingPrice: newPriceVal });
      setEditTx(null);
      fetchData();
    } catch (err) {
      setEditError(err.response?.data?.message || "Edit failed.");
    }
  };

  // Salesman: submit a price change or return request
  const onReqSubmit = async () => {
    setReqError("");
    setReqSuccess("");
    try {
      const body = { transactionId: reqTx._id, type: reqType, reason: reqReason.trim() };
      if (reqType === "price_change") {
        const valPrice = Number(reqNewPrice);
        if (!valPrice || valPrice <= 0) {
          setReqError("Please enter a valid price.");
          return;
        }
        if (reqTx.minSellingPrice && valPrice < reqTx.minSellingPrice) {
          setReqError("Requested price is below the minimum selling price.");
          return;
        }
        body.newPrice = valPrice;
      }

      await api.post("/edit-requests", body);
      setReqSuccess("Request submitted successfully!");
      fetchMyRequests();
      fetchData();
      setTimeout(() => {
        setReqTx(null);
        setReqReason("");
        setReqNewPrice("");
        setReqSuccess("");
      }, 1500);
    } catch (err) {
      setReqError(err.response?.data?.message || "Request failed.");
    }
  };

  // Admin: approve or reject
  const onReview = async (id, status, admin_note = "") => {
    try {
      await api.patch(`/edit-requests/${id}`, { status, admin_note });
      fetchEditRequests();
      fetchData();
      setRejectingReq(null);
      setRejectionNote("");
    } catch (err) {
      alert(err.response?.data?.message || "Review failed.");
    }
  };

  const profitCardClass = data.totalProfit > 0
    ? "profit-total-card"
    : data.totalProfit < 0 ? "profit-total-card profit-total-card--negative" : "profit-total-card profit-total-card--zero";

  const pendingRequests = editRequests.filter(r => r.status === "pending");
  const priceChangeRequests = pendingRequests.filter(r => r.type === "price_change");
  const returnRequests = pendingRequests.filter(r => r.type === "return" || r.type === "cashback");

  const renderActions = (tx) => {
    if (isAdmin) {
      return (
        <button className="btn" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
          onClick={() => { setEditTx(tx); setEditForm({ sellingPrice: tx.sellingPrice }); setEditError(""); }}>
          ✏️ Edit
        </button>
      );
    }

    const userId = user?.id || user?._id;
    const isOwner = String(tx.salesman_id) === String(userId);
    if (!isOwner) return null;

    const latestReq = getRequestStatus(tx._id);
    if (latestReq && latestReq.status === "pending") {
      return (
        <span style={{
          display: "inline-block", padding: "0.2rem 0.5rem", fontSize: "0.7rem",
          color: "#f59e0b", fontWeight: 600, lineHeight: "1.3"
        }}>
          ⏳ Pending {latestReq.type === "price_change" ? "Price Change" : "Return"}
        </span>
      );
    }

    const showDirectEdit = canEditPrice(tx);
    const showRequestPriceChange = canRequestPriceChange(tx);
    const showReturn = canRequestReturn(tx);

    return (
      <div style={{ display: "flex", gap: "0.3rem" }}>
        {showDirectEdit && (
          <button className="btn" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
            onClick={() => { setEditTx(tx); setEditForm({ sellingPrice: tx.sellingPrice }); setEditError(""); }}>
            Edit Price
          </button>
        )}
        {showRequestPriceChange && (
          <button className="btn" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem", background: "#8b5cf6" }}
            onClick={() => { setReqTx(tx); setReqType("price_change"); setReqReason(""); setReqNewPrice(""); setReqError(""); setReqSuccess(""); }}>
            Request Price Change
          </button>
        )}
        {showReturn && (
          <button className="btn" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem", background: "#e11d48" }}
            onClick={() => { setReqTx(tx); setReqType("return"); setReqReason(""); setReqNewPrice(""); setReqError(""); setReqSuccess(""); }}>
            Return
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="stack">
      <h2>{t("nav.purchases")}</h2>

      {/* Date Filters + Export */}
      <div className="card csv-export-bar" style={{ flexWrap: "wrap", gap: "1rem" }}>
        <div className="csv-export-group">
          <label>{t("dashboard.singleDate")}</label>
          <input type="date" value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); setStartDate(""); setEndDate(""); }} />
        </div>
        <div className="csv-export-group">
          <label>{t("sales.startDate")}</label>
          <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setDateFilter(""); }} />
        </div>
        <div className="csv-export-group">
          <label>{t("sales.endDate")}</label>
          <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setDateFilter(""); }} />
        </div>
        <div className="csv-export-group" style={{ alignSelf: "flex-end" }}>
          <button type="button" className="btn btn-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem", background: "#64748b", color: "#fff", borderRadius: "8px", border: "none", cursor: "pointer" }}
            onClick={() => { setDateFilter(""); setStartDate(""); setEndDate(""); }}>
            {t("dashboard.resetFilter")}
          </button>
        </div>
        <div className="profit-export-row">
          <button type="button" className="csv-export-btn" onClick={() => onExport("csv")}>
            <DownloadIcon /> {t("sales.exportCsv")}
          </button>
          <button type="button" className="csv-export-btn" style={{ background: "linear-gradient(135deg, #e11d48, #be123c)" }} onClick={() => onExport("pdf")}>
            <DownloadIcon /> {t("dashboard.exportPdf")}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
        {/* Total Profit Card */}
        <div className={profitCardClass}>
          <p className="profit-total-label">{t("sales.totalProfit")}</p>
          <p className="profit-total-value">{formatCurrency(data.totalProfit)}</p>
          <p className="profit-total-subtitle">
            {data.transactions.filter(tx => ["active", "pending_return", "return_rejected"].includes(tx.status)).length} {t("dashboard.transactions")}
          </p>
        </div>

        {/* Total Items Sold Card */}
        <div className="profit-total-card" style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)", color: "#fff", borderColor: "rgba(255,255,255,0.1)" }}>
          <p className="profit-total-label" style={{ color: "rgba(255,255,255,0.9)" }}>Total Items Sold</p>
          <p className="profit-total-value" style={{ color: "#fff" }}>{data.totalItemsSold || 0}</p>
          <p className="profit-total-subtitle" style={{ color: "rgba(255,255,255,0.8)" }}>
            Across all {data.transactions.filter(tx => ["active", "pending_return", "return_rejected"].includes(tx.status)).length} active transactions
          </p>
        </div>
      </div>

      {/* Admin pending requests queue with TABS */}
      {isAdmin && pendingRequests.length > 0 && (
        <div className="card profit-table-card">
          <h3 style={{ marginBottom: "0.8rem" }}>📋 Sales Approval Worklist ({pendingRequests.length} Pending)</h3>
          
          <div className="admin-tabs-nav">
            <button className={`admin-tab-btn ${activeTab === "price_change" ? "active" : ""}`} onClick={() => setActiveTab("price_change")}>
              💲 Price Change ({priceChangeRequests.length})
            </button>
            <button className={`admin-tab-btn ${activeTab === "return" ? "active" : ""}`} onClick={() => setActiveTab("return")}>
              ↩️ Return Requests ({returnRequests.length})
            </button>
          </div>

          <table>
            <thead>
              <tr>
                <th>{t("sales.salesman")}</th>
                <th>{t("sales.product")}</th>
                {activeTab === "return" && <th>{t("sales.qty")}</th>}
                <th>Original Price</th>
                <th>{activeTab === "price_change" ? "Requested Price" : "Refund Amount"}</th>
                <th>{t("sales.reason")}</th>
                <th>Requested</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {(activeTab === "price_change" ? priceChangeRequests : returnRequests).length === 0 ? (
                <tr>
                  <td colSpan={activeTab === "return" ? 8 : 7} style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
                    No pending {activeTab === "price_change" ? "price change" : "return"} requests in queue.
                  </td>
                </tr>
              ) : (
                (activeTab === "price_change" ? priceChangeRequests : returnRequests).map((r) => (
                  <tr key={r._id}>
                    <td>{r.salesman_id?.name || "N/A"}</td>
                    <td>{r.transaction_id?.product_name || "N/A"}</td>
                    {activeTab === "return" && <td>{r.transaction_id?.quantity || "—"}</td>}
                    <td>{formatCurrency(r.transaction_id?.unit_price || 0)}</td>
                    <td>
                      {r.type === "price_change" 
                        ? formatCurrency(r.newPrice || 0) 
                        : formatCurrency(r.transaction_id?.total_price || 0)
                      }
                    </td>
                    <td>
                      <span style={{ fontStyle: "italic" }}>"{r.reason}"</span>
                    </td>
                    <td>{new Date(r.createdAt).toLocaleString(language === "am" ? "am-ET" : "en-US")}</td>
                    <td style={{ display: "flex", gap: "0.3rem" }}>
                      <button className="btn" style={{ padding: "0.3rem 0.7rem", fontSize: "0.8rem", background: "#22c55e" }} onClick={() => onReview(r._id, "approved")}>
                        {t("sales.approve")}
                      </button>
                      <button className="btn btn-danger" style={{ padding: "0.3rem 0.7rem", fontSize: "0.8rem" }} onClick={() => setRejectingReq(r)}>
                        {t("sales.reject")}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Profit Per Product */}
      <div className="card profit-table-card">
        <h3 style={{ marginBottom: "0.8rem" }}>{t("sales.profitPerProduct")}</h3>
        <table>
          <thead>
            <tr>
              <th>{t("sales.product")}</th>
              <th>{t("sales.qty")}</th>
              <th>{t("sales.totalProfit")}</th>
            </tr>
          </thead>
          <tbody>
            {data.byProduct.length === 0 ? (
              <tr><td colSpan={3} className="no-results">{t("sales.noResults")}</td></tr>
            ) : (
              data.byProduct.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.product_name}</td>
                  <td>{item.totalQuantity}</td>
                  <td style={{ fontWeight: 600, color: item.totalProfit > 0 ? "#22c55e" : item.totalProfit < 0 ? "#ef4444" : "#94a3b8" }}>
                    {formatCurrency(item.totalProfit)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* All Transactions */}
      <div className="card profit-table-card">
        <h3 style={{ marginBottom: "0.8rem" }}>{t("sales.allTransactions")}</h3>
        <div className="sales-search-wrap" style={{ marginBottom: "0.8rem" }}>
          <input className="sales-search-input" placeholder={t("sales.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <table>
          <thead>
            <tr>
              <th>{t("sales.date")}</th>
              <th>{t("sales.product")}</th>
              <th>{t("sales.qty")}</th>
              <th>{t("sales.unitPrice")}</th>
              <th>Cost Price</th>
              <th>{t("sales.totalProfit")}</th>
              <th>{t("sales.salesman")}</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.length === 0 ? (
              <tr><td colSpan={9} className="no-results">{t("sales.noResults")}</td></tr>
            ) : (
              filteredTransactions.map((tx) => (
                <tr key={tx._id} style={tx.status !== "active" && tx.status !== "pending_return" && tx.status !== "return_rejected" ? { opacity: 0.55 } : undefined}>
                  <td>{new Date(tx.date).toLocaleString(language === "am" ? "am-ET" : "en-US")}</td>
                  <td>{tx.product_name}</td>
                  <td>{tx.quantity}</td>
                  <td>{formatCurrency(tx.sellingPrice)}</td>
                  <td>{formatCurrency(tx.purchasedPrice)}</td>
                  <td style={{ fontWeight: 600, color: tx.profit > 0 ? "#22c55e" : tx.profit < 0 ? "#ef4444" : "#94a3b8" }}>
                    {formatCurrency(tx.profit)}
                  </td>
                  <td>{tx.salesman}</td>
                  <td>
                    {statusBadge(tx.status)}
                    {tx.adminMessage && (
                      <div style={{ marginTop: "0.2rem", fontSize: "0.72rem", color: "#dc2626", fontWeight: 600 }}>
                        ⚠️ {tx.adminMessage}
                      </div>
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {renderActions(tx)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Salesman: My Request History */}
      {!isAdmin && myRequests.length > 0 && (
        <div className="card profit-table-card">
          <h3 style={{ marginBottom: "0.8rem" }}>📄 My Request History</h3>
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>{t("sales.product")}</th>
                <th>Details</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Admin Feedback</th>
              </tr>
            </thead>
            <tbody>
              {myRequests.map((r) => {
                const statusColors = { pending: "#eab308", approved: "#22c55e", rejected: "#ef4444" };
                return (
                  <tr key={r._id}>
                    <td>
                      <span style={{
                        display: "inline-block", padding: "0.15rem 0.5rem", borderRadius: "6px", fontSize: "0.72rem", fontWeight: 700,
                        background: `${r.type === "price_change" ? "#8b5cf6" : "#e11d48"}18`,
                        color: r.type === "price_change" ? "#8b5cf6" : "#e11d48", textTransform: "uppercase"
                      }}>{r.type === "price_change" ? "Price Change" : "Return"}</span>
                    </td>
                    <td>{r.transaction_id?.product_name || "N/A"}</td>
                    <td style={{ fontSize: "0.82rem" }}>
                      {r.type === "price_change" ? (
                        <span>{formatCurrency(r.oldPrice || 0)} → <strong>{formatCurrency(r.newPrice || 0)}</strong></span>
                      ) : (
                        <span>Refund: {formatCurrency(r.refundAmount || r.transaction_id?.total_price || 0)}</span>
                      )}
                    </td>
                    <td>
                      <span style={{
                        display: "inline-block", padding: "0.15rem 0.5rem", borderRadius: "6px", fontSize: "0.72rem", fontWeight: 700,
                        background: `${statusColors[r.status] || "#94a3b8"}22`, color: statusColors[r.status] || "#94a3b8", textTransform: "uppercase"
                      }}>{r.status}</span>
                    </td>
                    <td style={{ fontSize: "0.82rem" }}>{new Date(r.createdAt).toLocaleString(language === "am" ? "am-ET" : "en-US")}</td>
                    <td style={{ fontSize: "0.82rem" }}>
                      {r.status === "rejected" && r.admin_note ? (
                        <span style={{ color: "#dc2626", fontWeight: 600 }}>⚠️ {r.admin_note}</span>
                      ) : r.status === "approved" ? (
                        <span style={{ color: "#22c55e", fontWeight: 600 }}>✅ Approved</span>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>⏳ Awaiting review</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Price Modal */}
      {editTx && (
        <div className="modal-backdrop" onClick={() => setEditTx(null)}>
          <div className="card modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>✏️ {isAdmin ? "Admin Edit Price" : "Edit Transaction Price"}</h3>
            <p style={{ margin: "0.4rem 0", color: "var(--muted)" }}>{editTx.product_name}</p>
            {editTx.minSellingPrice && adminPriceBadge(editTx.minSellingPrice)}
            {editError && <p className="error" style={{ margin: "0.4rem 0" }}>{editError}</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.6rem" }}>
              <div>
                <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.2rem" }}>Selling Price</label>
                <input type="number" min="0.01" step="0.01" value={editForm.sellingPrice}
                  onChange={(e) => setEditForm({ ...editForm, sellingPrice: e.target.value })} style={{ width: "100%", padding: "0.55rem" }} />
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem" }}>
                <button className="btn" onClick={onEditSubmit}>{t("sales.save")}</button>
                <button className="btn" style={{ background: "#64748b" }} onClick={() => setEditTx(null)}>{t("sales.cancel")}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Request Modal (Price Change / Return) */}
      {reqTx && (
        <div className="modal-backdrop" onClick={() => setReqTx(null)}>
          <div className="card modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{reqType === "return" ? "↩️ Request Return Approval" : "📝 Request Price Change"}</h3>

            {/* Transaction Details */}
            <div style={{
              margin: "0.6rem 0", padding: "0.7rem", borderRadius: "10px",
              background: "var(--card-bg, rgba(100,116,139,0.06))",
              border: "1px solid var(--input-border, rgba(100,116,139,0.15))"
            }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem 1rem", fontSize: "0.84rem" }}>
                <div><span style={{ color: "var(--muted)", fontWeight: 500 }}>Transaction ID:</span> <strong style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{String(reqTx._id).slice(-8).toUpperCase()}</strong></div>
                <div><span style={{ color: "var(--muted)", fontWeight: 500 }}>Product:</span> <strong>{reqTx.product_name}</strong></div>
                <div><span style={{ color: "var(--muted)", fontWeight: 500 }}>Quantity Sold:</span> <strong>{reqTx.quantity}</strong></div>
                <div><span style={{ color: "var(--muted)", fontWeight: 500 }}>Selling Price:</span> <strong>Br {Number(reqTx.sellingPrice).toFixed(2)}</strong></div>
              </div>
            </div>

            {reqType === "price_change" && reqTx.minSellingPrice && adminPriceBadge(reqTx.minSellingPrice)}
            {reqError && <p className="error" style={{ margin: "0.4rem 0" }}>{reqError}</p>}
            {reqSuccess && <p style={{ margin: "0.4rem 0", color: "#22c55e", fontWeight: 600 }}>{reqSuccess}</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.6rem" }}>
              {reqType === "price_change" && (
                <div>
                  <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.2rem" }}>Requested Unit Price (Br)</label>
                  <input type="number" min="0.01" step="0.01" value={reqNewPrice}
                    onChange={(e) => setReqNewPrice(e.target.value)} style={{ width: "100%", padding: "0.55rem" }} />
                </div>
              )}
              <div>
                <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.2rem" }}>
                  {reqType === "return" ? "Reason for Return" : "Reason for Price Correction"}
                </label>
                <textarea value={reqReason} onChange={(e) => setReqReason(e.target.value)} rows={3}
                  placeholder={reqType === "return" ? "Describe the customer issue or return details..." : "Describe why this correction is necessary..."}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "1px solid var(--input-border)", background: "var(--input-bg)", color: "var(--input-text)", fontFamily: "inherit", fontSize: "0.92rem", resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem" }}>
                <button className="btn" onClick={onReqSubmit} disabled={!reqReason.trim()} style={{ background: reqType === "return" ? "#e11d48" : undefined }}>
                  {t("sales.submitRequest")}
                </button>
                <button className="btn" style={{ background: "#64748b" }} onClick={() => setReqTx(null)}>{t("sales.cancel")}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Rejection Reason Modal */}
      {rejectingReq && (
        <div className="modal-backdrop" onClick={() => setRejectingReq(null)}>
          <div className="card modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: "#ef4444" }}>❌ Enter Rejection Note</h3>
            <p style={{ margin: "0.4rem 0", color: "var(--muted)" }}>
              Rejecting {rejectingReq.type === "price_change" ? "Price Change" : "Return"} request for "{rejectingReq.transaction_id?.product_name || "item"}".
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.6rem" }}>
              <div>
                <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.2rem" }}>Rejection Reason (Salesman will see this)</label>
                <textarea value={rejectionNote} onChange={(e) => setRejectionNote(e.target.value)} rows={3}
                  placeholder="Explain why this request is being rejected..."
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "1px solid var(--input-border)", background: "var(--input-bg)", color: "var(--input-text)", fontFamily: "inherit", fontSize: "0.92rem", resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem" }}>
                <button className="btn btn-danger" onClick={() => onReview(rejectingReq._id, "rejected", rejectionNote)} disabled={!rejectionNote.trim()}>
                  Confirm Rejection
                </button>
                <button className="btn" style={{ background: "#64748b" }} onClick={() => setRejectingReq(null)}>{t("sales.cancel")}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
