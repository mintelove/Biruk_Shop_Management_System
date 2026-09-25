import React from "react";
import { useI18n } from "../context/I18nContext";

/**
 * Professional Global Page Loader component.
 * Displays a large, smooth circular animated indicator with title and message
 * while backend/database data is being fetched.
 * Includes graceful error state with Retry capability.
 */
export const PageLoader = ({
  loading = true,
  error = null,
  onRetry = null,
  title,
  message,
  children
}) => {
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="global-page-loader" role="status" aria-live="polite">
        <div className="page-loader-spinner-container">
          <div className="page-loader-ring" />
          <div className="page-loader-ring-pulse" />
        </div>
        <h3 className="page-loader-title">
          {title || t("common.loading") || "Loading..."}
        </h3>
        <p className="page-loader-message">
          {message || "Please wait while data is being loaded."}
        </p>
      </div>
    );
  }

  if (error) {
    const errorMsg =
      typeof error === "string"
        ? error
        : error?.message || "A network or server error occurred while retrieving data.";

    return (
      <div className="global-page-loader global-page-loader--error" role="alert">
        <div className="page-loader-error-icon-wrap" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3 className="page-loader-title page-loader-title--error">
          Unable to load data.
        </h3>
        <p className="page-loader-message page-loader-message--error">
          {errorMsg}
        </p>
        {onRetry && (
          <button
            type="button"
            className="btn btn-primary page-loader-retry-btn"
            onClick={onRetry}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Retry</span>
          </button>
        )}
      </div>
    );
  }

  return children || null;
};
