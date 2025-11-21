/**
 * modules/ai-prompt.js
 *
 * Beheert alle UI-functionaliteit rond de AI Prompt Generator dialoog zodat
 * app.js enkel de event wiring verzorgt. Alle afhankelijke referenties worden
 * via dependency injection doorgegeven voor betere testbaarheid.
 */

import { t } from "./i18n.js";
import { showError, showSuccess } from "./dialogs.js";
import { generateAIPromptWithStatus, isLLMServiceActive } from "./llm-service.js";

/**
 * Maak een controller die AI prompt acties orchestreert.
 *
 * @param {Object} options
 * @param {Object} options.state - Centrale applicatiestate
 * @param {Object} options.elements - Verzameling DOM elementen
 * @param {Object} options.localState - Lokale UI state (dialoogcontext)
 * @param {Function} options.renderProjectEditor - Callback om de UI te hertekenen
 * @returns {Object} Publieke helpers
 */
export function createAIPromptController({ state, elements, localState, renderProjectEditor }) {
  const MIN_DURATION = 3;
  const MAX_DURATION = 120;
  const DEFAULT_DURATION = 5;
  const OVI_DURATION = 10;
  const MODE_TYPES = {
    WAN_SINGLE: "wan-single",
    WAN_SEQUENCE: "wan-sequence",
    WAN_CAMERA: "wan-camera",
    OVI_10S: "ovi-10s",
  };
  const PLACEHOLDER_KEYS = {
    [MODE_TYPES.WAN_SINGLE]: "extraPlaceholderWanSingle",
    [MODE_TYPES.WAN_SEQUENCE]: "extraPlaceholderWanSequence",
    [MODE_TYPES.WAN_CAMERA]: "extraPlaceholderWanCamera",
    [MODE_TYPES.OVI_10S]: "extraPlaceholderOvi",
  };
  let modeDetailsExpanded = Boolean(localState.aiPromptDetailsExpanded);

  function isSequenceMode(mode) {
    return mode === MODE_TYPES.WAN_SEQUENCE || mode === "sequence";
  }

  function isOviMode(mode) {
    return mode === MODE_TYPES.OVI_10S;
  }

  function mapToLegacyMode(mode) {
    return isSequenceMode(mode) ? "sequence" : "single";
  }

  function clampDuration(value) {
    if (value === null || value === undefined || value === "") {
      return DEFAULT_DURATION;
    }
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return DEFAULT_DURATION;
    }
    const rounded = Math.round(parsed);
    return Math.min(MAX_DURATION, Math.max(MIN_DURATION, rounded));
  }

  function setDurationInputValue(value) {
    if (!elements.aiPromptDuration) return;
    const safeValue = clampDuration(value);
    elements.aiPromptDuration.value = safeValue;
  }

  function getDurationInputValue() {
    if (!elements.aiPromptDuration) {
      return DEFAULT_DURATION;
    }
    return clampDuration(elements.aiPromptDuration.value);
  }

  function renderAIPromptButton(sceneIndex) {
    const button = document.createElement("button");
    button.className = "ai-prompt-button";
    button.title = `AI Prompt voor Scene ${sceneIndex + 1} → Scene ${sceneIndex + 2}`;

    const statusClass = isLLMServiceActive(state.projectData?.llmSettings) ? "active" : "inactive";
    button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
      <span class="ai-status-indicator ${statusClass}"></span>
    `;

    button.addEventListener("click", () => openAIPromptDialog(sceneIndex));
    return button;
  }

  async function openAIPromptDialog(sceneIndex) {
    if (!state.projectData) return;

    if (!isLLMServiceActive(state.projectData.llmSettings)) {
      showError(t("aiPrompt.errorNoLLMService"));
      return;
    }

    localState.aiPromptContext = { sceneIndex, mode: MODE_TYPES.WAN_SINGLE };
    setModeDetailsExpanded(false);

    handleAIPromptModeChange(MODE_TYPES.WAN_SINGLE);
    if (elements.aiPromptTranslationLang) elements.aiPromptTranslationLang.value = "nl";
    if (elements.aiPromptExtraInstructions) elements.aiPromptExtraInstructions.value = "";
    setDurationInputValue(DEFAULT_DURATION);
    if (elements.aiPromptResult) elements.aiPromptResult.style.display = "none";
    if (elements.aiResultPlaceholder) {
      elements.aiResultPlaceholder.style.display = "block";
      elements.aiResultPlaceholder.classList.remove("generating");
    }

    if (elements.aiPromptStatus) elements.aiPromptStatus.style.display = "none";

    await loadAIPromptImages(sceneIndex);
    elements.aiPromptDialog?.showModal();
  }

  function closeAIPromptDialog() {
    elements.aiPromptDialog?.close();
    localState.aiPromptContext = null;

    if (elements.aiPromptImage1) elements.aiPromptImage1.innerHTML = "";
    if (elements.aiPromptImage2) elements.aiPromptImage2.innerHTML = "";
  }

  async function loadAIPromptImages(sceneIndex) {
    const prompts = state.projectData?.prompts;
    if (!prompts || !state.projectImagesHandle || sceneIndex >= prompts.length) {
      return;
    }

    updateSceneNumbers(sceneIndex);
    await renderSceneImage(prompts[sceneIndex], elements.aiPromptImage1, sceneIndex + 1);

    if (sceneIndex < prompts.length - 1) {
      await renderSceneImage(prompts[sceneIndex + 1], elements.aiPromptImage2, sceneIndex + 2);
    } else if (elements.aiPromptImage2) {
      elements.aiPromptImage2.innerHTML = "";
    }
  }

  function updateSceneNumbers(sceneIndex) {
    const scene1Number = document.getElementById("ai-prompt-scene-1-number");
    const scene2Number = document.getElementById("ai-prompt-scene-2-number");
    if (scene1Number) scene1Number.textContent = sceneIndex + 1;
    if (scene2Number) scene2Number.textContent = sceneIndex + 2;
  }

  async function renderSceneImage(prompt, container, sceneNumber) {
    if (!container) return;
    container.innerHTML = "";

    if (!prompt?.imagePath) {
      container.innerHTML = `<div class="no-image">📷<br>${t("aiPrompt.noImage")}</div>`;
      return;
    }

    try {
      const fileHandle = await state.projectImagesHandle.getFileHandle(prompt.imagePath);
      const file = await fileHandle.getFile();
      const url = URL.createObjectURL(file);

      const img = document.createElement("img");
      img.src = url;
      img.alt = `Scene ${sceneNumber}`;
      container.appendChild(img);
    } catch (error) {
      console.error("Afbeelding laden mislukt:", error);
      container.innerHTML = `<div class="no-image">📷<br>${t("aiPrompt.noImage")}</div>`;
    }
  }

  function handleAIPromptModeChange(mode) {
    if (!localState.aiPromptContext) return;
    localState.aiPromptContext.mode = mode;

    const image2Container = elements.aiPromptImage2?.closest?.(".image-preview-container");
    const modeButtons = [elements.aiModeSingle, elements.aiModeSequence, elements.aiModeCamera, elements.aiModeOvi];

    modeButtons.forEach((btn) => btn?.classList.remove("active"));
    const activeButton = modeButtons.find((btn) => btn?.dataset?.mode === mode);
    if (activeButton) activeButton.classList.add("active");

    if (image2Container) {
      image2Container.style.display = isSequenceMode(mode) ? "block" : "none";
    }

    if (elements.aiPromptFrame1Label) {
      elements.aiPromptFrame1Label.style.display = "block";
    }

    const helpKey = activeButton?.dataset?.helpKey;
    const detailKey = activeButton?.dataset?.detailKey;
    updateModeHelpText(helpKey, detailKey);
    updateExtraInstructionsPlaceholder(mode);
    updateQuickInsertVisibility(mode);
    setModeDetailsExpanded(false);

    if (isSequenceMode(mode)) {
      if (elements.aiPromptDuration && !elements.aiPromptDuration.disabled) {
        setDurationInputValue(DEFAULT_DURATION);
      }
    } else if (isOviMode(mode)) {
      setDurationInputValue(OVI_DURATION);
      if (elements.aiPromptDuration) {
        elements.aiPromptDuration.disabled = true;
      }
    } else {
      setDurationInputValue(DEFAULT_DURATION);
      if (elements.aiPromptDuration) {
        elements.aiPromptDuration.disabled = false;
      }
    }
  }

  function toggleQuickGroup(groupElement, isVisible) {
    if (!groupElement) return;
    groupElement.hidden = !isVisible;
    groupElement.style.display = isVisible ? "" : "none";
  }

  function updateQuickInsertVisibility(mode) {
    const showCamera = mode === MODE_TYPES.WAN_CAMERA;
    const showOvi = isOviMode(mode);
    toggleQuickGroup(elements.aiQuickCameraGroup, showCamera);
    toggleQuickGroup(elements.aiQuickOviGroup, showOvi);
    if (elements.aiQuickInsertContainer) {
      const shouldShow = showCamera || showOvi;
      elements.aiQuickInsertContainer.hidden = !shouldShow;
      elements.aiQuickInsertContainer.style.display = shouldShow ? "block" : "none";
    }
  }

  function updateModeHelpText(helpKey, detailKey) {
    if (!elements.aiModeHelpText) return;
    const key = helpKey || "modeHelpDefault";
    elements.aiModeHelpText.textContent = t(`aiPrompt.${key}`);
    updateModeDetail(detailKey);
  }

  function updateModeDetail(detailKey) {
    if (!elements.aiModeHelpDetails) return;
    const key = detailKey || "modeDetailDefault";
    const content = t(`aiPrompt.${key}`);
    elements.aiModeHelpDetails.innerHTML = typeof content === "string" ? content.trim() : "";
    if (elements.aiModeHelpToggle) {
      elements.aiModeHelpToggle.disabled = !content;
    }
  }

  function setModeDetailsExpanded(expanded) {
    modeDetailsExpanded = expanded;
    localState.aiPromptDetailsExpanded = expanded;
    if (elements.aiModeHelpDetails) {
      if (expanded) {
        elements.aiModeHelpDetails.hidden = false;
      } else {
        elements.aiModeHelpDetails.hidden = true;
      }
    }
    if (elements.aiModeHelpToggle) {
      elements.aiModeHelpToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    }
  }

  function toggleModeDetails() {
    if (elements.aiModeHelpToggle?.disabled) return;
    setModeDetailsExpanded(!modeDetailsExpanded);
  }

  function getPlaceholderKeyForMode(mode) {
    return PLACEHOLDER_KEYS[mode] || PLACEHOLDER_KEYS[MODE_TYPES.WAN_SINGLE];
  }

  function updateExtraInstructionsPlaceholder(mode) {
    if (!elements.aiPromptExtraInstructions) return;
    const key = getPlaceholderKeyForMode(mode);
    elements.aiPromptExtraInstructions.setAttribute("placeholder", t(`aiPrompt.${key}`));
  }

  function refreshExtraInstructionsPlaceholder() {
    const currentMode = localState.aiPromptContext?.mode || MODE_TYPES.WAN_SINGLE;
    updateExtraInstructionsPlaceholder(currentMode);
    updateQuickInsertVisibility(currentMode);
  }

  function insertQuickTemplate(templateKey) {
    if (!templateKey || !elements.aiPromptExtraInstructions) return;
    const template = t(`aiPrompt.${templateKey}`);
    if (!template || typeof template !== "string") return;
    const sanitized = template.trim();
    if (!sanitized) return;

    const textarea = elements.aiPromptExtraInstructions;
    const value = textarea.value || "";
    const start = typeof textarea.selectionStart === "number" ? textarea.selectionStart : value.length;
    const end = typeof textarea.selectionEnd === "number" ? textarea.selectionEnd : start;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const prefix = before && !before.endsWith("\n") ? "\n" : "";
    const suffix = !after || !after.startsWith("\n") ? "\n" : "";
    const insertion = `${prefix}${sanitized}${suffix}`;
    textarea.value = `${before}${insertion}${after}`;
    const cursor = before.length + insertion.length;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  function toggleReasoningDisplay() {
    const toggleBtn = elements.aiPromptToggleReasoning;
    if (!toggleBtn || !elements.aiPromptReasoning) return;

    const textNode = toggleBtn.querySelector("[data-i18n]");
    const icon = toggleBtn.querySelector(".toggle-icon");
    const isExpanded = toggleBtn.classList.contains("expanded");

    if (isExpanded) {
      elements.aiPromptReasoning.style.display = "none";
      toggleBtn.classList.remove("expanded");
      if (icon) icon.textContent = "▶";
      if (textNode) textNode.textContent = t("aiPrompt.showReasoning");
    } else {
      elements.aiPromptReasoning.style.display = "block";
      toggleBtn.classList.add("expanded");
      if (icon) icon.textContent = "▼";
      if (textNode) textNode.textContent = t("aiPrompt.hideReasoning");
    }
  }

  async function generateAIPrompt() {
    if (!localState.aiPromptContext || !state.projectData) return;
    const { sceneIndex, mode } = localState.aiPromptContext;
    const legacyMode = mapToLegacyMode(mode);
    const llmSettings = state.projectData.llmSettings;

    if (!isLLMServiceActive(llmSettings)) {
      showError(t("aiPrompt.errorNoLLMService"));
      return;
    }

    const extraInstructions = elements.aiPromptExtraInstructions?.value.trim() ?? "";
    if (!extraInstructions) {
      showError(t("aiPrompt.errorNoInstructions"));
      return;
    }

    let durationSeconds = getDurationInputValue();
    if (isOviMode(mode)) {
      durationSeconds = OVI_DURATION;
      setDurationInputValue(OVI_DURATION);
    } else {
      setDurationInputValue(durationSeconds);
    }

    setLoadingState(true);

    try {
      const result = await generateAIPromptWithStatus({
        mode: legacyMode,
        modeType: mode,
        sceneIndex,
        prompts: state.projectData.prompts,
        llmSettings,
        imagesHandle: state.projectImagesHandle,
        extraInstructions,
        durationSeconds,
        translationLang: elements.aiPromptTranslationLang?.value,
        onStatus: (statusText) => {
          if (elements.aiPromptStatusText) {
            elements.aiPromptStatusText.textContent = statusText;
          }
        }
      });

      if (elements.aiPromptStatusText) {
        elements.aiPromptStatusText.textContent = "✅ Klaar!";
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (elements.aiPromptStatus) elements.aiPromptStatus.style.display = "none";

      updatePromptResultUI(result, legacyMode);
    } catch (error) {
      handleAIPromptError(error);
    } finally {
      setLoadingState(false);
    }
  }

  function setLoadingState(isLoading) {
    if (elements.aiPromptGenerate) {
      elements.aiPromptGenerate.disabled = isLoading;
      elements.aiPromptGenerate.textContent = isLoading
        ? t("aiPrompt.generating")
        : t("aiPrompt.generate");
    }

    if (elements.aiPromptDuration) {
      const isOvi = isOviMode(localState.aiPromptContext?.mode);
      elements.aiPromptDuration.disabled = isLoading || isOvi;
    }

    if (!elements.aiPromptStatus || !elements.aiResultPlaceholder) return;

    if (isLoading) {
      elements.aiPromptStatus.style.display = "flex";
      elements.aiPromptResult?.setAttribute("style", "display: none;");
      elements.aiResultPlaceholder.style.display = "block";
      elements.aiResultPlaceholder.classList.add("generating");
    } else {
      elements.aiResultPlaceholder.classList.remove("generating");
    }
  }

  function updatePromptResultUI(result, mode) {
    if (!elements.aiPromptResult || !elements.aiPromptResultEn) return;

    elements.aiPromptResultEn.textContent = result.prompt;
    localState.aiPromptContext.reasoning = result.reasoning;

    const isSequence = isSequenceMode(mode);

    if (!isSequence) {
      localState.aiPromptContext.imageAnalysis = result.imageAnalysis;
    } else {
      localState.aiPromptContext.imageAnalysis1 = result.imageAnalysis1;
      localState.aiPromptContext.imageAnalysis2 = result.imageAnalysis2;
    }

    const reasoningText = !isSequence
      ? `=== IMAGE ANALYSE ===\n${result.imageAnalysis}\n\n=== VOLLEDIGE LLM RESPONSE ===\n${result.reasoning}`
      : `=== IMAGE ANALYSE 1 ===\n${result.imageAnalysis1}\n\n=== IMAGE ANALYSE 2 ===\n${result.imageAnalysis2}\n\n=== VOLLEDIGE LLM RESPONSE ===\n${result.reasoning}`;

    if (elements.aiPromptReasoningText) {
      elements.aiPromptReasoningText.textContent = reasoningText;
    }

    resetReasoningToggle();
    updateTranslationResult(result.translation);

    elements.aiPromptResult.style.display = "block";
    if (elements.aiResultPlaceholder) elements.aiResultPlaceholder.style.display = "none";
  }

  function resetReasoningToggle() {
    const toggleBtn = elements.aiPromptToggleReasoning;
    if (!toggleBtn || !elements.aiPromptReasoning) return;

    elements.aiPromptReasoning.style.display = "none";
    toggleBtn.classList.remove("expanded");

    const icon = toggleBtn.querySelector(".toggle-icon");
    const textNode = toggleBtn.querySelector("[data-i18n]");
    if (icon) icon.textContent = "▶";
    if (textNode) textNode.textContent = t("aiPrompt.showReasoning");
  }

  function updateTranslationResult(translation) {
    const translationWrapper = elements.aiPromptResultTranslation?.parentElement;
    if (!translationWrapper || !elements.aiPromptResultTranslation) return;

    if (translation) {
      translationWrapper.style.display = "block";
      elements.aiPromptResultTranslation.textContent = translation;
    } else {
      translationWrapper.style.display = "none";
      elements.aiPromptResultTranslation.textContent = "";
    }
  }

  function handleAIPromptError(error) {
    console.error("AI prompt generatie mislukt:", error);

    if (error === "NO_IMAGE") {
      showError(t("aiPrompt.errorNoImage"));
    } else if (error === "NO_IMAGES") {
      showError(t("aiPrompt.errorNoImages"));
    } else {
      showError(t("aiPrompt.errorGeneration"), error);
    }

    if (elements.aiPromptStatus) elements.aiPromptStatus.style.display = "none";
    if (elements.aiResultPlaceholder) elements.aiResultPlaceholder.style.display = "block";
  }

  function useGeneratedPrompts() {
    if (!localState.aiPromptContext || !state.projectData) return;

    const { sceneIndex, mode } = localState.aiPromptContext;
    const prompts = state.projectData.prompts;
    const englishPrompt = elements.aiPromptResultEn?.textContent ?? "";
    const translationText = elements.aiPromptResultTranslation?.textContent ?? "";
    const translationLang = elements.aiPromptTranslationLang?.value;

    if (!englishPrompt) return;

    const isSequence = isSequenceMode(mode);

    if (!isSequence) {
      prompts[sceneIndex].text = englishPrompt;
      if (translationLang && translationText) {
        prompts[sceneIndex].translation = translationText;
      }
    } else {
      const englishParts = splitPromptByScene(englishPrompt);
      if (englishParts.length >= 2) {
        prompts[sceneIndex].text = englishParts[0];
        prompts[sceneIndex + 1].text = englishParts[1];
      } else {
        prompts[sceneIndex].text = englishPrompt;
      }

      if (translationLang && translationText) {
        const translationParts = splitPromptByScene(translationText);
        if (translationParts.length >= 2) {
          prompts[sceneIndex].translation = translationParts[0];
          prompts[sceneIndex + 1].translation = translationParts[1];
        } else {
          prompts[sceneIndex].translation = translationText;
        }
      }
    }

    state.isDirty = true;
    renderProjectEditor();
    closeAIPromptDialog();
    showSuccess(t("aiPrompt.successApplied"));
  }

  function splitPromptByScene(text) {
    return text
      .split(/Scene \d+:|Prompt \d+:|\d+\./i)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return {
    renderAIPromptButton,
    openAIPromptDialog,
    closeAIPromptDialog,
    handleAIPromptModeChange,
    toggleReasoningDisplay,
    toggleModeDetails,
    refreshExtraInstructionsPlaceholder,
    generateAIPrompt,
    useGeneratedPrompts,
    insertQuickTemplate,
  };
}
