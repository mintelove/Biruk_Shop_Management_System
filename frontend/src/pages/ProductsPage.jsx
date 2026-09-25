import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../hooks/useSocket";
import { formatCurrency } from "../utils/currency";
import { useI18n } from "../context/I18nContext";
import { Modal } from "../components/Modal";
import { PageLoader } from "../components/PageLoader";

const defaultForm = {
  name: "",
  purchasedPrice: "",
  minSellingPrice: "",
  quantity: "",
  category: "",
  lowStockThreshold: 10
};

const StockBar = ({ current, initial, threshold, t }) => {
  const effectiveInitial = initial || current || 1;
  const pct = Math.min(100, Math.round((current / effectiveInitial) * 100));

  let barClass = "stock-bar-fill stock-bar-fill--healthy";
  let statusClass = "stock-status stock-status--healthy";
  let statusText = t("products.healthy") || "In Stock";

  if (pct <= 5) {
    barClass = "stock-bar-fill stock-bar-fill--danger";
    statusClass = "stock-status stock-status--danger";
    statusText = t("products.criticalStock") || "Critical Stock";
  } else if (pct < 25) {
    barClass = "stock-bar-fill stock-bar-fill--warning";
    statusClass = "stock-status stock-status--warning";
    statusText = t("products.lowStock") || "Low Stock";
  }

  return (
    <div className="stock-display" style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: "130px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem", fontWeight: 700 }}>
        <span className="stock-fraction" style={{ color: "var(--text)" }}>{current} / {effectiveInitial}</span>
        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{pct}%</span>
      </div>
      <div className="stock-bar" style={{ height: "6px", background: "rgba(100, 116, 139, 0.15)", borderRadius: "4px", overflow: "hidden" }}>
        <div className={barClass} style={{ width: `${pct}%`, height: "100%", borderRadius: "4px" }} />
      </div>
      <span className={statusClass} style={{ alignSelf: "flex-start", fontSize: "0.72rem", padding: "0.15rem 0.5rem", borderRadius: "6px" }}>
        {statusText}
      </span>
    </div>
  );
};

export const ProductsPage = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [form, setForm] = useState(defaultForm);
  const [newCatName, setNewCatName] = useState("");
  const [message, setMessage] = useState("");

  // Sync incoming search query or state from notification navigation
  useEffect(() => {
    const q = searchParams.get("search") || location.state?.search || location.state?.productName || location.state?.productId;
    if (q) {
      setSearch(q);
      setSelectedCategory(""); // clear category restriction to show the searched item
    }
  }, [searchParams, location.state]);

  // Modal states for Product CRUD
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editForm, setEditForm] = useState(defaultForm);
  const [deletingProduct, setDeletingProduct] = useState(null);

  // Modal states for Category CRUD
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [editCatName, setEditCatName] = useState("");
  const [deletingCat, setDeletingCat] = useState(null);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const isAdmin = user?.role === "admin";
  const isPurchaser = user?.role === "purchaser";
  const isSalesman = user?.role === "salesman";
  const canManageProducts = isAdmin || isPurchaser || isSalesman;
  const canAddOrEdit = isAdmin || isPurchaser || isSalesman;

  const fetchProducts = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setInitialLoading(true);
      setLoadError("");
    }
    try {
      const res = await api.get("/products", {
        params: search ? { search } : {}
      });
      setProducts(res.data);
    } catch (err) {
      if (isInitial) {
        setLoadError(err.response?.data?.message || "Failed to load products.");
      }
    } finally {
      if (isInitial) {
        setInitialLoading(false);
      }
    }
  }, [search]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get("/categories");
      setCategories(res.data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchProducts(true);
    fetchCategories();
  }, [fetchProducts, fetchCategories]);

  useSocket("stock:update", () => fetchProducts(false));

  // Add Product Submit Handler
  const onAddSubmit = async (e) => {
    e.preventDefault();

    const purchasedPrice = Number(form.purchasedPrice) || 0;
    const minSellingPrice = Number(form.minSellingPrice) || 0;

    // Frontend cross-field validation
    if (minSellingPrice < purchasedPrice) {
      alert("Minimum selling price must be greater than or equal to purchased price");
      return;
    }

    const payload = {
      ...form,
      purchasedPrice,
      minSellingPrice,
      quantity: Number(form.quantity),
      lowStockThreshold: Number(form.lowStockThreshold)
    };

    setActionLoading(true);
    try {
      await api.post("/products", payload);
      setMessage(t("products.addedSuccess") || "Product Added Successfully");
      setForm(defaultForm);
      setShowAddModal(false);
      fetchProducts();
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      alert(err.response?.data?.message || "Operation failed");
    } finally {
      setActionLoading(false);
    }
  };

  // Open Edit Product Modal
  const onEdit = (product) => {
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      purchasedPrice: product.purchasedPrice ?? "",
      minSellingPrice: product.minSellingPrice ?? "",
      quantity: product.quantity,
      category: product.category,
      lowStockThreshold: product.lowStockThreshold ?? 10
    });
  };

  // Edit Product Submit Handler
  const onSaveEdit = async (e) => {
    e.preventDefault();

    const purchasedPrice = Number(editForm.purchasedPrice) || 0;
    const minSellingPrice = Number(editForm.minSellingPrice) || 0;

    // Frontend cross-field validation
    if (minSellingPrice < purchasedPrice) {
      alert("Minimum selling price must be greater than or equal to purchased price");
      return;
    }

    const payload = {
      ...editForm,
      purchasedPrice,
      minSellingPrice,
      quantity: Number(editForm.quantity),
      lowStockThreshold: Number(editForm.lowStockThreshold)
    };

    setActionLoading(true);
    try {
      await api.put(`/products/${editingProduct._id}`, payload);
      setMessage(t("products.updatedSuccess") || "Product Updated Successfully");
      setEditingProduct(null);
      fetchProducts();
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      alert(err.response?.data?.message || "Operation failed");
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm Delete Product
  const onConfirmDelete = async () => {
    if (!deletingProduct) return;
    setActionLoading(true);
    try {
      await api.delete(`/products/${deletingProduct._id}`);
      setDeletingProduct(null);
      fetchProducts();
      setMessage(t("common.deleted") || "Product deleted successfully");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete product");
    } finally {
      setActionLoading(false);
    }
  };

  // Add Category Handler
  const onAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setActionLoading(true);
    try {
      await api.post("/categories", { name: newCatName.trim() });
      setNewCatName("");
      setShowAddCategoryModal(false);
      setMessage(t("products.categoryAdded") || "Category added successfully");
      fetchCategories();
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to add category");
    } finally {
      setActionLoading(false);
    }
  };

  // Start Edit Category Handler
  const onStartEditCategory = (cat) => {
    setEditingCat(cat);
    setEditCatName(cat.name);
  };

  // Save Edit Category Handler
  const onSaveEditCategory = async (e) => {
    e.preventDefault();
    if (!editCatName.trim() || !editingCat) return;
    setActionLoading(true);
    try {
      await api.put(`/categories/${editingCat._id}`, { name: editCatName.trim() });
      setEditingCat(null);
      setEditCatName("");
      setMessage(t("products.categoryUpdated") || "Category updated successfully");
      fetchCategories();
      fetchProducts(false);
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update category");
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm Delete Category Handler
  const onConfirmDeleteCategory = async () => {
    if (!deletingCat) return;
    setActionLoading(true);
    try {
      await api.delete(`/categories/${deletingCat._id}`);
      setDeletingCat(null);
      setMessage(t("products.categoryDeleted") || "Category deleted successfully");
      fetchCategories();
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      alert("Failed to delete category");
    } finally {
      setActionLoading(false);
    }
  };

  // Category product count map
  const categoryProductCountMap = useMemo(() => {
    const map = {};
    products.forEach((p) => {
      if (p.category) {
        map[p.category] = (map[p.category] || 0) + 1;
      }
    });
    return map;
  }, [products]);

  // Client-side category filter for instant UI response
  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return products;
    return products.filter((p) => p.category === selectedCategory);
  }, [products, selectedCategory]);

  // Categories search filter
  const filteredCategoriesList = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    return categories.filter((c) =>
      c.name.toLowerCase().includes(categorySearch.trim().toLowerCase())
    );
  }, [categories, categorySearch]);

  // Stock KPI counts
  const totalProducts = products.length;
  const totalStockUnits = useMemo(() => {
    return products.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0);
  }, [products]);

  const lowStockCount = useMemo(() => {
    return products.filter((p) => {
      const eff = p.initialStock || p.quantity || 1;
      const remainPct = Math.min(100, Math.round((p.quantity / eff) * 100));
      return remainPct < 25;
    }).length;
  }, [products]);

  const healthyStockCount = totalProducts - lowStockCount;

  const csvExport = useMemo(() => {
    const rows = [
      [t("products.name"), t("products.category"), "Purchased Price", "Min Selling Price", t("products.quantity")],
      ...filteredProducts.map((p) => {
        return [p.name, p.category, p.purchasedPrice || 0, p.minSellingPrice || 0, p.quantity];
      })
    ];
    return rows.map((row) => row.join(",")).join("\n");
  }, [filteredProducts, t]);

  if (initialLoading) {
    return <PageLoader loading={true} message="Please wait while product catalog is being loaded." />;
  }

  if (loadError && !products.length) {
    return (
      <PageLoader
        loading={false}
        error={loadError}
        onRetry={() => {
          fetchProducts(true);
          fetchCategories();
        }}
      />
    );
  }

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      {/* PROFESSIONAL ERP HERO HEADER */}
      <div className="products-hero-header">
        <div className="products-hero-title-wrap">
          <div className="products-hero-icon-badge" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
          <div>
            <h2 className="products-hero-title">{t("products.title")} Inventory</h2>
            <p className="products-hero-subtitle">
              Manage inventory items, categories, stock thresholds, and selling prices
            </p>
          </div>
        </div>

        <div className="products-hero-actions">
          <a
            className="btn btn-secondary"
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(csvExport)}`}
            download="products.csv"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
              textDecoration: "none",
              padding: "0.6rem 1rem",
              borderRadius: "10px",
              fontWeight: 600,
              fontSize: "0.86rem"
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>{t("products.exportCsv") || "Export CSV"}</span>
          </a>

          {canAddOrEdit && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setForm(defaultForm);
                setShowAddModal(true);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                padding: "0.6rem 1.15rem",
                borderRadius: "10px",
                fontWeight: 700,
                fontSize: "0.88rem"
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>{t("common.addProduct")}</span>
            </button>
          )}
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {message && (
        <div style={{
          padding: "0.85rem 1.15rem",
          borderRadius: "12px",
          background: "rgba(16, 185, 129, 0.12)",
          border: "1px solid rgba(16, 185, 129, 0.28)",
          color: "var(--primary, #10b981)",
          fontWeight: 700,
          fontSize: "0.92rem",
          display: "flex",
          alignItems: "center",
          gap: "0.6rem"
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{message}</span>
        </div>
      )}

      {/* INVENTORY KPI SUMMARY CARDS */}
      <div className="products-kpi-grid">
        <div className="products-kpi-card">
          <div className="products-kpi-icon-wrap products-kpi-icon-wrap--primary" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
          </div>
          <div className="products-kpi-info">
            <span className="products-kpi-label">{t("products.totalProducts") || "Total Products"}</span>
            <span className="products-kpi-val">{totalProducts}</span>
          </div>
        </div>

        <div className="products-kpi-card">
          <div className="products-kpi-icon-wrap products-kpi-icon-wrap--blue" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          </div>
          <div className="products-kpi-info">
            <span className="products-kpi-label">{t("products.totalStock") || "Total Stock Units"}</span>
            <span className="products-kpi-val">{totalStockUnits}</span>
          </div>
        </div>

        <div className="products-kpi-card">
          <div className="products-kpi-icon-wrap products-kpi-icon-wrap--primary" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="products-kpi-info">
            <span className="products-kpi-label">{t("products.healthy") || "In Stock"}</span>
            <span className="products-kpi-val" style={{ color: "var(--primary, #10b981)" }}>{healthyStockCount}</span>
          </div>
        </div>

        <div className="products-kpi-card">
          <div className="products-kpi-icon-wrap products-kpi-icon-wrap--warning" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div className="products-kpi-info">
            <span className="products-kpi-label">{t("products.lowStock") || "Low / Critical"}</span>
            <span className="products-kpi-val" style={{ color: lowStockCount > 0 ? "#f59e0b" : "var(--text)" }}>{lowStockCount}</span>
          </div>
        </div>
      </div>

      {/* =========================================================
          CATEGORY MANAGEMENT SECTION (COLLAPSIBLE / EXPANDING)
          ========================================================= */}
      {canManageProducts && (
        <div className={`category-mgmt-card ${!categoriesExpanded ? "category-mgmt-card--collapsed" : ""}`}>
          <div
            className="category-mgmt-header"
            onClick={() => setCategoriesExpanded(!categoriesExpanded)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setCategoriesExpanded(!categoriesExpanded);
              }
            }}
            aria-expanded={categoriesExpanded}
          >
            <div className="category-mgmt-title-wrap">
              <div className="category-mgmt-icon-wrap" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
                  <h3 className="category-mgmt-title">
                    {t("products.categoryManagement") || "Category Management"}
                  </h3>
                  <span className="category-mgmt-badge">
                    {categories.length} {categories.length === 1 ? "category" : "categories"}
                  </span>
                </div>
                <p style={{ margin: "0.15rem 0 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  {categoriesExpanded
                    ? "Organize products into functional departments and sales classifications"
                    : "Click to expand category classifications and management tools"}
                </p>
              </div>
            </div>

            <div className="category-mgmt-actions" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className={`category-toggle-btn ${categoriesExpanded ? "category-toggle-btn--expanded" : ""}`}
                onClick={() => setCategoriesExpanded(!categoriesExpanded)}
                aria-expanded={categoriesExpanded}
                aria-label={categoriesExpanded ? "Collapse Category Management" : "Expand Category Management"}
              >
                <span className="category-toggle-icon" aria-hidden="true">
                  {categoriesExpanded ? "▼" : "▶"}
                </span>
                <span className="category-toggle-text">
                  {categoriesExpanded ? (t("common.collapse") || "Collapse") : (t("common.expand") || "Expand")}
                </span>
              </button>
            </div>
          </div>

          {/* Smooth Collapsible Content Area */}
          <div className={`category-mgmt-body ${categoriesExpanded ? "is-expanded" : ""}`}>
            <div className="category-mgmt-body-inner">
              {/* Management Controls Bar: Search & Add Category */}
              <div className="category-mgmt-controls-bar">
                <div className="category-search-input-wrap">
                  <span className="category-search-icon" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    className="category-search-input"
                    placeholder={t("products.searchCategories") || "Search categories..."}
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setNewCatName("");
                    setShowAddCategoryModal(true);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    padding: "0.45rem 0.95rem",
                    borderRadius: "10px",
                    fontSize: "0.85rem",
                    fontWeight: 700
                  }}
                >
                  <span>+</span>
                  <span>{t("products.addCategory") || "Add Category"}</span>
                </button>
              </div>

              {/* Category Cards Grid */}
              <div className="category-cards-grid">
                {filteredCategoriesList.map((cat) => {
                  const productCount = categoryProductCountMap[cat.name] || 0;
                  return (
                    <div key={cat._id} className="category-card-item">
                      <div className="category-card-left">
                        <span className="category-card-folder-icon" aria-hidden="true">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                          </svg>
                        </span>
                        <div className="category-card-details">
                          <span className="category-card-name" title={cat.name}>
                            {cat.name}
                          </span>
                          <span className="category-card-count">
                            {productCount} {productCount === 1 ? "product" : "products"}
                          </span>
                        </div>
                      </div>

                      <div className="category-card-actions">
                        <button
                          type="button"
                          className="category-action-btn category-action-btn--edit"
                          onClick={() => onStartEditCategory(cat)}
                          title={`Edit category ${cat.name}`}
                          aria-label={`Edit ${cat.name}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="category-action-btn category-action-btn--delete"
                          onClick={() => setDeletingCat(cat)}
                          title={`Delete category ${cat.name}`}
                          aria-label={`Delete ${cat.name}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {filteredCategoriesList.length === 0 && (
                  <div style={{
                    gridColumn: "1 / -1",
                    padding: "1.5rem",
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontSize: "0.88rem"
                  }}>
                    {categorySearch ? "No categories match your search." : "No categories created yet."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          PRODUCT TOOLBAR & FILTERS
          ========================================================= */}
      <div className="products-filter-toolbar">
        {/* Search input with icon and clear button */}
        <div className="products-search-wrap">
          <span className="products-search-icon" aria-hidden="true">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            className="products-search-input"
            placeholder={t("common.searchProducts") || "Search products..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="products-search-clear"
              onClick={() => setSearch("")}
              title="Clear search"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Category Filter Dropdown */}
        <div className="products-category-filter">
          <select
            id="product-category-filter-select"
            className="products-category-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">{t("products.allCategories") || "All Categories"}</option>
            {categories.map((c) => (
              <option key={c._id} value={c.name}>{c.name}</option>
            ))}
          </select>
          {selectedCategory && (
            <button
              type="button"
              className="category-filter-clear"
              onClick={() => setSelectedCategory("")}
              title="Clear category filter"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <span>{t("common.clear") || "Clear"}</span>
            </button>
          )}
          {selectedCategory && (
            <span className="category-filter-badge">
              {filteredProducts.length} {filteredProducts.length === 1 ? "product" : "products"}
            </span>
          )}
        </div>
      </div>

      {/* =========================================================
          PRODUCT DISPLAY (DESKTOP TABLE & MOBILE CARDS)
          ========================================================= */}
      <div className="products-table-card">
        <div className="products-table-header-bar">
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <h3 className="products-table-title">Product Catalog</h3>
            <span className="sales-kpi-badge" style={{ background: "rgba(16, 185, 129, 0.12)", color: "var(--primary, #10b981)" }}>
              {filteredProducts.length} {filteredProducts.length === 1 ? "item" : "items"}
            </span>
          </div>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            Showing {filteredProducts.length} of {products.length} products
          </span>
        </div>

        {/* DESKTOP / TABLET DATA TABLE */}
        <div className="products-table-container table-responsive">
          <table className="products-data-table">
            <thead>
              <tr>
                <th>{t("products.name")}</th>
                <th>{t("products.category")}</th>
                <th>Purchased Price</th>
                <th>Min Selling Price</th>
                <th>{t("products.stockLevel")}</th>
                <th>{t("products.status")}</th>
                <th>{t("products.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
                    <div className="category-filter-empty" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
                      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35 }}>
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      <p style={{ margin: 0, fontWeight: 600, color: "var(--text-muted)" }}>
                        {t("products.noProductsInCategory") || "No products found."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const effInitial = product.initialStock || product.quantity || 1;
                  const remainPct = Math.min(100, Math.round((product.quantity / effInitial) * 100));

                  return (
                    <tr key={product._id}>
                      <td>
                        <div className="product-name-cell">
                          <div className="product-avatar-badge" aria-hidden="true">
                            {product.name?.charAt(0)?.toUpperCase() || "P"}
                          </div>
                          <span className="product-name-text">{product.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="product-category-tag">{product.category}</span>
                      </td>
                      <td>
                        <span className="product-price-val">{formatCurrency(product.purchasedPrice || 0)}</span>
                      </td>
                      <td>
                        <span className="product-min-price-val">{formatCurrency(product.minSellingPrice || 0)}</span>
                      </td>
                      <td>
                        <StockBar
                          current={product.quantity}
                          initial={product.initialStock}
                          threshold={product.lowStockThreshold}
                          t={t}
                        />
                      </td>
                      <td>
                        {(() => {
                          if (remainPct <= 5) {
                            return <span className="stock-status stock-status--danger">{t("products.criticalStock")}</span>;
                          } else if (remainPct < 25) {
                            return <span className="stock-status stock-status--warning">{t("products.lowStock")}</span>;
                          }
                          return <span className="stock-status stock-status--healthy">{t("products.healthy")}</span>;
                        })()}
                      </td>
                      <td>
                        <div className="product-action-btn-group">
                          <button
                            type="button"
                            className="product-action-btn"
                            onClick={() => onEdit(product)}
                            title={`Edit product ${product.name}`}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                            <span>{t("common.edit")}</span>
                          </button>
                          {canManageProducts && (
                            <button
                              type="button"
                              className="product-action-btn product-action-btn--delete"
                              onClick={() => setDeletingProduct(product)}
                              title={`Delete product ${product.name}`}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                              <span>{t("common.delete")}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE RESPONSIVE PRODUCT CARDS */}
        <div className="products-mobile-card-list">
          {filteredProducts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--text-muted)" }}>
              <p style={{ margin: 0, fontWeight: 600 }}>{t("products.noProductsInCategory") || "No products found."}</p>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const effInitial = product.initialStock || product.quantity || 1;
              const remainPct = Math.min(100, Math.round((product.quantity / effInitial) * 100));

              return (
                <div key={product._id} className="product-mobile-card">
                  <div className="product-mobile-card-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                      <div className="product-avatar-badge" aria-hidden="true">
                        {product.name?.charAt(0)?.toUpperCase() || "P"}
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: "0.98rem", fontWeight: 700 }}>{product.name}</h4>
                        <span className="product-category-tag" style={{ marginTop: "0.25rem" }}>{product.category}</span>
                      </div>
                    </div>

                    <div>
                      {(() => {
                        if (remainPct <= 5) {
                          return <span className="stock-status stock-status--danger">{t("products.criticalStock")}</span>;
                        } else if (remainPct < 25) {
                          return <span className="stock-status stock-status--warning">{t("products.lowStock")}</span>;
                        }
                        return <span className="stock-status stock-status--healthy">{t("products.healthy")}</span>;
                      })()}
                    </div>
                  </div>

                  <div className="product-mobile-card-prices">
                    <div>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, display: "block" }}>
                        Purchased
                      </span>
                      <span className="product-price-val" style={{ fontSize: "0.95rem" }}>
                        {formatCurrency(product.purchasedPrice || 0)}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, display: "block" }}>
                        Min Selling
                      </span>
                      <span className="product-min-price-val" style={{ fontSize: "0.95rem" }}>
                        {formatCurrency(product.minSellingPrice || 0)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <StockBar
                      current={product.quantity}
                      initial={product.initialStock}
                      threshold={product.lowStockThreshold}
                      t={t}
                    />
                  </div>

                  <div className="product-mobile-card-actions">
                    <button
                      type="button"
                      className="product-action-btn"
                      onClick={() => onEdit(product)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                      <span>{t("common.edit")}</span>
                    </button>
                    {canManageProducts && (
                      <button
                        type="button"
                        className="product-action-btn product-action-btn--delete"
                        onClick={() => setDeletingProduct(product)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        <span>{t("common.delete")}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* =========================================================
          ADD PRODUCT MODAL
          ========================================================= */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={t("common.addProduct") || "Add New Product"}
        maxWidth="540px"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        }
      >
        <form onSubmit={onAddSubmit} className="stack" style={{ gap: "0.95rem" }}>
          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 700, display: "block", marginBottom: "0.35rem" }}>
              {t("products.name")} *
            </label>
            <input
              placeholder="Product Name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "10px" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: 700, display: "block", marginBottom: "0.35rem" }}>
                Purchased Price (ETB)
              </label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                value={form.purchasedPrice}
                onChange={(e) => setForm({ ...form, purchasedPrice: e.target.value })}
                style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "10px" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: 700, display: "block", marginBottom: "0.35rem" }}>
                Min Selling Price (ETB)
              </label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                value={form.minSellingPrice}
                onChange={(e) => setForm({ ...form, minSellingPrice: e.target.value })}
                style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "10px" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: 700, display: "block", marginBottom: "0.35rem" }}>
                {t("products.quantity")} *
              </label>
              <input
                type="number"
                placeholder="0"
                required
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "10px" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: 700, display: "block", marginBottom: "0.35rem" }}>
                {t("products.lowStockThreshold")}
              </label>
              <input
                type="number"
                placeholder="10"
                value={form.lowStockThreshold}
                onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })}
                style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "10px" }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 700, display: "block", marginBottom: "0.35rem" }}>
              {t("products.category")} *
            </label>
            <select
              required
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "10px" }}
            >
              <option value="">-- {t("products.category")} --</option>
              {categories.map((c) => (
                <option key={c._id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.65rem", marginTop: "0.6rem" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowAddModal(false)}
              disabled={actionLoading}
            >
              {t("common.cancel") || "Cancel"}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={actionLoading}
            >
              {actionLoading ? "Saving..." : t("common.addProduct")}
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================================================
          EDIT PRODUCT MODAL
          ========================================================= */}
      <Modal
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        title={`${t("common.edit") || "Edit"}: ${editingProduct?.name || ""}`}
        maxWidth="540px"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        }
      >
        <form onSubmit={onSaveEdit} className="stack" style={{ gap: "0.95rem" }}>
          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 700, display: "block", marginBottom: "0.35rem" }}>
              {t("products.name")} *
            </label>
            <input
              placeholder="Product Name"
              required
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "10px" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: 700, display: "block", marginBottom: "0.35rem" }}>
                Purchased Price (ETB)
              </label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                value={editForm.purchasedPrice}
                onChange={(e) => setEditForm({ ...editForm, purchasedPrice: e.target.value })}
                style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "10px" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: 700, display: "block", marginBottom: "0.35rem" }}>
                Min Selling Price (ETB)
              </label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                value={editForm.minSellingPrice}
                onChange={(e) => setEditForm({ ...editForm, minSellingPrice: e.target.value })}
                style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "10px" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: 700, display: "block", marginBottom: "0.35rem" }}>
                {t("products.quantity")} *
              </label>
              <input
                type="number"
                placeholder="0"
                required
                value={editForm.quantity}
                onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "10px" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: 700, display: "block", marginBottom: "0.35rem" }}>
                {t("products.lowStockThreshold")}
              </label>
              <input
                type="number"
                placeholder="10"
                value={editForm.lowStockThreshold}
                onChange={(e) => setEditForm({ ...editForm, lowStockThreshold: e.target.value })}
                style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "10px" }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 700, display: "block", marginBottom: "0.35rem" }}>
              {t("products.category")} *
            </label>
            <select
              required
              value={editForm.category}
              onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
              style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "10px" }}
            >
              <option value="">-- {t("products.category")} --</option>
              {categories.map((c) => (
                <option key={c._id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.65rem", marginTop: "0.6rem" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setEditingProduct(null)}
              disabled={actionLoading}
            >
              {t("common.cancel") || "Cancel"}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={actionLoading}
            >
              {actionLoading ? "Updating..." : t("common.updateProduct") || "Update Product"}
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================================================
          DELETE PRODUCT CONFIRMATION MODAL
          ========================================================= */}
      <Modal
        isOpen={!!deletingProduct}
        onClose={() => setDeletingProduct(null)}
        title="Confirm Product Deletion"
        maxWidth="460px"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        }
      >
        <div className="stack" style={{ gap: "1rem" }}>
          <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.5 }}>
            Are you sure you want to permanently delete the following product?
          </p>
          <div style={{
            padding: "0.85rem 1.1rem",
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.22)",
            borderRadius: "12px"
          }}>
            <strong style={{ fontSize: "1.05rem", color: "#ef4444" }}>{deletingProduct?.name}</strong>
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.3rem" }}>
              Category: <strong>{deletingProduct?.category}</strong> • Current Stock: <strong>{deletingProduct?.quantity} units</strong>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-muted)" }}>
            This action cannot be undone. Inventory and historical records for this item will be affected.
          </p>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.65rem", marginTop: "0.5rem" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDeletingProduct(null)}
              disabled={actionLoading}
            >
              {t("common.cancel") || "Cancel"}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={onConfirmDelete}
              disabled={actionLoading}
            >
              {actionLoading ? "Deleting..." : "Yes, Delete Product"}
            </button>
          </div>
        </div>
      </Modal>

      {/* =========================================================
          ADD CATEGORY MODAL
          ========================================================= */}
      <Modal
        isOpen={showAddCategoryModal}
        onClose={() => setShowAddCategoryModal(false)}
        title={t("products.addCategory") || "Add New Category"}
        maxWidth="460px"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            <line x1="12" y1="11" x2="12" y2="17" />
            <line x1="9" y1="14" x2="15" y2="14" />
          </svg>
        }
      >
        <form onSubmit={onAddCategory} className="stack" style={{ gap: "1rem" }}>
          <div>
            <label style={{ fontSize: "0.86rem", fontWeight: 700, display: "block", marginBottom: "0.4rem" }}>
              {t("products.categoryName") || "Category Name"} *
            </label>
            <input
              placeholder="e.g., Electronics, Beverages, Cosmetics..."
              required
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              style={{ width: "100%", padding: "0.7rem 0.9rem", borderRadius: "10px" }}
              autoFocus
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.65rem", marginTop: "0.5rem" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowAddCategoryModal(false)}
              disabled={actionLoading}
            >
              {t("common.cancel") || "Cancel"}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={actionLoading}
            >
              {actionLoading ? "Saving..." : t("common.create") || "Create"}
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================================================
          EDIT CATEGORY MODAL
          ========================================================= */}
      <Modal
        isOpen={!!editingCat}
        onClose={() => setEditingCat(null)}
        title={`${t("products.editCategory") || "Edit Category"}: ${editingCat?.name || ""}`}
        maxWidth="460px"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        }
      >
        <form onSubmit={onSaveEditCategory} className="stack" style={{ gap: "1rem" }}>
          <div>
            <label style={{ fontSize: "0.86rem", fontWeight: 700, display: "block", marginBottom: "0.4rem" }}>
              {t("products.categoryName") || "Category Name"} *
            </label>
            <input
              placeholder="Category Name"
              required
              value={editCatName}
              onChange={(e) => setEditCatName(e.target.value)}
              style={{ width: "100%", padding: "0.7rem 0.9rem", borderRadius: "10px" }}
              autoFocus
            />
          </div>

          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-muted)" }}>
            Updating this category name will automatically keep all existing items in this category synchronized.
          </p>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.65rem", marginTop: "0.5rem" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setEditingCat(null)}
              disabled={actionLoading}
            >
              {t("common.cancel") || "Cancel"}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={actionLoading}
            >
              {actionLoading ? "Updating..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================================================
          DELETE CATEGORY CONFIRMATION MODAL
          ========================================================= */}
      <Modal
        isOpen={!!deletingCat}
        onClose={() => setDeletingCat(null)}
        title="Confirm Category Deletion"
        maxWidth="460px"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        }
      >
        <div className="stack" style={{ gap: "1rem" }}>
          <p style={{ margin: 0, fontSize: "0.95rem" }}>
            Are you sure you want to delete the category: <strong>"{deletingCat?.name}"</strong>?
          </p>

          {categoryProductCountMap[deletingCat?.name] > 0 && (
            <div style={{
              padding: "0.75rem 1rem",
              background: "rgba(245, 158, 11, 0.1)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              borderRadius: "10px",
              fontSize: "0.85rem",
              color: "#b45309"
            }}>
              ⚠️ Notice: <strong>{categoryProductCountMap[deletingCat?.name]} products</strong> currently belong to this category.
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.65rem", marginTop: "0.5rem" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDeletingCat(null)}
              disabled={actionLoading}
            >
              {t("common.cancel") || "Cancel"}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={onConfirmDeleteCategory}
              disabled={actionLoading}
            >
              {actionLoading ? "Deleting..." : "Delete Category"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
