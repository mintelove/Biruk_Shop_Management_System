import React from "react";

/**
 * Shared Professional StatCard Component
 * Used across Dashboard, Sales, and Profit pages for 100% visual consistency.
 *
 * Supported colors:
 * - "sky": Sky / Cyan Blue (e.g., Today's Sales)
 * - "teal": Darker Teal / Cyan (e.g., Weekly Income)
 * - "blue": Royal / Sapphire Blue (e.g., Total Sales Revenue)
 * - "mint": Fresh Mint Green (e.g., Today's Profit)
 * - "emerald": Emerald Green (e.g., Weekly Profit / Period Sales)
 * - "green": Deep Forest Green (e.g., Total Profit)
 * - "indigo": Indigo / Navy (e.g., Total Transactions)
 * - "purple": Regal Purple (e.g., Total Products)
 * - "amber": Amber / Warning Yellow (e.g., Low Stock)
 * - "red" / "negative": Urgent Red (e.g., Critical Stock / Negative Profit)
 * - "zero": Slate Gray (e.g., Zero Profit)
 */
export const StatCard = ({
  title,
  value,
  subtitle,
  icon,
  badge,
  color = "emerald",
  isAlert = false,
  className = "",
  style = {},
  onClick
}) => {
  // Normalize color variant class
  const normalizedColor = color === "negative" ? "red" : color;
  const colorClass = `profit-total-card--${normalizedColor}`;

  return (
    <div
      className={`profit-total-card ${colorClass} ${isAlert ? "stat-card--alert" : ""} ${className}`}
      style={style}
      onClick={onClick}
    >
      <div className="profit-total-card-header">
        <p className="profit-total-label">{title}</p>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          {badge && <span className="stat-card-badge">{badge}</span>}
          {icon && <span className="stat-card-icon">{icon}</span>}
        </div>
      </div>
      <p className="profit-total-value">{value}</p>
      {subtitle && <p className="profit-total-subtitle">{subtitle}</p>}
    </div>
  );
};

export default StatCard;
