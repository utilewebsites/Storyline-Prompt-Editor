/**
 * Help System Module
 * Beheert de help mode en workflow mode functionaliteit
 */

import translations from "../translations.js";
import { WORKFLOW_MODES, STORAGE_KEYS, DEFAULT_WORKFLOW_MODE } from "./constants.js";

let currentLanguage = "nl";
let helpModeActive = false;
let workflowMode = DEFAULT_WORKFLOW_MODE;
const geldigeWorkflowModes = new Set(Object.values(WORKFLOW_MODES));

/**
 * Initialiseer het help-systeem
 */
export function initializeHelpSystem(lang = "nl") {
  currentLanguage = lang;
  
  // Laad opgeslagen voorkeuren
  const opgeslagenMode = localStorage.getItem(STORAGE_KEYS.LAST_WORKFLOW_MODE);
  if (opgeslagenMode && geldigeWorkflowModes.has(opgeslagenMode)) {
    workflowMode = opgeslagenMode;
  } else {
    workflowMode = DEFAULT_WORKFLOW_MODE;
  }

  applyWorkflowMode(workflowMode);

  // Update de dropdown selector ongeacht bron (default óf opslag)
  const workflowModeSelect = document.querySelector("#workflow-mode");
  if (workflowModeSelect) {
    workflowModeSelect.value = workflowMode;
  }
  
  const savedHelpMode = localStorage.getItem("storyline-help-mode");
  if (savedHelpMode === "true") {
    helpModeActive = true;
    applyHelpMode(true);
  }
  
  // Pas help-teksten toe op alle elementen met data-help attributen
  updateHelpTexts();
}

/**
 * Update de taal voor het help-systeem
 */
export function setHelpLanguage(lang) {
  currentLanguage = lang;
  updateHelpTexts();
}

/**
 * Toggle help mode aan/uit
 */
export function toggleHelpMode() {
  helpModeActive = !helpModeActive;
  applyHelpMode(helpModeActive);
  localStorage.setItem("storyline-help-mode", String(helpModeActive));
  
  // Update button text
  const toggleBtn = document.querySelector("#toggle-help");
  if (toggleBtn) {
    const t = translations[currentLanguage];
    toggleBtn.textContent = helpModeActive 
      ? "💡 " + (currentLanguage === "nl" ? "Uitleg verbergen" : "Hide help")
      : "💡 " + (t?.actions?.toggleHelp || "Uitleg tonen");
  }
  
  return helpModeActive;
}

/**
 * Pas help mode visueel toe
 */
function applyHelpMode(active) {
  if (active) {
    document.body.classList.add("help-mode-active");
  } else {
    document.body.classList.remove("help-mode-active");
  }
}

/**
 * Verander workflow mode
 */
export function handleWorkflowModeChange(mode, opties = {}) {
  const { persist = true } = opties;
  if (!geldigeWorkflowModes.has(mode)) {
    mode = DEFAULT_WORKFLOW_MODE;
  }

  workflowMode = mode;
  applyWorkflowMode(mode);

  if (persist) {
    localStorage.setItem(STORAGE_KEYS.LAST_WORKFLOW_MODE, mode);
  }

  const workflowModeSelect = document.querySelector("#workflow-mode");
  if (workflowModeSelect && workflowModeSelect.value !== mode) {
    workflowModeSelect.value = mode;
  }
  
  return workflowMode;
}

/**
 * Pas workflow mode visueel toe
 */
function applyWorkflowMode(mode) {
  document.body.setAttribute("data-workflow-mode", mode);
  
  // Update velden visibility in dialogs
  const aiPromptFields = document.querySelector("#ai-prompt-fields");
  const traditionalFields = document.querySelector("#traditional-video-fields");

  if (mode === WORKFLOW_MODES.AI_PROMPT) {
    if (aiPromptFields) aiPromptFields.classList.remove("hidden");
    if (traditionalFields) traditionalFields.classList.add("hidden");
  } else if (mode === WORKFLOW_MODES.TRADITIONAL_VIDEO) {
    if (aiPromptFields) aiPromptFields.classList.add("hidden");
    if (traditionalFields) traditionalFields.classList.remove("hidden");
  } else if (mode === WORKFLOW_MODES.BOTH) {
    if (aiPromptFields) aiPromptFields.classList.remove("hidden");
    if (traditionalFields) traditionalFields.classList.remove("hidden");
  } else {
    if (aiPromptFields) aiPromptFields.classList.add("hidden");
    if (traditionalFields) traditionalFields.classList.add("hidden");
  }
}

/**
 * Update alle help-teksten op basis van huidige taal
 */
export function updateHelpTexts() {
  const t = translations[currentLanguage];
  if (!t || !t.help) {
    console.warn("Help translations not found for language:", currentLanguage);
    return;
  }
  
  // Zoek alle elementen met data-help attribuut
  const elementsWithHelp = document.querySelectorAll("[data-help]");
  
  elementsWithHelp.forEach((element) => {
    const helpKey = element.getAttribute("data-help");
    const helpText = getNestedTranslation(t, helpKey);
    
    if (helpText) {
      element.setAttribute("data-help-text", helpText);
    } else {
      console.warn("Help text not found for key:", helpKey);
    }
  });
}

/**
 * Haal geneste vertaling op (bijv. "help.toggleHelp")
 */
function getNestedTranslation(obj, path) {
  const parts = path.split(".");
  let value = obj;
  
  for (const part of parts) {
    if (value && typeof value === "object" && part in value) {
      value = value[part];
    } else {
      return null;
    }
  }
  
  return typeof value === "string" ? value : null;
}

/**
 * Get current workflow mode
 */
export function getWorkflowMode() {
  return workflowMode;
}

/**
 * Get current help mode state
 */
export function getHelpMode() {
  return helpModeActive;
}

/**
 * Pas workflow mode toe op een scene dialog
 * (roep dit aan wanneer de dialog wordt geopend)
 */
export function applyWorkflowModeToDialog() {
  const aiPromptFields = document.querySelector("#ai-prompt-fields");
  const traditionalFields = document.querySelector("#traditional-video-fields");
  
  if (workflowMode === WORKFLOW_MODES.AI_PROMPT) {
    if (aiPromptFields) aiPromptFields.classList.remove("hidden");
    if (traditionalFields) traditionalFields.classList.add("hidden");
  } else if (workflowMode === WORKFLOW_MODES.TRADITIONAL_VIDEO) {
    if (aiPromptFields) aiPromptFields.classList.add("hidden");
    if (traditionalFields) traditionalFields.classList.remove("hidden");
  } else if (workflowMode === WORKFLOW_MODES.BOTH) {
    if (aiPromptFields) aiPromptFields.classList.remove("hidden");
    if (traditionalFields) traditionalFields.classList.remove("hidden");
  } else {
    if (aiPromptFields) aiPromptFields.classList.add("hidden");
    if (traditionalFields) traditionalFields.classList.add("hidden");
  }
}

/**
 * Voeg help-tooltip toe aan een dynamisch element
 */
export function addHelpToElement(element, helpKey) {
  const t = translations[currentLanguage];
  const helpText = getNestedTranslation(t, helpKey);
  
  if (helpText) {
    element.setAttribute("data-help", helpKey);
    element.setAttribute("data-help-text", helpText);
  }
}
