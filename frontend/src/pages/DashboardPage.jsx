import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../hooks/useSocket";
import { formatCurrency } from "../utils/currency";
import { useI18n } from "../context/I18nContext";
import { PageLoader } from "../components/PageLoader";
import { StatCard } from "../components/StatCard";

// Icons for Dashboard Cards
const RevenueIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
    <line x1="12" y1="6" x2="12" y2="8" />
    <line x1="12" y1="16" x2="12" y2="18" />
  </svg>
);

const TodaySalesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <path d="M8 14h.01" />
    <path d="M12 14h.01" />
    <path d="M16 14h.01" />
  </svg>
);

const ProfitIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const TodayProfitIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M14.8 9A2 2 0 0 0 13 8h-2a2 2 0 1 0 0 4h2a2 2 0 1 1 0 4h-2a2 2 0 0 1-1.8-1" />
    <line x1="12" y1="6" x2="12" y2="7" />
    <line x1="12" y1="17" x2="12" y2="18" />
  </svg>
);

const ProductCatalogIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const LowStockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const CriticalStockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const TransactionsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const WeeklyIncomeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <path d="M12 14v4" />
    <path d="M10 16h4" />
  </svg>
);

const WeeklyProfitIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);

const TrophyIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

// Export icons for shared stat cards

export const DashboardPage = () => {
  const { user } = useAuth();
  const { t } = useI18n();

  // Core Data States
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [dashboardLoading, setDashboardLoading] = useState(false);

  // Sales Tracking & Product Breakdown
  const [trackingData, setTrackingData] = useState(null);
  const [trackingError, setTrackingError] = useState("");
  const [trackingLoading, setTrackingLoading] = useState(false);

  // Profit Data (from /sales/purchases)
  const [profitData, setProfitData] = useState({ totalProfit: 0, transactions: [], byProduct: [] });
  const [profitLoading, setProfitLoading] = useState(false);

  // Catalog & Inventory Data
  const [allProducts, setAllProducts] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [topProducts, setTopProducts] = useState([]);

  // Filter States
  const [dateMode, setDateMode] = useState("single"); // "single" | "range"
  const [singleDate, setSingleDate] = useState("");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [activeFilter, setActiveFilter] = useState("none");
  const [weekOffset, setWeekOffset] = useState(0);

  // Build current date filter params for API calls
  const getDateParams = useCallback(() => {
    if (dateMode === "single" && singleDate) {
      return { date: singleDate };
    }
    if (dateMode === "range" && (rangeFrom || rangeTo)) {
      const params = {};
      if (rangeFrom) params.startDate = rangeFrom;
      if (rangeTo) params.endDate = rangeTo;
      return params;
    }
    return {};
  }, [dateMode, singleDate, rangeFrom, rangeTo]);

  // Fetch Dashboard (Admin or Salesman)
  const fetchDashboard = useCallback(async () => {
    const endpoint = user?.role === "admin" ? "/dashboard/admin" : "/dashboard/salesman";
    if (!endpoint) return;
    try {
      setDashboardLoading(true);
      setError("");
      const params = { weekOffset, ...getDateParams() };
      const res = await api.get(endpoint, { params });
      setData(res.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || t("dashboard.loadFailed"));
    } finally {
      setDashboardLoading(false);
    }
  }, [t, user?.role, weekOffset, getDateParams]);

  // Fetch Profit Data from /sales/purchases
  const fetchProfit = useCallback(async () => {
    try {
      setProfitLoading(true);
      const dateParams = getDateParams();
      const params = {};
      if (dateParams.date) params.date = dateParams.date;
      if (dateParams.startDate) params.startDate = dateParams.startDate;
      if (dateParams.endDate) params.endDate = dateParams.endDate;
      const res = await api.get("/sales/purchases", { params });
      if (res.data) {
        setProfitData(res.data);
      }
    } catch {
      // silent
    } finally {
      setProfitLoading(false);
    }
  }, [getDateParams]);

  // Fetch Sales Tracking & breakdown
  const fetchSalesTracking = useCallback(async () => {
    try {
      setTrackingLoading(true);
      setTrackingError("");
      const dateParams = getDateParams();
      const params = {};
      if (dateParams.date) params.date = dateParams.date;
      if (dateParams.startDate) params.from = dateParams.startDate;
      if (dateParams.endDate) params.to = dateParams.endDate;
      const res = await api.get("/dashboard/sales-tracking", { params });
      setTrackingData(res.data);
    } catch (requestError) {
      setTrackingError(requestError.response?.data?.message || t("dashboard.salesTrackingFailed"));
    } finally {
      setTrackingLoading(false);
    }
  }, [t, getDateParams]);

  // Fetch Products & Stock Status
  const fetchInventory = useCallback(async () => {
    try {
      const res = await api.get("/products");
      const products = res.data || [];
      setAllProducts(products);
      const low = products.filter((p) => p.quantity < 5);
      setLowStockItems(low);
    } catch {
      // silent
    }
  }, []);

  // Fetch Top Products from Analytics
  const fetchTopProducts = useCallback(async () => {
    try {
      const res = await api.get("/analytics/top-products", { params: getDateParams() });
      setTopProducts(res.data?.data || []);
    } catch {
      // silent
    }
  }, [getDateParams]);

  // Initial and reactive fetch
  useEffect(() => {
    fetchDashboard();
    fetchProfit();
    fetchSalesTracking();
    fetchInventory();
    fetchTopProducts();
  }, [fetchDashboard, fetchProfit, fetchSalesTracking, fetchInventory, fetchTopProducts]);

  // Real-time synchronization via Socket.io
  useSocket("stock:update", () => {
    fetchDashboard();
    fetchProfit();
    fetchSalesTracking();
    fetchInventory();
    fetchTopProducts();
  });

  // Calculate Today's Profit from profit transactions
  const todayProfit = useMemo(() => {
    if (!profitData?.transactions) return 0;
    const todayStr = new Date().toISOString().slice(0, 10);
    return profitData.transactions
      .filter((tx) => {
        if (!["active", "pending_return", "return_rejected"].includes(tx.status)) return false;
        return (tx.date || "").slice(0, 10) === todayStr;
      })
      .reduce((sum, tx) => sum + (tx.profit || 0), 0);
  }, [profitData]);

  // Calculate Weekly Income from real sales data (matches backend weeklySales calculation)
  const weeklyIncome = data?.weekly?.amount ?? data?.weeklySales ?? 0;
  const weeklyTransactionsCount = data?.weekly?.count ?? 0;

  // Calculate Weekly Profit from profit transactions matching existing Profit page calculation
  const weeklyProfit = useMemo(() => {
    if (!profitData?.transactions) return 0;
    if (activeFilter !== "none") {
      // When a date filter is applied, return the filtered profit
      return profitData.transactions
        .filter((tx) => ["active", "pending_return", "return_rejected"].includes(tx.status))
        .reduce((sum, tx) => sum + (tx.profit || 0), 0);
    }
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday as start of week
    const startOfWeek = new Date(now);
    startOfWeek.setDate(startOfWeek.getDate() + diff);
    startOfWeek.setHours(0, 0, 0, 0);

    return profitData.transactions
      .filter((tx) => {
        if (!["active", "pending_return", "return_rejected"].includes(tx.status)) return false;
        return new Date(tx.date) >= startOfWeek;
      })
      .reduce((sum, tx) => sum + (tx.profit || 0), 0);
  }, [profitData, activeFilter]);

  // Compute critical and low stock counts
  const criticalStockCount = useMemo(() => {
    return allProducts.filter((p) => p.quantity <= 1).length;
  }, [allProducts]);

  const lowStockCount = useMemo(() => {
    return allProducts.filter((p) => p.quantity < (p.lowStockThreshold || 5)).length;
  }, [allProducts]);

  // Sales by Category aggregation
  const salesByCategory = useMemo(() => {
    if (!allProducts.length || !trackingData?.byProduct) return [];
    const prodCatMap = {};
    allProducts.forEach((p) => {
      prodCatMap[p.name] = p.category || "Uncategorized";
    });

    const catMap = {};
    trackingData.byProduct.forEach((item) => {
      const cat = prodCatMap[item.productName] || "General";
      if (!catMap[cat]) catMap[cat] = { category: cat, revenue: 0, itemsSold: 0 };
      catMap[cat].revenue += item.totalRevenue || 0;
      catMap[cat].itemsSold += item.itemsSold || 0;
    });

    return Object.values(catMap).sort((a, b) => b.revenue - a.revenue);
  }, [allProducts, trackingData]);

  // Comparative Sales & Profit Daily Trend
  const comparativeTrend = useMemo(() => {
    const dailyWeek = data?.dailyWeekTrend || [];
    if (!dailyWeek.length) return [];

    // Map each day label to daily profit from profit transactions
    const dayProfitMap = {};
    if (profitData?.transactions) {
      profitData.transactions.forEach((tx) => {
        if (!["active", "pending_return", "return_rejected"].includes(tx.status)) return;
        const d = new Date(tx.date);
        const dayIdx = (d.getUTCDay() + 6) % 7; // 0=Mon, 6=Sun
        const dayName = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][dayIdx];
        dayProfitMap[dayName] = (dayProfitMap[dayName] || 0) + (tx.profit || 0);
      });
    }

    return dailyWeek.map((item) => ({
      ...item,
      profit: Number((dayProfitMap[item.label] || (item.revenue ? item.revenue * 0.25 : 0)).toFixed(2))
    }));
  }, [data?.dailyWeekTrend, profitData?.transactions]);

  // Filter actions
  const onApplyFilter = async () => {
    if (dateMode === "single" && singleDate) {
      setActiveFilter("single");
    } else if (dateMode === "range" && (rangeFrom || rangeTo)) {
      if (rangeFrom && rangeTo && rangeTo < rangeFrom) {
        setTrackingError(t("dashboard.invalidRange"));
        return;
      }
      setActiveFilter("range");
    } else {
      setActiveFilter("none");
    }
    await Promise.all([
      fetchDashboard(),
      fetchProfit(),
      fetchSalesTracking(),
      fetchTopProducts()
    ]);
  };

  const onResetFilter = async () => {
    setSingleDate("");
    setRangeFrom("");
    setRangeTo("");
    setActiveFilter("none");
    setTrackingError("");
  };

  const handleExport = (format) => {
    const params = new URLSearchParams();
    const dateParams = getDateParams();
    if (dateParams.date) params.set("date", dateParams.date);
    if (dateParams.startDate) params.set("startDate", dateParams.startDate);
    if (dateParams.endDate) params.set("endDate", dateParams.endDate);
    const token = localStorage.getItem("token");
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
    fetch(`${baseUrl}/reports/export/${format}?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `report_${new Date().toISOString().slice(0, 10)}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      })
      .catch(() => setTrackingError(`${format.toUpperCase()} export failed`));
  };

  const hasProductBreakdown = (trackingData?.byProduct || []).length > 0;
  const canGoNextWeek = weekOffset > 0;
  const isLoading = dashboardLoading || trackingLoading || profitLoading;

  const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#ef4444", "#6366f1"];

  if (!data && !error) {
    return <PageLoader loading={true} message="Please wait while dashboard data is being loaded." />;
  }

  if (error && !data) {
    return (
      <PageLoader
        loading={false}
        error={error}
        onRetry={() => {
          setError("");
          onApplyFilter();
        }}
      />
    );
  }

  return (
    <div className="stack" style={{ gap: "1.5rem" }}>
      {/* Top Header & Date Filter Bar */}
      <div className="card row-between" style={{ padding: "1.1rem 1.4rem" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800 }}>
            {user?.role === "admin" ? t("dashboard.adminTitle") : t("dashboard.myTitle")} {t("nav.dashboard") || "Dashboard"}
          </h2>
          <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.85rem" }}>
            {activeFilter === "single"
              ? t("dashboard.singleDateMode")
              : activeFilter === "range"
                ? t("dashboard.rangeMode")
                : t("dashboard.allTimeMode")}
          </p>
        </div>

        <div className="form dashboard-filter-row" style={{ alignItems: "flex-end", gap: "0.6rem" }}>
          {/* Toggle button */}
          <button
            className="btn btn-toggle"
            type="button"
            onClick={() => {
              setDateMode((prev) => (prev === "single" ? "range" : "single"));
              setSingleDate("");
              setRangeFrom("");
              setRangeTo("");
            }}
            style={{ fontSize: "0.82rem", padding: "0.55rem 0.9rem" }}
          >
            {dateMode === "single"
              ? (t("dashboard.switchToRange") || "📅 Single Date | Range Date →")
              : (t("dashboard.switchToSingle") || "← Single Date | Range Date 📅")}
          </button>

          {/* Date pickers */}
          {dateMode === "single" ? (
            <label className="csv-export-group" style={{ margin: 0 }}>
              <span className="muted" style={{ fontSize: "0.78rem" }}>{t("dashboard.singleDate")}</span>
              <input type="date" value={singleDate} onChange={(e) => setSingleDate(e.target.value)} style={{ padding: "0.45rem 0.65rem" }} />
            </label>
          ) : (
            <>
              <label className="csv-export-group" style={{ margin: 0 }}>
                <span className="muted" style={{ fontSize: "0.78rem" }}>{t("dashboard.fromDate")}</span>
                <input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} style={{ padding: "0.45rem 0.65rem" }} />
              </label>
              <label className="csv-export-group" style={{ margin: 0 }}>
                <span className="muted" style={{ fontSize: "0.78rem" }}>{t("dashboard.toDate")}</span>
                <input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} style={{ padding: "0.45rem 0.65rem" }} />
              </label>
            </>
          )}

          <button className="btn btn-apply" type="button" onClick={onApplyFilter} disabled={isLoading} style={{ fontSize: "0.82rem", padding: "0.55rem 0.9rem" }}>
            {isLoading ? (t("common.loading") || "Loading...") : t("dashboard.applyFilter")}
          </button>
          <button className="btn btn-reset" type="button" onClick={onResetFilter} disabled={isLoading} style={{ fontSize: "0.82rem", padding: "0.55rem 0.9rem" }}>
            {t("dashboard.resetFilter")}
          </button>
          <button className="btn btn-pdf" type="button" onClick={() => handleExport("pdf")} disabled={isLoading} style={{ fontSize: "0.82rem", padding: "0.55rem 0.9rem" }}>
            {t("dashboard.exportPdf") || "Export PDF"}
          </button>
          <button className="btn btn-csv" type="button" onClick={() => handleExport("csv")} disabled={isLoading} style={{ fontSize: "0.82rem", padding: "0.55rem 0.9rem" }}>
            {t("dashboard.exportCsv") || "Export CSV"}
          </button>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {trackingError ? <p className="error">{trackingError}</p> : null}

      {/* Critical & Low Stock Notification Cards */}
      {criticalStockCount > 0 && (
        <div
          className="card"
          style={{
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
            padding: "0.9rem 1.4rem"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.4rem" }}>⚠️</span>
            <div>
              <strong style={{ color: "#ef4444", fontSize: "0.95rem" }}>Critical Stock Alert:</strong>{" "}
              <span>{criticalStockCount} product(s) have 1 or 0 units remaining! Immediate restock recommended.</span>
            </div>
          </div>
          <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#ef4444", background: "rgba(239, 68, 68, 0.15)", padding: "0.25rem 0.6rem", borderRadius: "8px" }}>
            ACTION REQUIRED
          </span>
        </div>
      )}

      {/* 10 SUMMARY METRIC CARDS - EXACTLY TWO ROWS OF 5 ON DESKTOP */}
      <div className="dashboard-metrics-grid">
        {/* 1. Today's Sales - Sky Blue */}
        <StatCard
          title={t("dashboard.dailySales") || "Today's Sales"}
          value={formatCurrency(data?.dailySales ?? data?.daily?.amount ?? 0)}
          subtitle={`${data?.daily?.count || data?.totalTransactions || 0} ${t("dashboard.transactions")}`}
          icon={<TodaySalesIcon />}
          color="sky"
        />

        {/* 2. Weekly Income - Teal / Cyan */}
        <StatCard
          title={t("dashboard.weeklyIncome") || "Weekly Income"}
          value={formatCurrency(weeklyIncome)}
          subtitle={`${weeklyTransactionsCount} ${t("dashboard.transactions")} this week`}
          icon={<WeeklyIncomeIcon />}
          color="teal"
        />

        {/* 3. Total Sales - Royal Blue */}
        <StatCard
          title={t("dashboard.totalRevenue") || "Total Sales"}
          value={formatCurrency(data?.totalRevenue || 0)}
          subtitle={`${data?.totalItemsSold || data?.daily?.itemsSold || 0} ${t("dashboard.totalItemsSold") || "items sold"}`}
          icon={<RevenueIcon />}
          color="blue"
        />

        {/* 4. Today's Profit - Fresh Mint */}
        <StatCard
          title={t("dashboard.todayProfit") || "Today's Profit"}
          value={formatCurrency(todayProfit)}
          subtitle="Generated today"
          icon={<TodayProfitIcon />}
          color="mint"
        />

        {/* 5. Weekly Profit - Rich Emerald */}
        <StatCard
          title={t("dashboard.weeklyProfit") || "Weekly Profit"}
          value={formatCurrency(weeklyProfit)}
          subtitle="Current week net profit"
          icon={<WeeklyProfitIcon />}
          color="emerald"
        />

        {/* 6. Total Profit - Deep Forest Green */}
        <StatCard
          title={t("dashboard.totalProfit") || "Total Profit"}
          value={formatCurrency(profitData?.totalProfit || 0)}
          subtitle="Net business profit"
          icon={<ProfitIcon />}
          color="green"
        />

        {/* 7. Total Transactions - Modern Indigo */}
        <StatCard
          title={t("dashboard.filteredTransactions") || "Total Transactions"}
          value={data?.totalTransactions ?? data?.daily?.count ?? 0}
          subtitle="Completed sales orders"
          icon={<TransactionsIcon />}
          color="indigo"
        />

        {/* 8. Total Products - Regal Purple */}
        <StatCard
          title={t("dashboard.productsCount") || "Total Products"}
          value={data?.productsCount || allProducts.length || 0}
          subtitle={`${data?.stockUnits || 0} ${t("dashboard.availableInventoryUnits") || "units in stock"}`}
          icon={<ProductCatalogIcon />}
          color="purple"
        />

        {/* 9. Low Stock Products - Attention Amber */}
        <StatCard
          title={t("dashboard.lowStockAlerts") || "Low Stock Products"}
          value={lowStockCount}
          subtitle={t("dashboard.needsRestockSoon") || "Below restock threshold"}
          icon={<LowStockIcon />}
          color="amber"
        />

        {/* 10. Critical Stock Products - Urgent Crimson Red */}
        <StatCard
          title="Critical Stock"
          value={criticalStockCount}
          subtitle="1 or 0 units remaining"
          icon={<CriticalStockIcon />}
          color="red"
          isAlert={criticalStockCount > 0}
        />
      </div>

      {/* ANALYTICS CHARTS GRID */}
      <div className="grid dashboard-chart-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "1.25rem" }}>
        {/* Sales Trend Chart */}
        <div className="card dashboard-chart-card">
          <div className="row-between" style={{ marginBottom: "1rem" }}>
            <div>
              <h4 style={{ margin: 0 }}>{t("dashboard.dailyTrend") || "Sales Trend Over Time"}</h4>
              <span className="muted" style={{ fontSize: "0.8rem" }}>Daily units sold & revenue</span>
            </div>
            <div className="form-inline" style={{ gap: "0.4rem" }}>
              <button className="btn btn-nav" type="button" onClick={() => setWeekOffset((p) => p + 1)} style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}>
                ← {t("dashboard.previousWeek")}
              </button>
              <button className="btn btn-nav" type="button" onClick={() => setWeekOffset((p) => Math.max(p - 1, 0))} disabled={!canGoNextWeek} style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}>
                {t("dashboard.nextWeek")} →
              </button>
            </div>
          </div>

          <div className="dashboard-chart-wrap" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.dailyWeekTrend || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesTrendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" stroke="var(--muted)" fontSize={12} />
                <YAxis stroke="var(--muted)" fontSize={12} />
                <Tooltip
                  formatter={(val, name) => [name === "revenue" ? formatCurrency(val) : val, name === "revenue" ? t("dashboard.revenueLegend") : t("dashboard.itemsSoldLegend")]}
                  contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "10px", fontSize: "0.85rem" }}
                />
                <Legend wrapperStyle={{ fontSize: "0.82rem" }} />
                <Area type="monotone" dataKey="revenue" name={t("dashboard.revenueLegend") || "Revenue"} stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#salesTrendGrad)" />
                <Line type="monotone" dataKey="itemsSold" name={t("dashboard.itemsSoldLegend") || "Items Sold"} stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Profit vs Revenue Analysis Chart */}
        <div className="card dashboard-chart-card">
          <div className="row-between" style={{ marginBottom: "1rem" }}>
            <div>
              <h4 style={{ margin: 0 }}>Profit & Revenue Analysis</h4>
              <span className="muted" style={{ fontSize: "0.8rem" }}>Comparison of Revenue and Net Profit</span>
            </div>
            <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", borderRadius: "6px", background: "rgba(16, 185, 129, 0.12)", color: "#10b981", fontWeight: 600 }}>
              Live Calculation
            </span>
          </div>

          <div className="dashboard-chart-wrap" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparativeTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" stroke="var(--muted)" fontSize={12} />
                <YAxis stroke="var(--muted)" fontSize={12} />
                <Tooltip
                  formatter={(val) => [formatCurrency(val)]}
                  contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "10px", fontSize: "0.85rem" }}
                />
                <Legend wrapperStyle={{ fontSize: "0.82rem" }} />
                <Bar dataKey="revenue" name="Revenue (ETB)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="Net Profit (ETB)" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* SALES BY CATEGORY & DISTRIBUTION (if categories exist) */}
      {salesByCategory.length > 0 && (
        <div className="grid dashboard-chart-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "1.25rem" }}>
          {/* Category Distribution Pie */}
          <div className="card dashboard-chart-card">
            <h4 style={{ margin: "0 0 0.2rem" }}>Sales by Product Category</h4>
            <span className="muted" style={{ fontSize: "0.8rem", display: "block", marginBottom: "1rem" }}>Revenue distribution by category</span>
            <div className="dashboard-chart-wrap" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={salesByCategory}
                    dataKey="revenue"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    innerRadius={45}
                    paddingAngle={3}
                  >
                    {salesByCategory.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val) => [formatCurrency(val), "Revenue"]}
                    contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "10px", fontSize: "0.85rem" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "0.82rem" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Breakdown Progress List */}
          <div className="card dashboard-chart-card" style={{ display: "flex", flexDirection: "column" }}>
            <h4 style={{ margin: "0 0 0.2rem" }}>Category Performance Summary</h4>
            <span className="muted" style={{ fontSize: "0.8rem", display: "block", marginBottom: "1rem" }}>Units sold and revenue share</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", overflowY: "auto", flex: 1 }}>
              {salesByCategory.map((cat, idx) => {
                const totalRev = salesByCategory.reduce((sum, c) => sum + c.revenue, 0) || 1;
                const pct = Math.round((cat.revenue / totalRev) * 100);
                return (
                  <div key={cat.category} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <div className="row-between" style={{ fontSize: "0.85rem" }}>
                      <span style={{ fontWeight: 600 }}>{cat.category}</span>
                      <span>
                        <strong>{formatCurrency(cat.revenue)}</strong> ({cat.itemsSold} sold)
                      </span>
                    </div>
                    <div style={{ width: "100%", height: "6px", background: "rgba(100,116,139,0.15)", borderRadius: "3px", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background: PIE_COLORS[idx % PIE_COLORS.length],
                          borderRadius: "3px"
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TOP-SELLING PRODUCTS SECTION */}
      <div className="card" style={{ padding: "1.4rem" }}>
        <div className="row-between" style={{ marginBottom: "1.2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{ color: "#f59e0b" }}>
              <TrophyIcon />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>Top-Selling Products</h3>
              <span className="muted" style={{ fontSize: "0.82rem" }}>Ranked by total quantity sold from actual transaction data</span>
            </div>
          </div>
          <span style={{ fontSize: "0.78rem", fontWeight: 700, padding: "0.25rem 0.65rem", borderRadius: "12px", background: "rgba(245, 158, 11, 0.12)", color: "#d97706" }}>
            {topProducts.length} PRODUCTS
          </span>
        </div>

        {topProducts.length === 0 ? (
          <p className="muted" style={{ textAlign: "center", padding: "2rem 0" }}>No transaction sales data available yet.</p>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th style={{ width: "80px" }}>Rank</th>
                  <th>Product Name</th>
                  <th style={{ width: "180px" }}>Units Sold</th>
                  <th style={{ textAlign: "right" }}>Total Revenue</th>
                  <th style={{ textAlign: "right" }}>Avg. Unit Price</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((prod, index) => {
                  const maxSold = topProducts[0]?.totalSold || 1;
                  const pct = Math.min(100, Math.round((prod.totalSold / maxSold) * 100));
                  const medals = ["🥇", "🥈", "🥉"];
                  const avgPrice = prod.totalSold > 0 ? (prod.totalRevenue / prod.totalSold) : 0;

                  return (
                    <tr key={prod.productName || index}>
                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "32px",
                            height: "32px",
                            borderRadius: "8px",
                            fontWeight: 700,
                            fontSize: "0.88rem",
                            background: index < 3 ? "rgba(245, 158, 11, 0.12)" : "rgba(100, 116, 139, 0.08)",
                            color: index < 3 ? "#d97706" : "var(--muted)"
                          }}
                        >
                          {index < 3 ? medals[index] : `#${index + 1}`}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{prod.productName}</td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                          <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{prod.totalSold} sold</span>
                          <div style={{ width: "100%", height: "5px", background: "rgba(100,116,139,0.15)", borderRadius: "3px", overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: index === 0 ? "#10b981" : "#3b82f6", borderRadius: "3px" }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "var(--text)" }}>
                        {formatCurrency(prod.totalRevenue || 0)}
                      </td>
                      <td style={{ textAlign: "right", color: "var(--muted)" }}>
                        {formatCurrency(avgPrice)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SALES TRACKING & DETAILED BREAKDOWN BY PRODUCT */}
      <div className="card stack">
        <div>
          <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>{t("dashboard.salesTrackingTitle")}</h3>
          <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.85rem" }}>
            Detailed sales breakdown per product based on current date filter
          </p>
        </div>

        <div className="grid dashboard-metrics-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
          <div className="card" style={{ padding: "1rem 1.2rem", background: "var(--table-hover)" }}>
            <span className="dashboard-stat-title">{t("dashboard.totalItemsSold")}</span>
            <div className="dashboard-stat-value" style={{ fontSize: "1.6rem" }}>
              {trackingLoading ? "..." : (trackingData?.summary?.totalItemsSold ?? 0)}
            </div>
          </div>
          <div className="card" style={{ padding: "1rem 1.2rem", background: "var(--table-hover)" }}>
            <span className="dashboard-stat-title">{t("dashboard.filteredRevenue")}</span>
            <div className="dashboard-stat-value" style={{ fontSize: "1.6rem" }}>
              {trackingLoading ? "..." : formatCurrency(trackingData?.summary?.totalRevenue ?? 0)}
            </div>
          </div>
          <div className="card" style={{ padding: "1rem 1.2rem", background: "var(--table-hover)" }}>
            <span className="dashboard-stat-title">{t("dashboard.filteredTransactions")}</span>
            <div className="dashboard-stat-value" style={{ fontSize: "1.6rem" }}>
              {trackingLoading ? "..." : (trackingData?.summary?.totalTransactions ?? 0)}
            </div>
          </div>
        </div>

        {!trackingLoading && !hasProductBreakdown ? (
          <p className="muted" style={{ textAlign: "center", padding: "1.5rem" }}>{t("dashboard.noDataFound")}</p>
        ) : null}

        {hasProductBreakdown ? (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>{t("dashboard.product")}</th>
                  <th style={{ width: "160px" }}>{t("dashboard.totalItemsSold")}</th>
                  <th style={{ textAlign: "right" }}>{t("dashboard.filteredRevenue")}</th>
                </tr>
              </thead>
              <tbody>
                {trackingData.byProduct.map((row) => (
                  <tr key={row.productName}>
                    <td style={{ fontWeight: 600 }}>{row.productName}</td>
                    <td>{row.itemsSold} units</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{formatCurrency(row.totalRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
};
