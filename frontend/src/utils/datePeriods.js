/**
 * Date period calculation helpers for Sales and Profit pages.
 * Accurately calculates local date bounds to prevent timezone day-shift bugs.
 */

export const formatLocalDate = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const calculatePeriodDates = (periodKey) => {
  const now = new Date();

  if (periodKey === "today") {
    const todayStr = formatLocalDate(now);
    return {
      date: todayStr,
      startDate: todayStr,
      endDate: todayStr,
      label: "Today"
    };
  }

  if (periodKey === "this_week") {
    // Current week starting from Sunday 00:00 through today
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    return {
      date: "",
      startDate: formatLocalDate(startOfWeek),
      endDate: formatLocalDate(now),
      label: "This Week"
    };
  }

  if (periodKey === "this_month") {
    // 1st of current month through today
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      date: "",
      startDate: formatLocalDate(startOfMonth),
      endDate: formatLocalDate(now),
      label: "This Month"
    };
  }

  if (periodKey === "last_month") {
    // 1st of previous calendar month through last day of previous calendar month
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      date: "",
      startDate: formatLocalDate(startOfLastMonth),
      endDate: formatLocalDate(endOfLastMonth),
      label: "Last Month"
    };
  }

  return {
    date: "",
    startDate: "",
    endDate: "",
    label: "All Time"
  };
};

export const SALES_PERIOD_OPTIONS = [
  { value: "", label: "All Sales" },
  { value: "today", label: "Today's Sales" },
  { value: "this_week", label: "This Week's Sales" },
  { value: "this_month", label: "This Month's Sales" },
  { value: "last_month", label: "Last Month's Sales" }
];

export const PROFIT_PERIOD_OPTIONS = [
  { value: "", label: "All Time Profit" },
  { value: "today", label: "Today's Profit" },
  { value: "this_week", label: "This Week's Profit" },
  { value: "this_month", label: "This Month's Profit" },
  { value: "last_month", label: "Last Month's Profit" }
];
