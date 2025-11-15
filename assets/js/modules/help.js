/**
 * Help System Module
 * Beheert de help mode en workflow mode functionaliteit
 */

import translations from "../translations.js";

let currentLanguage = "nl";
let helpModeActive = false;
let workflowMode = "ai-prompt"; // "ai-prompt" of "traditional-video"

/**
 * Initialiseer het help-systeem
 */
export function initializeHelpSystem(lang = "nl") {
  currentLanguage = lang;
  
  // Laad opgeslagen voorkeuren
  const savedWorkflowMode = localStorage.getItem("storyline-workflow-mode");
  if (savedWorkflowMode) {
    workflowMode = savedWorkflowMode;
    applyWorkflowMode(workflowMode);
    
    // Update de dropdown selector
    const workflowModeSelect = document.querySelector("#workflow-mode");
    if (workflowModeSelect) {
      workflowModeSelect.value = savedWorkflowMode;
    }
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
export function handleWorkflowModeChange(mode) {
  workflowMode = mode;
  applyWorkflowMode(mode);
  localStorage.setItem("storyline-workflow-mode", mode);
  
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
  
  if (mode === "ai-prompt") {
    // Alleen AI prompt velden tonen
    if (aiPromptFields) aiPromptFields.classList.remove("hidden");
    if (traditionalFields) traditionalFields.classList.add("hidden");
  } else if (mode === "traditional-video") {
    // Alleen traditionele velden tonen
    if (aiPromptFields) aiPromptFields.classList.add("hidden");
    if (traditionalFields) traditionalFields.classList.remove("hidden");
  } else if (mode === "both") {
    // Beide tonen
    if (aiPromptFields) aiPromptFields.classList.remove("hidden");
    if (traditionalFields) traditionalFields.classList.remove("hidden");
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
  
  if (workflowMode === "ai-prompt") {
    // Alleen AI prompt velden tonen
    if (aiPromptFields) aiPromptFields.classList.remove("hidden");
    if (traditionalFields) traditionalFields.classList.add("hidden");
  } else if (workflowMode === "traditional-video") {
    // Alleen traditionele velden tonen
    if (aiPromptFields) aiPromptFields.classList.add("hidden");
    if (traditionalFields) traditionalFields.classList.remove("hidden");
  } else if (workflowMode === "both") {
    // Beide tonen
    if (aiPromptFields) aiPromptFields.classList.remove("hidden");
    if (traditionalFields) traditionalFields.classList.remove("hidden");
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
