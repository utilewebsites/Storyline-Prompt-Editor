/**
 * modules/llm-settings.js
 *
 * Houdt alle UI-logica rondom LLM-instellingen bij zodat app.js enkel hoeft te orchestreren.
 * Functies verwachten state, elements en flagProjectDirty via dependency injection om globale
 * koppelingen te vermijden.
 */

import { t } from "./i18n.js";
import { showError, showSuccess } from "./dialogs.js";
import { PROJECT_DEFAULTS } from "./constants.js";
import { testOllamaConnection, getAvailableModels, isLLMServiceActive } from "./llm-service.js";

/**
 * Maak een controller die alle LLM gerelateerde helper functies expose-t.
 *
 * @param {Object} options
 * @param {Object} options.state - Centrale applicatie state
 * @param {Object} options.elements - Verzameling van veelgebruikte DOM elementen
 * @param {Function} options.flagProjectDirty - Callback om project als gewijzigd te markeren
 * @returns {Object} helpers
 */
export function createLLMSettingsController({ state, elements, flagProjectDirty }) {
  function ensureProjectLLMSettings() {
    if (!state.projectData) return null;
    if (!state.projectData.llmSettings) {
      state.projectData.llmSettings = { ...PROJECT_DEFAULTS.llmSettings };
    }
    return state.projectData.llmSettings;
  }

  function updateLLMStatusIndicator() {
    const indicator = elements.llmStatusIndicator;
    if (!indicator) return;

    const config = state.projectData?.llmSettings;
    if (isLLMServiceActive(config)) {
      indicator.classList.add("active");
    } else {
      indicator.classList.remove("active");
    }
  }

  function loadLLMSettings() {
    const config = ensureProjectLLMSettings();
    if (!config) return;

    if (elements.llmEnabled) elements.llmEnabled.checked = config.enabled ?? false;
    if (elements.llmOllamaUrl) elements.llmOllamaUrl.value = config.ollamaUrl ?? "http://localhost:11434";
    if (elements.llmImageModel) elements.llmImageModel.value = config.imageAnalysisModel ?? "llava:latest";
    if (elements.llmPromptModel) elements.llmPromptModel.value = config.promptGenerationModel ?? "llama3.2:latest";

    updateLLMStatusIndicator();
  }

  function saveLLMSettings() {
    if (!state.projectData) {
      showError(t("errors.noProjectOpen"));
      return;
    }

    const config = {
      enabled: elements.llmEnabled?.checked ?? false,
      ollamaUrl: elements.llmOllamaUrl?.value || "http://localhost:11434",
      imageAnalysisModel: elements.llmImageModel?.value || "llava:latest",
      promptGenerationModel: elements.llmPromptModel?.value || "llama3.2:latest",
    };

    state.projectData.llmSettings = config;
    flagProjectDirty();
    updateLLMStatusIndicator();

    elements.llmSettingsDialog?.close();
    showSuccess(t("llm.settingsSaved"));
  }

  async function testLLMConnection() {
    const statusEl = elements.llmConnectionStatus;
    if (!statusEl) return;

    const url = elements.llmOllamaUrl?.value || "http://localhost:11434";
    try {
      statusEl.textContent = t("llm.testingConnection");
      statusEl.className = "status-text";

      const models = await testOllamaConnection(url);
      statusEl.textContent = t("llm.connectionSuccessCount", { count: models.length });
      statusEl.className = "status-text success";

      await refreshLLMModels();
    } catch (error) {
      statusEl.textContent = t("llm.connectionFailed");
      statusEl.className = "status-text error";
      console.error("Ollama connectie test mislukt:", error);
    }
  }

  async function refreshLLMModels() {
    const url = elements.llmOllamaUrl?.value || "http://localhost:11434";
    try {
      const visionModels = await getAvailableModels(url, "vision");
      const textModels = await getAvailableModels(url, "text");

      updateModelOptions(elements.llmImageModel, visionModels, "llava:latest");
      updateModelOptions(elements.llmPromptModel, textModels, "llama3.2:latest");
    } catch (error) {
      console.error("Models ophalen mislukt:", error);
    }
  }

  function updateModelOptions(selectEl, models, fallbackValue) {
    if (!selectEl) return;
    const currentValue = selectEl.value;
    selectEl.innerHTML = "";

    if (!models || models.length === 0) {
      const option = document.createElement("option");
      option.value = fallbackValue;
      option.textContent = t("llm.modelNotInstalled", { model: fallbackValue });
      selectEl.appendChild(option);
      return;
    }

    models.forEach((model) => {
      const option = document.createElement("option");
      option.value = model.name;
      option.textContent = model.name;
      selectEl.appendChild(option);
    });

    if (models.find((model) => model.name === currentValue)) {
      selectEl.value = currentValue;
    }
  }

  async function initializeLLMForProject() {
    const config = state.projectData?.llmSettings;
    if (!config || !config.enabled) return;

    testLLMConnection().catch((err) => {
      console.warn("LLM connectie test bij project open mislukt:", err);
    });

    refreshLLMModels()
      .then(() => {
        restoreSelectedModels(config.imageAnalysisModel, elements.llmImageModel);
        restoreSelectedModels(config.promptGenerationModel, elements.llmPromptModel);
      })
      .catch((err) => {
        console.warn("LLM models laden bij project open mislukt:", err);
      });
  }

  function restoreSelectedModels(savedValue, selectEl) {
    if (!savedValue || !selectEl) return;
    const options = Array.from(selectEl.options);
    if (options.find((option) => option.value === savedValue)) {
      selectEl.value = savedValue;
    }
  }

  function resetLLMSettings() {
    if (!state.projectData) {
        showError(t("errors.noProjectOpen"));
      return;
    }

    state.projectData.llmSettings = { ...PROJECT_DEFAULTS.llmSettings };
    loadLLMSettings();
    flagProjectDirty();
      showSuccess(t("llm.resetSuccess"));
  }

  function openLLMSettings() {
    if (!state.projectData) {
      showError(t("llm.openProjectFirst"));
      return;
    }

    if (!elements.llmSettingsDialog) return;

    loadLLMSettings();

    const dialogStatus = elements.llmSettingsDialog.querySelector("#llm-dialog-status");
    if (dialogStatus) {
      const isActive = isLLMServiceActive(state.projectData.llmSettings);
      dialogStatus.className = `llm-dialog-status-indicator ${isActive ? "active" : "inactive"}`;
    }

    elements.llmSettingsDialog.showModal();
  }

  function closeLLMSettings() {
    elements.llmSettingsDialog?.close();
  }

  function switchLLMTab(tabName) {
    if (!tabName || !elements.llmSettingsDialog) return;

    elements.llmSettingsDialog.querySelectorAll(".tab-btn").forEach((btn) => {
      if (btn.dataset.tab === tabName) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    elements.llmSettingsDialog.querySelectorAll(".tab-content").forEach((content) => {
      if (content.id === `${tabName}-tab`) {
        content.classList.add("active");
      } else {
        content.classList.remove("active");
      }
    });
  }

  return {
    updateLLMStatusIndicator,
    loadLLMSettings,
    saveLLMSettings,
    testLLMConnection,
    refreshLLMModels,
    initializeLLMForProject,
    resetLLMSettings,
    openLLMSettings,
    closeLLMSettings,
    switchLLMTab,
  };
}
