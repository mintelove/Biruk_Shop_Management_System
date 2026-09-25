import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../hooks/useSocket";
import { formatCurrency } from "../utils/currency";
import { useI18n } from "../context/I18nContext";
import { calculatePeriodDates, formatLocalDate, SALES_PERIOD_OPTIONS } from "../utils/datePeriods";
import { PageLoader } from "../components/PageLoader";
import { StatCard } from "../components/StatCard";

const SearchIcon = () => (
  <svg className="sales-search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
    <path d="M16 16l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const FilterSearchIcon = () => (
  <svg className="sales-search-box-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
    <path d="M16 16l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 17v2a2 2 0 002 2h10a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CheckmarkIcon = () => (
  <svg className="sale-success-checkmark" viewBox="0 0 52 52" fill="none" aria-hidden="true">
    <circle cx="26" cy="26" r="24" stroke="#28a745" strokeWidth="3" fill="none" />
    <path className="sale-success-check-path" d="M14 27l8 8 16-16" stroke="#28a745" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

export const SalesPage = () => {
  const { user } = useAuth();
  const { t, language } = useI18n();

  // Mode Selection
  const [mode, setMode] = useState(() => {
    return localStorage.getItem("sales_item_selection_mode") || "category";
  });
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [productSearch, setProductSearch] = useState("");

  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [form, setForm] = useState({ productId: "", quantity: 1, sellingPrice: "" });
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState("today");
  const [dateFilter, setDateFilter] = useState(() => formatLocalDate(new Date()));
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [summary, setSummary] = useState({ totalItemsSold: 0, totalSalesAmount: 0, totalTransactions: 0 });
  const [saleSuccess, setSaleSuccess] = useState(false);
  const successTimer = useRef(null);
  const [vatOption, setVatOption] = useState("without");
  const [vatFilter, setVatFilter] = useState("without");
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [highlightId, setHighlightId] = useState("");

  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Sync incoming search query or state from notification navigation
  useEffect(() => {
    const q = searchParams.get("search") || location.state?.transactionId || location.state?.highlightId;
    if (q) {
      setSearch(q);
      setHighlightId(q);
      setPeriodFilter("");
      setDateFilter("");
      setStartDate("");
      setEndDate("");
      setVatFilter("all");
    }
  }, [searchParams, location.state]);

  // Computed VAT values (reactive to selling price, quantity, and VAT option)
  const vatAmount = useMemo(() => {
    if (vatOption !== "with") return 0;
    const price = Number(form.sellingPrice) || 0;
    const qty = Number(form.quantity) || 0;
    return Number((price * 0.15 * qty).toFixed(2));
  }, [vatOption, form.sellingPrice, form.quantity]);

  const totalPriceWithVat = useMemo(() => {
    const price = Number(form.sellingPrice) || 0;
    const qty = Number(form.quantity) || 0;
    const base = Number((price * qty).toFixed(2));
    if (vatOption !== "with") return base;
    return Number((base + vatAmount).toFixed(2));
  }, [vatOption, form.sellingPrice, form.quantity, vatAmount]);

  // Derive the selected product to show original price reference
  const selectedProduct = useMemo(() => {
    if (!form.productId) return null;
    return products.find((p) => p._id === form.productId) || null;
  }, [products, form.productId]);

  const handleModeChange = (newMode) => {
    setMode(newMode);
    localStorage.setItem("sales_item_selection_mode", newMode);
    setProductSearch("");
  };

  const [allSalesForCards, setAllSalesForCards] = useState([]);

  const fetchCardsData = useCallback(async () => {
    try {
      const res = await api.get("/sales", { params: { vatFilter } });
      setAllSalesForCards(res.data.sales || []);
    } catch {
      // silent
    }
  }, [vatFilter]);

  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setInitialLoading(true);
      setLoadError("");
    }
    const params = {};
    if (dateFilter) params.date = dateFilter;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    params.vatFilter = vatFilter;

    try {
      // Fetch sales history and categories list
      const [salesRes, categoriesRes] = await Promise.all([
        api.get("/sales", { params }),
        api.get("/categories")
      ]);
      setSales(salesRes.data.sales || []);
      setSummary(salesRes.data.summary || { totalItemsSold: 0, totalSalesAmount: 0, totalTransactions: 0 });
      
      const fetchedCategories = categoriesRes.data || [];
      setCategories(fetchedCategories);

      // Auto-select first category if none is selected and in category mode
      let activeCategory = selectedCategory;
      if (mode === "category") {
        if (!activeCategory && fetchedCategories.length > 0) {
          activeCategory = fetchedCategories[0].name;
          setSelectedCategory(activeCategory);
        }
      }

      // Fetch products (efficiently filtered by category at database level if in category mode)
      const prodParams = {};
      if (mode === "category" && activeCategory) {
        prodParams.category = activeCategory;
      }
      const productsRes = await api.get("/products", { params: prodParams });
      setProducts(productsRes.data || []);
      setLoadError("");
    } catch (err) {
      console.error("Sales data fetch error:", err);
      if (isInitial) {
        setLoadError("Unable to load sales data.");
      }
    } finally {
      if (isInitial) {
        setInitialLoading(false);
      }
    }
  }, [mode, selectedCategory, dateFilter, startDate, endDate, vatFilter]);

  useEffect(() => {
    fetchData(true);
    fetchCardsData();
  }, [fetchData, fetchCardsData]);

  useEffect(() => {
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, []);

  useSocket("stock:update", () => {
    fetchData(false);
    fetchCardsData();
  });

  // Client-side filtering for search & out-of-stock items
  const filteredProducts = useMemo(() => {
    let list = products;

    // Strictly filter out-of-stock items (quantity > 0)
    list = list.filter((p) => p.quantity > 0);

    // Search filter
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase().trim();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }

    return list;
  }, [products, productSearch]);

  // Self-healing product ID selection: Auto-select first match on filter change
  useEffect(() => {
    if (filteredProducts.length > 0) {
      if (!filteredProducts.some((p) => p._id === form.productId)) {
        setForm((prev) => ({ ...prev, productId: filteredProducts[0]._id, sellingPrice: "" }));
      }
    } else {
      setForm((prev) => ({ ...prev, productId: "", sellingPrice: "" }));
    }
  }, [filteredProducts, form.productId]);

  const noProductsMsg = useMemo(() => {
    const hasNoProductsInCategory = products.filter(p => p.quantity > 0).length === 0;
    if (mode === "category" && selectedCategory && hasNoProductsInCategory) {
      return t("sales.noProductsInCategory") || "No products found in this category.";
    }
    return null;
  }, [products, mode, selectedCategory, t]);

  const onSale = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.productId) {
      setError("Please select a product");
      return;
    }

    // Frontend validation: selling price is REQUIRED
    const trimmedPrice = String(form.sellingPrice).trim();
    if (trimmedPrice === "") {
      setError("Selling price is required");
      return;
    }
    const numPrice = Number(trimmedPrice);
    if (isNaN(numPrice) || numPrice <= 0) {
      setError("Selling price must be a valid positive number");
      return;
    }
    if (selectedProduct) {
      const minPrice = selectedProduct.minSellingPrice || 0;
      if (minPrice > 0 && numPrice < minPrice) {
        setError("Price must be equal or greater than minimum selling price");
        return;
      }
    }

    try {
      await api.post("/sales", {
        productId: form.productId,
        quantity: Number(form.quantity),
        sellingPrice: numPrice,
        vatApplied: vatOption === "with"
      });
      setForm((prev) => ({ ...prev, quantity: 1, sellingPrice: "" }));
      setVatOption("without");
      fetchData();
      fetchCardsData();

      // Trigger success state for 3 seconds
      setSaleSuccess(true);
      if (successTimer.current) clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setSaleSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.message || t("sales.failedComplete"));
    }
  };

  const getSalePrice = (s) => (typeof s.total_price === "number" ? s.total_price : Number(s.total_price || 0));

  const todaySummary = useMemo(() => {
    const now = new Date();
    const list = allSalesForCards.filter((s) => {
      const d = new Date(s.createdAt);
      return d.toDateString() === now.toDateString();
    });
    const total = list.reduce((sum, s) => sum + getSalePrice(s), 0);
    return { total, count: list.length };
  }, [allSalesForCards]);

  const weekSummary = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const list = allSalesForCards.filter((s) => new Date(s.createdAt) >= startOfWeek);
    const total = list.reduce((sum, s) => sum + getSalePrice(s), 0);
    return { total, count: list.length };
  }, [allSalesForCards]);

  const monthSummary = useMemo(() => {
    const now = new Date();
    const list = allSalesForCards.filter((s) => {
      const d = new Date(s.createdAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const total = list.reduce((sum, s) => sum + getSalePrice(s), 0);
    return { total, count: list.length };
  }, [allSalesForCards]);

  const lastMonthSummary = useMemo(() => {
    const now = new Date();
    const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const lastMonthIdx = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const list = allSalesForCards.filter((s) => {
      const d = new Date(s.createdAt);
      return d.getFullYear() === lastMonthYear && d.getMonth() === lastMonthIdx;
    });
    const total = list.reduce((sum, s) => sum + getSalePrice(s), 0);
    return { total, count: list.length };
  }, [allSalesForCards]);

  const handlePeriodChange = (newPeriod) => {
    setPeriodFilter(newPeriod);
    if (!newPeriod) {
      setDateFilter("");
      setStartDate("");
      setEndDate("");
      return;
    }
    const bounds = calculatePeriodDates(newPeriod);
    if (newPeriod === "today") {
      setDateFilter(bounds.date);
      setStartDate("");
      setEndDate("");
    } else {
      setDateFilter("");
      setStartDate(bounds.startDate);
      setEndDate(bounds.endDate);
    }
  };

  const activePeriodLabel = useMemo(() => {
    const found = SALES_PERIOD_OPTIONS.find((o) => o.value === periodFilter);
    return found ? found.label : (dateFilter || startDate ? "Custom Period" : "");
  }, [periodFilter, dateFilter, startDate]);

  const periodSalesCardMeta = useMemo(() => {
    switch (periodFilter) {
      case "today":
        return {
          title: "TODAY'S SALES",
          badge: "Today",
          value: summary.totalSalesAmount,
          sub: `${summary.totalTransactions} transactions completed today`
        };
      case "this_week":
        return {
          title: "THIS WEEK'S SALES",
          badge: "This Week",
          value: summary.totalSalesAmount,
          sub: `${summary.totalTransactions} transactions this week`
        };
      case "this_month":
        return {
          title: "THIS MONTH'S SALES",
          badge: "This Month",
          value: summary.totalSalesAmount,
          sub: `${summary.totalTransactions} transactions this month`
        };
      case "last_month":
        return {
          title: "LAST MONTH'S SALES",
          badge: "Last Month",
          value: summary.totalSalesAmount,
          sub: `${summary.totalTransactions} transactions last month`
        };
      default:
        return {
          title: "TODAY'S SALES",
          badge: "Live Today",
          value: todaySummary.total,
          sub: `${todaySummary.count} transactions completed today`
        };
    }
  }, [periodFilter, summary, todaySummary]);

  // Real-time client-side search filtering for sales history
  const filteredSales = useMemo(() => {
    if (!search.trim()) return sales;
    const q = search.toLowerCase().trim();
    return sales.filter((sale) => {
      const productMatch = (sale.product_name || "").toLowerCase().includes(q);
      const salesmanMatch = (sale.salesman_id?.name || "").toLowerCase().includes(q);
      const idMatch = (sale._id || "").toLowerCase().includes(q);
      const dateStr = new Date(sale.createdAt).toLocaleString(language === "am" ? "am-ET" : "en-US").toLowerCase();
      const dateMatch = dateStr.includes(q);
      return productMatch || salesmanMatch || idMatch || dateMatch;
    });
  }, [sales, search, language]);

  // Export handler (CSV or PDF)
  const onExport = (format) => {
    const params = new URLSearchParams();
    if (dateFilter) params.set("date", dateFilter);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    params.set("vatFilter", vatFilter);

    const token = localStorage.getItem("token");
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
    const url = `${baseUrl}/sales/export/${format}?${params.toString()}`;

    fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `sales_report_${new Date().toISOString().slice(0, 10)}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      })
      .catch(() => {
        setError(t("sales.exportFailed"));
      });
  };

  if (initialLoading) {
    return <PageLoader loading={true} message="Please wait while sales data is being loaded." />;
  }

  if (loadError && !sales.length) {
    return (
      <PageLoader
        loading={false}
        error={loadError}
        onRetry={() => {
          fetchData(true);
          fetchCardsData();
        }}
      />
    );
  }

  return (
    <div className="stack">
      <div className="row-between" style={{ alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <h2>{user?.role === "admin" ? t("sales.allSalesTitle") : t("sales.mySalesTitle")}</h2>
        <span className="muted" style={{ fontSize: "0.85rem" }}>
          Real-time POS & Sales Register
        </span>
      </div>

      {/* Item Selection Mode Selector */}
      <div className="sales-mode-selector-card">
        <span className="sales-mode-label">{t("sales.searchSortMethod")}:</span>
        <div className="sales-mode-options">
          <label className={`sales-mode-btn${mode === "category" ? " active" : ""}`}>
            <input
              type="radio"
              name="itemSelectionMode"
              checked={mode === "category"}
              onChange={() => handleModeChange("category")}
            />
            {t("sales.sortByCategory")}
          </label>
          <label className={`sales-mode-btn${mode === "items" ? " active" : ""}`}>
            <input
              type="radio"
              name="itemSelectionMode"
              checked={mode === "items"}
              onChange={() => handleModeChange("items")}
            />
            {t("sales.sortByItems")}
          </label>
        </div>
      </div>

      <form
        className={`card form-inline sale-form-card${saleSuccess ? " sale-form-card--success" : ""}`}
        onSubmit={onSale}
        style={{ flexWrap: "wrap", gap: "1rem" }}
      >
        {saleSuccess && (
          <div className="sale-success-overlay">
            <CheckmarkIcon />
            <p className="sale-success-text">Transaction Successful</p>
          </div>
        )}

        <div className="sales-product-filters">
          {mode === "category" && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="sales-category-select"
            >
              {categories.map((c) => (
                <option key={c._id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          <div className="sales-search-box-wrap">
            <FilterSearchIcon />
            <input
              className="sales-product-search-input"
              type="text"
              placeholder={mode === "category" ? t("sales.searchInCategory") : t("sales.searchAllItems")}
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1.5, minWidth: "200px" }}>
          <select
            value={form.productId}
            onChange={(e) => setForm({ ...form, productId: e.target.value, sellingPrice: "" })}
            disabled={filteredProducts.length === 0}
            style={{ width: "100%" }}
          >
            {filteredProducts.length === 0 ? (
              <option value="" disabled>
                {mode === "category" ? t("sales.noProductsInCategory") : "No matching products in stock."}
              </option>
            ) : (
              filteredProducts.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} ({t("sales.stock")}: {p.quantity})
                </option>
              ))
            )}
          </select>
          {noProductsMsg && <span className="no-products-msg">{noProductsMsg}</span>}
        </div>

        <input
          type="number"
          min={1}
          required
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          style={{ width: "80px" }}
        />

        <div className="sales-selling-price-container">
          <div className="sales-selling-price-header">
            <label htmlFor="sales-selling-price-input" className="sales-selling-price-label">
              <span className="sales-selling-price-icon" aria-hidden="true">🏷️</span>
              <span>{t("sales.sellingPrice") || "Selling Price"}</span>
            </label>
            {selectedProduct && selectedProduct.minSellingPrice > 0 && (
              <span className="sales-min-price-pill" title={`Minimum authorized price: ${formatCurrency(selectedProduct.minSellingPrice)}`}>
                Min: {formatCurrency(selectedProduct.minSellingPrice)}
              </span>
            )}
          </div>
          <div className="sales-selling-price-input-wrap">
            <span className="sales-currency-symbol" aria-hidden="true">Br</span>
            <input
              id="sales-selling-price-input"
              className="sales-selling-price-input"
              type="number"
              step="0.01"
              inputMode="decimal"
              min={selectedProduct ? (selectedProduct.minSellingPrice || 0.01) : 0.01}
              placeholder="0.00"
              required
              value={form.sellingPrice}
              onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
            />
            <span className="sales-currency-badge">ETB</span>
          </div>
        </div>

        {/* VAT Option Dropdown */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: "130px" }}>
          <select
            value={vatOption}
            onChange={(e) => setVatOption(e.target.value)}
            style={{ width: "100%", fontWeight: 600 }}
          >
            <option value="without">{t("sales.withoutVat")}</option>
            <option value="with">{t("sales.withVat")}</option>
          </select>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted, #94a3b8)" }}>
            {t("sales.vatOption")}
          </span>
        </div>

        {/* VAT Amount & Total Price (visible only when With VAT is selected) */}
        {vatOption === "with" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", minWidth: "140px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted, #64748b)", whiteSpace: "nowrap" }}>
                {t("sales.vatAmountLabel")}:
              </span>
              <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--accent, #f59e0b)" }}>
                {formatCurrency(vatAmount)}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted, #64748b)", whiteSpace: "nowrap" }}>
                {t("sales.totalPriceLabel")}:
              </span>
              <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--primary, #22c55e)" }}>
                {formatCurrency(totalPriceWithVat)}
              </span>
            </div>
          </div>
        )}

        <button className="btn" type="submit" disabled={saleSuccess || filteredProducts.length === 0} style={{ padding: "0.7rem 1.5rem" }}>
          {t("sales.completeSale")}
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}

      {/* Export & Period Toolbar */}
      <div className="card csv-export-bar" style={{ flexWrap: "wrap", gap: "1rem" }}>
        {/* Unified Sales Period Filter Control */}
        <div className="csv-export-group period-filter-group">
          <label htmlFor="sales-period-select" className="period-filter-label">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>Sales Period</span>
          </label>
          <div className="period-select-wrap">
            <select
              id="sales-period-select"
              className="period-filter-select"
              value={periodFilter}
              onChange={(e) => handlePeriodChange(e.target.value)}
              aria-label="Sales Period"
            >
              {SALES_PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
              {periodFilter === "custom" && <option value="custom">Custom Date Range</option>}
            </select>
          </div>
        </div>

        <div className="csv-export-group">
          <label>{t("dashboard.singleDate") || "Single Date"}</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setStartDate("");
              setEndDate("");
              setPeriodFilter(e.target.value ? "custom" : "");
            }}
          />
        </div>
        <div className="csv-export-group">
          <label>{t("sales.startDate")}</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setDateFilter("");
              setPeriodFilter(e.target.value ? "custom" : "");
            }}
          />
        </div>
        <div className="csv-export-group">
          <label>{t("sales.endDate")}</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setDateFilter("");
              setPeriodFilter(e.target.value ? "custom" : "");
            }}
          />
        </div>
        <div className="csv-export-group">
          <label>{t("sales.vatFilter") || "VAT Filter"}</label>
          <select
            value={vatFilter}
            onChange={(e) => setVatFilter(e.target.value)}
            style={{ padding: "0.4rem", borderRadius: "8px", border: "1px solid var(--input-border)", minWidth: "120px", background: "var(--card-bg, #fff)", color: "var(--text, #000)" }}
          >
            <option value="without">{t("sales.withoutVat")}</option>
            <option value="with">{t("sales.withVat")}</option>
            <option value="all">{t("sales.all")}</option>
          </select>
        </div>
        <div className="csv-export-group" style={{ alignSelf: "flex-end" }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: "0.5rem 1rem", fontSize: "0.85rem", background: "#64748b", color: "#fff", borderRadius: "8px", border: "none", cursor: "pointer" }}
            onClick={() => {
              const bounds = calculatePeriodDates("today");
              setPeriodFilter("today");
              setDateFilter(bounds.date);
              setStartDate("");
              setEndDate("");
              setVatFilter("without");
            }}
          >
            {t("dashboard.resetFilter") || "Reset"}
          </button>
        </div>
        <div className="row" style={{ gap: "0.5rem", marginLeft: "auto" }}>
          <button type="button" className="csv-export-btn" onClick={() => onExport("csv")}>
            <DownloadIcon />
            {t("sales.exportCsv")}
          </button>
          <button type="button" className="csv-export-btn" style={{ background: "var(--danger)" }} onClick={() => onExport("pdf")}>
            <DownloadIcon />
            {t("dashboard.exportPdf") || "Export PDF"}
          </button>
        </div>
      </div>

      {/* Summary Cards - Exact Match to Profit Page CardView */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(205px, 1fr))", gap: "0.85rem", marginBottom: "1rem" }}>
        {/* Large Promoted Period / Today's Sales Card */}
        <StatCard
          title={periodSalesCardMeta.title}
          value={formatCurrency(periodSalesCardMeta.value)}
          subtitle={periodSalesCardMeta.sub}
          badge={periodSalesCardMeta.badge}
          color={periodSalesCardMeta.value < 0 ? "red" : periodSalesCardMeta.value === 0 ? "zero" : "emerald"}
        />

        {/* Total Sales Revenue Card */}
        <StatCard
          title={periodFilter ? `${activePeriodLabel} Revenue` : t("sales.totalSalesAmount")}
          value={formatCurrency(summary.totalSalesAmount)}
          subtitle={`${summary.totalTransactions} ${t("dashboard.transactions")}`}
          color="blue"
        />

        {/* Total Items Sold Card */}
        <StatCard
          title={periodFilter ? `Items Sold (${activePeriodLabel})` : t("sales.totalItemsSold")}
          value={summary.totalItemsSold || 0}
          subtitle={`Across all ${summary.totalTransactions} active transactions`}
          color="indigo"
        />
      </div>

      {/* Search Bar */}
      <div className="sales-search-wrap">
        <SearchIcon />
        <input
          className="sales-search-input"
          placeholder={t("sales.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>{t("sales.date")}</th>
                <th>{t("sales.product")}</th>
                <th>{t("sales.qty")}</th>
                <th>{t("sales.unitPrice")}</th>
                <th>{t("sales.vatType")}</th>
                <th>{t("sales.vatAmountLabel")}</th>
                <th>{t("sales.total")}</th>
                <th>{t("sales.salesman")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="no-results">{t("sales.noResults")}</td>
                </tr>
              ) : (
                filteredSales.map((sale) => {
                  const isHighlighted = highlightId && (
                    String(sale._id).toLowerCase() === String(highlightId).toLowerCase() ||
                    String(sale._id).toLowerCase().includes(String(highlightId).toLowerCase())
                  );
                  return (
                    <tr
                      key={sale._id}
                      style={isHighlighted ? { background: "rgba(16, 185, 129, 0.18)", outline: "2px solid #10b981", transition: "all 0.3s ease" } : undefined}
                    >
                      <td>{new Date(sale.createdAt).toLocaleString(language === "am" ? "am-ET" : "en-US")}</td>
                      <td>{sale.product_name}</td>
                      <td>{sale.quantity}</td>
                      <td>{formatCurrency(sale.unit_price)}</td>
                      <td>
                        <span style={{
                          display: "inline-block", padding: "0.15rem 0.45rem", borderRadius: "6px", fontSize: "0.72rem", fontWeight: 700,
                          background: sale.vatApplied ? "rgba(245,158,11,0.12)" : "rgba(100,116,139,0.1)",
                          color: sale.vatApplied ? "#d97706" : "#64748b",
                          textTransform: "uppercase"
                        }}>
                          {sale.vatApplied ? t("sales.withVat") : t("sales.withoutVat")}
                        </span>
                      </td>
                      <td style={{ fontWeight: sale.vatApplied ? 700 : 400 }}>
                        {sale.vatApplied ? formatCurrency(sale.vat_amount || 0) : "—"}
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(sale.total_price)}</td>
                      <td>{sale.salesman_id?.name || t("common.na")}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
