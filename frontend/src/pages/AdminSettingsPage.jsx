import { useState, useCallback } from "react";
import { api } from "../api/client";
import { useI18n } from "../context/I18nContext";

/* -------------------------------------------------------
   Retention option definitions
   ------------------------------------------------------- */
const RETENTION_OPTIONS = [
  { key: "all", labelKey: "settings.optionAll", hintKey: "settings.optionAllHint", exclusive: true },
  { key: "categories", labelKey: "settings.optionCategories" },
  { key: "products", labelKey: "settings.optionProducts" },
  { key: "sales", labelKey: "settings.optionSales" },
  { key: "profits", labelKey: "settings.optionProfits" }
];

const TOTAL_STEPS = 3;

/* -------------------------------------------------------
   Step indicator component
   ------------------------------------------------------- */
const StepIndicator = ({ current, t }) => {
  const steps = [1, 2, 3];
  return (
    <div>
      <div className="reset-step-indicator">
        {steps.map((s, i) => (
          <span key={s} style={{ display: "contents" }}>
            <span
              className={`reset-step-dot${s === current ? " active" : ""}${s < current ? " completed" : ""}`}
            >
              {s < current ? "✓" : s}
            </span>
            {i < steps.length - 1 ? (
              <span className={`reset-step-line${s < current ? " completed" : ""}`} />
            ) : null}
          </span>
        ))}
      </div>
      <p className="reset-step-label">
        {t("settings.stepLabel").replace("{current}", current).replace("{total}", TOTAL_STEPS)}
      </p>
    </div>
  );
};

/* -------------------------------------------------------
   Main component
   ------------------------------------------------------- */
export const AdminSettingsPage = () => {
  const { t } = useI18n();

  // Wizard state
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState(1);

  // Step 1 – selection
  const [selected, setSelected] = useState([]);

  // Step 2 – password
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [attemptsRemaining, setAttemptsRemaining] = useState(null);
  const [lockout, setLockout] = useState(null); // { message, remainingMinutes }

  // Step 3 – confirmation
  const [preview, setPreview] = useState(null);
  const [confirmation, setConfirmation] = useState("");
  const [executing, setExecuting] = useState(false);

  // Step 4 – result
  const [result, setResult] = useState(null); // { success, data }

  /* -------------------------------------------------------
     Reset all wizard state
     ------------------------------------------------------- */
  const resetWizard = useCallback(() => {
    setShowModal(false);
    setStep(1);
    setSelected([]);
    setPassword("");
    setVerifying(false);
    setPasswordError("");
    setAttemptsRemaining(null);
    setLockout(null);
    setPreview(null);
    setConfirmation("");
    setExecuting(false);
    setResult(null);
  }, []);

  const openWizard = () => {
    resetWizard();
    setShowModal(true);
  };

  const closeModal = () => {
    if (verifying || executing) return;
    resetWizard();
  };

  /* -------------------------------------------------------
     Step 1 – toggle checkbox
     ------------------------------------------------------- */
  const toggleOption = (key) => {
    setSelected((prev) => {
      if (key === "all") {
        // "all" is exclusive — selecting it deselects everything else
        return prev.includes("all") ? [] : ["all"];
      }
      // Deselect "all" if a specific option is picked
      const withoutAll = prev.filter((k) => k !== "all");
      if (withoutAll.includes(key)) {
        return withoutAll.filter((k) => k !== key);
      }
      return [...withoutAll, key];
    });
  };

  const canProceedStep1 = selected.length > 0;

  /* -------------------------------------------------------
     Step 2 – verify password
     ------------------------------------------------------- */
  const handleVerifyPassword = async () => {
    if (!password.trim() || password.length < 6) return;
    try {
      setVerifying(true);
      setPasswordError("");
      setAttemptsRemaining(null);
      setLockout(null);

      const { data } = await api.post("/admin/reset-database/verify-password", {
        password,
        retentionOptions: selected
      });

      // Success — store preview and move to step 3
      setPreview(data.preview);
      setStep(3);
    } catch (err) {
      const status = err.response?.status;
      const body = err.response?.data;

      if (status === 423) {
        setLockout({
          message: body?.message || t("settings.lockedOut"),
          remainingMinutes: body?.remainingMinutes || 15
        });
      } else if (status === 401) {
        setPasswordError(body?.message || t("settings.invalidPassword"));
        if (typeof body?.attemptsRemaining === "number") {
          setAttemptsRemaining(body.attemptsRemaining);
        }
      } else {
        setPasswordError(body?.message || t("settings.resetFailed"));
      }
    } finally {
      setVerifying(false);
    }
  };

  /* -------------------------------------------------------
     Step 3 – execute reset
     ------------------------------------------------------- */
  const handleExecuteReset = async () => {
    if (confirmation !== "RESET" || executing) return;
    try {
      setExecuting(true);
      setPasswordError("");

      const { data } = await api.post("/admin/reset-database/execute", {
        password,
        retentionOptions: selected,
        confirmation: "RESET"
      });

      setResult({
        success: true,
        data: {
          message: data.message,
          collectionsRetained: data.collectionsRetained || [],
          collectionsDeleted: data.collectionsDeleted || []
        }
      });
      setStep(4);
    } catch (err) {
      const body = err.response?.data;
      setResult({
        success: false,
        data: {
          message: body?.message || t("settings.resetFailedMsg"),
          reason: body?.reason || body?.message || t("settings.resetFailed"),
          recommendation: body?.recommendation || t("settings.defaultRecommendation")
        }
      });
      setStep(4);
    } finally {
      setExecuting(false);
      // Clear password from memory
      setPassword("");
    }
  };

  /* -------------------------------------------------------
     Render helpers
     ------------------------------------------------------- */

  const renderStep1 = () => (
    <>
      <h3 className="reset-step-title">{t("settings.stepSelectTitle")}</h3>
      <p className="reset-step-desc">{t("settings.stepSelectDesc")}</p>

      <div className="reset-checkbox-group">
        {RETENTION_OPTIONS.map((opt) => {
          const isChecked = selected.includes(opt.key);
          const isDanger = opt.key === "all";
          return (
            <label
              key={opt.key}
              className={`reset-checkbox-item${isChecked ? " checked" : ""}${isDanger ? " danger" : ""}`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleOption(opt.key)}
              />
              <div className="reset-checkbox-label">
                <span>{t(opt.labelKey)}</span>
                {opt.hintKey ? <span>{t(opt.hintKey)}</span> : null}
              </div>
            </label>
          );
        })}
      </div>

      {(selected.includes("sales") || selected.includes("profits")) && !selected.includes("all") ? (
        <p className="reset-sales-note">{t("settings.optionSalesNote")}</p>
      ) : null}

      {!canProceedStep1 ? (
        <p className="reset-step-desc" style={{ textAlign: "center", fontStyle: "italic" }}>
          {t("settings.selectAtLeast")}
        </p>
      ) : null}

      <div className="reset-btn-row">
        <button type="button" className="btn secondary" onClick={closeModal}>
          {t("users.cancel")}
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={!canProceedStep1}
          onClick={() => setStep(2)}
        >
          {t("settings.next")} →
        </button>
      </div>
    </>
  );

  const renderStep2 = () => (
    <>
      <h3 className="reset-step-title">{t("settings.stepPasswordTitle")}</h3>
      <p className="reset-step-desc">{t("settings.stepPasswordDesc")}</p>

      {lockout ? (
        <div className="reset-lockout-banner">
          <div>{t("settings.lockedOut")}</div>
          <div>{t("settings.lockedOutRetry").replace("{minutes}", lockout.remainingMinutes)}</div>
        </div>
      ) : null}

      <div className="reset-password-field">
        <label>{t("settings.passwordLabel")}</label>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setPasswordError("");
          }}
          placeholder={t("settings.passwordPlaceholder")}
          disabled={verifying || !!lockout}
          minLength={6}
        />
      </div>

      {passwordError ? <p className="reset-error">{passwordError}</p> : null}

      {attemptsRemaining !== null && !lockout ? (
        <p className="reset-attempts-hint">
          {t("settings.attemptsRemaining").replace("{count}", attemptsRemaining)}
        </p>
      ) : null}

      <div className="reset-btn-row">
        <button
          type="button"
          className="btn secondary"
          onClick={() => {
            setStep(1);
            setPassword("");
            setPasswordError("");
            setAttemptsRemaining(null);
            setLockout(null);
          }}
          disabled={verifying}
        >
          ← {t("settings.back")}
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={verifying || !password.trim() || password.length < 6 || !!lockout}
          onClick={handleVerifyPassword}
        >
          {verifying ? (
            <span className="reset-spinner-wrap">
              <span className="reset-spinner" />
              {t("settings.verifying")}
            </span>
          ) : (
            t("settings.verifyAndContinue")
          )}
        </button>
      </div>
    </>
  );

  const renderStep3 = () => {
    const canExecute = confirmation === "RESET" && !executing;
    return (
      <>
        <h3 className="reset-step-title">{t("settings.stepConfirmTitle")}</h3>
        <p className="reset-step-desc">{t("settings.stepConfirmDesc")}</p>

        {preview ? (
          <div className="reset-summary">
            {/* Retained */}
            <div className="reset-summary-section retain">
              <h4 className="reset-summary-heading">✅ {t("settings.dataRetained")}</h4>
              <ul className="reset-summary-list">
                {preview.collectionsRetained.length > 0
                  ? preview.collectionsRetained.map((c) => <li key={c}>{c}</li>)
                  : <li>{t("settings.none")}</li>}
              </ul>
            </div>

            {/* Deleted */}
            <div className="reset-summary-section delete">
              <h4 className="reset-summary-heading">🗑️ {t("settings.dataDeleted")}</h4>
              <ul className="reset-summary-list">
                {preview.collectionsDeleted.length > 0
                  ? preview.collectionsDeleted.map((c) => <li key={c}>{c}</li>)
                  : <li>{t("settings.none")}</li>}
              </ul>
            </div>
          </div>
        ) : null}

        <p className="reset-warning-banner">{t("settings.irreversibleWarning")}</p>

        <div className="reset-confirm-input-group">
          <label>{t("settings.typeResetLabel")}</label>
          <input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value.toUpperCase())}
            placeholder="RESET"
            disabled={executing}
          />
        </div>

        <div className="reset-btn-row">
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              setStep(2);
              setConfirmation("");
            }}
            disabled={executing}
          >
            ← {t("settings.back")}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={!canExecute}
            onClick={handleExecuteReset}
          >
            {executing ? (
              <span className="reset-spinner-wrap">
                <span className="reset-spinner" />
                {t("settings.resetting")}
              </span>
            ) : (
              t("settings.confirmAndReset")
            )}
          </button>
        </div>
      </>
    );
  };

  const renderResult = () => {
    if (!result) return null;
    const { success, data } = result;

    if (success) {
      return (
        <div className="reset-result">
          <div className="reset-result-icon">✅</div>
          <h3 className="reset-result-title success">{t("settings.resetSuccessTitle")}</h3>
          <p className="reset-result-msg">{t("settings.resetSuccessMsg")}</p>

          <div className="reset-result-details">
            <p className="reset-result-detail-label">{t("settings.collectionsRetained")}</p>
            <p className="reset-result-detail-value">
              {data.collectionsRetained.length > 0 ? data.collectionsRetained.join(", ") : t("settings.none")}
            </p>

            <p className="reset-result-detail-label">{t("settings.collectionsDeleted")}</p>
            <p className="reset-result-detail-value">
              {data.collectionsDeleted.length > 0 ? data.collectionsDeleted.join(", ") : t("settings.none")}
            </p>
          </div>

          <div className="reset-btn-row" style={{ justifyContent: "center" }}>
            <button type="button" className="btn" onClick={resetWizard}>
              {t("settings.close")}
            </button>
          </div>
        </div>
      );
    }

    // Error result
    return (
      <div className="reset-result">
        <div className="reset-result-icon">❌</div>
        <h3 className="reset-result-title error">{t("settings.resetFailedTitle")}</h3>
        <p className="reset-result-msg">{t("settings.resetFailedMsg")}</p>

        <div className="reset-result-details">
          <p className="reset-result-detail-label">{t("settings.failureReason")}</p>
          <p className="reset-result-detail-value">{data.reason}</p>

          <p className="reset-result-detail-label">{t("settings.recommendation")}</p>
          <p className="reset-result-detail-value">{data.recommendation}</p>
        </div>

        <div className="reset-btn-row" style={{ justifyContent: "center" }}>
          <button type="button" className="btn" onClick={resetWizard}>
            {t("settings.close")}
          </button>
        </div>
      </div>
    );
  };

  /* -------------------------------------------------------
     Main render
     ------------------------------------------------------- */
  return (
    <div className="stack">
      <h2>{t("settings.title")}</h2>

      <section className="card danger-zone-card">
        <div className="row-between">
          <div>
            <h3 className="danger-zone-title">{t("settings.dangerZone")}</h3>
            <p className="error danger-zone-warning">{t("settings.warningText")}</p>
          </div>
          <button className="btn btn-danger" onClick={openWizard}>
            {t("settings.resetDatabase")}
          </button>
        </div>
      </section>

      {showModal ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t("settings.resetDatabase")}>
          <div className="card modal-card modal-card--wide reset-wizard">
            {step <= 3 ? <StepIndicator current={step} t={t} /> : null}

            {step === 1 ? renderStep1() : null}
            {step === 2 ? renderStep2() : null}
            {step === 3 ? renderStep3() : null}
            {step === 4 ? renderResult() : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};
