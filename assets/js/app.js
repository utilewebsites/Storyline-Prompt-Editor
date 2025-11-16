/* eslint-disable no-await-in-loop */

// ============================================================================
// DEBUG LOGGING
// ============================================================================
// Om debug logging aan te zetten naar bestand (/jouw-projectmap/log/debug.log):
// 1. Uncomment de regel hieronder (verwijder de //)
// 2. Refresh de pagina
// 3. Kies een projectmap (of laad een project)
// 4. Check het bestand: /jouw-projectmap/log/debug.log
// ============================================================================
// import { initLogger, log, logSection } from "./modules/logger.js";
// ============================================================================

import translations from "./translations.js";
import { uuid, slugify, formatDateTime, readJsonFile, writeJsonFile, writeTextFile } from "./modules/utils.js";
import { addPrompt, deletePrompt, movePrompt, assignImageToPrompt, assignVideoToPrompt, removeImageFromPrompt, removeVideoFromPrompt } from "./modules/scenes.js";
import { updatePresentationSlide, updateVideoPresentationSlide, nextSlide, prevSlide, setPresentationLanguage, setPresentationWorkflowMode, closePresentationMode, initializeCombinedVideoPresentation, updateCombinedVideoPresentation, seekCombinedVideoTimeline, renderPresentationWaveform, renderPresentationMarkers, renderMarkerButtons, setupPresentationAudioPlayer, initializeAudioPresentation } from "./modules/presentation.js";
import { initializeHelpSystem, setHelpLanguage, toggleHelpMode, handleWorkflowModeChange, applyWorkflowModeToDialog, getWorkflowMode, updateHelpTexts } from "./modules/help.js";
import { initializeAudioTimeline, generateScenesFromAudio, resetAudioTimeline, getAudioTimelineData, restoreAudioTimelineData, setAudioProjectHandle, loadAudioFromProject, hasAudioTimeline, setSceneCallbacks, redrawWaveform, refreshMarkersDisplay, waitAndShowMarkers, removeMarkerByIndex, updateAudioMarkerTime } from "./modules/audio-timeline.js";
import { initializeAttachments, clearAttachmentCache } from "./modules/attachments.js";
import { renderTransitionButton, showTransitionDialog, cleanupTransitions, reindexTransitions } from "./modules/transitions.js";
import { initializeAudioVideoEditor, openEditor as openAudioVideoEditor, resetAudioVideoEditor } from "./modules/audio-video-editor.js";
// import { initLogger, log, logSection } from "./modules/logger.js"; // DEBUG: Uncomment om logging aan te zetten

/**
 * Storyline Prompt Editor
 * In dit script regelen we het complete beheer van storylineprojecten:
 * - Structuur opzetten in de gekozen map
 * - Projecten laden, aanmaken, updaten en exporteren
 * - Promptvelden beheren inclusief afbeeldingen en video's
 * - Presentatiemodus met video-afspeeling
 * - Audio timeline mode voor automatische scene generatie
 * 
 * ARCHITECTUUR:
 * - app.js: initialisatie, state management, event wiring
 * - modules/utils.js: hulpfuncties
 * - modules/scenes.js: scene/prompt management
 * - modules/presentation.js: presentatiemodus
 * - index.html: UI markup
 * - assets/css/style.css: styling
 *
 * Alle comments zijn bewust in het Nederlands zodat het team snel begrijpt
 * waarom bepaalde keuzes zijn gemaakt.
 */

const elements = {
  chooseRoot: document.querySelector("#choose-root"),
  languageSwitch: document.querySelector("#language-switch"),
  workflowMode: document.querySelector("#workflow-mode"),
  toggleHelp: document.querySelector("#toggle-help"),
  headerTitle: document.querySelector("#header-title"),
  headerSubtitle: document.querySelector("#header-subtitle"),
  rootPath: document.querySelector("#root-path"),
  projectForm: document.querySelector("#project-form"),
  projectName: document.querySelector("#project-name"),
  projectGenerator: document.querySelector("#project-generator"),
  projectNotes: document.querySelector("#project-notes"),
  createProjectBtn: document.querySelector("#create-project"),
  sortProjects: document.querySelector("#sort-projects"),
  refreshProjects: document.querySelector("#refresh-projects"),
  projectList: document.querySelector("#project-list"),
  noProjects: document.querySelector("#no-projects"),
  projectEmptyState: document.querySelector("#project-empty-state"),
  projectEditor: document.querySelector("#project-editor"),
  emptyTitle: document.querySelector("#empty-title"),
  emptyDescription: document.querySelector("#empty-description"),
  projectTitle: document.querySelector("#project-title"),
  projectMeta: document.querySelector("#project-meta"),
  editGenerator: document.querySelector("#edit-generator"),
  editNotes: document.querySelector("#edit-notes"),
  addPrompt: document.querySelector("#add-prompt"),
  showAllImages: document.querySelector("#show-all-images"),
  showAllVideos: document.querySelector("#show-all-videos"),
  promptsContainer: document.querySelector("#prompts-container"),
  promptsHelp: document.querySelector("#prompts-help"),
  saveProject: document.querySelector("#save-project"),
  exportPrompts: document.querySelector("#export-prompts"),
  exportPromptsDropdown: document.querySelector("#export-prompts-dropdown"),
  exportChoiceDialog: document.querySelector("#export-choice-dialog"),
  exportChoicePrompts: document.querySelector("#export-choice-prompts"),
  exportChoiceNotes: document.querySelector("#export-choice-notes"),
  exportImages: document.querySelector("#export-images"),
  exportDialog: document.querySelector("#export-dialog"),
  exportPreviewDialog: document.querySelector("#export-preview-dialog"),
  exportPreviewText: document.querySelector("#export-preview-text"),
  exportPreviewCopy: document.querySelector("#export-preview-copy"),
  exportPreviewInfo: document.querySelector("#export-preview-info"),
  errorDialog: document.querySelector("#error-dialog"),
  errorMessage: document.querySelector("#error-message"),
  successDialog: document.querySelector("#success-dialog"),
  successTitle: document.querySelector("#success-title"),
  successMessage: document.querySelector("#success-message"),
  promptTemplate: document.querySelector("#prompt-template"),
  promptDialog: document.querySelector("#prompt-dialog"),
  dialogSceneIndex: document.querySelector("#dialog-scene-index"),
  dialogPrevScene: document.querySelector("#dialog-prev-scene"),
  dialogNextScene: document.querySelector("#dialog-next-scene"),
  dialogText: document.querySelector("#dialog-text"),
  dialogTranslation: document.querySelector("#dialog-translation"),
  dialogWhatSee: document.querySelector("#dialog-what-see"),
  dialogHowMake: document.querySelector("#dialog-how-make"),
  dialogTimeline: document.querySelector("#dialog-timeline"),
  dialogDuration: document.querySelector("#dialog-duration"),
  traditionalVideoFields: document.querySelector("#traditional-video-fields"),
  dialogImage: document.querySelector("#dialog-image"),
  dialogImagePlaceholder: document.querySelector("#dialog-image-placeholder"),
  dialogImageWrapper: document.querySelector(".dialog-image-preview"),
  dialogVideo: document.querySelector("#dialog-video"),
  dialogVideoPlaceholder: document.querySelector("#dialog-video-placeholder"),
  dialogVideoWrapper: document.querySelector(".dialog-video-preview"),
  dialogOpenImage: document.querySelector("#dialog-open-image"),
  dialogSave: document.querySelector("#dialog-save"),
  duplicateProject: document.querySelector("#duplicate-project"),
  copyDialog: document.querySelector("#copy-dialog"),
  copyTargetSelect: document.querySelector("#copy-target-select"),
  copyConfirm: document.querySelector("#copy-confirm"),
  copyCancel: document.querySelector("#copy-cancel"),
  copyDuplicate: document.querySelector("#copy-duplicate"),
  dialogRating: document.querySelector("#dialog-rating"),
  startPresentation: document.querySelector("#start-presentation"),
  presentationDialog: document.querySelector("#presentation-dialog"),
  presentationLanguage: document.querySelector("#presentation-language"),
  presentationWorkflow: document.querySelector("#presentation-workflow"),
  presentationMode: document.querySelector("#presentation-mode"),
  presentationProjectName: document.querySelector("#presentation-project-name"),
  presentationSlideCounter: document.querySelector("#presentation-slide-counter"),
  presentationImage: document.querySelector("#presentation-image"),
  presentationVideo: document.querySelector("#presentation-video"),
  presentationNoImage: document.querySelector("#presentation-no-image"),
  presentationNoVideo: document.querySelector("#presentation-no-video"),
  presentationAudio: document.querySelector("#presentation-audio"),
  presentationAudioTimelineContainer: document.querySelector("#presentation-audio-timeline-container"),
  audioTimelineSlider: document.querySelector("#audio-timeline-slider"),
  audioTimelineMarkers: document.querySelector("#audio-timeline-markers"),
  videoTimelineContainer: document.querySelector("#video-timeline-container"),
  videoTimelineSlider: document.querySelector("#video-timeline-slider"),
  videoTimelineMarkers: document.querySelector("#video-timeline-markers"),
  presentationAiFields: document.querySelector("#presentation-ai-fields"),
  presentationTraditionalFields: document.querySelector("#presentation-traditional-fields"),
  presentationTextEn: document.querySelector("#presentation-text-en"),
  presentationTextNl: document.querySelector("#presentation-text-nl"),
  presentationPromptEn: document.querySelector("#presentation-prompt-en"),
  presentationPromptNl: document.querySelector("#presentation-prompt-nl"),
  presentationWhatSee: document.querySelector("#presentation-what-see"),
  presentationHowMake: document.querySelector("#presentation-how-make"),
  presentationTimeline: document.querySelector("#presentation-timeline"),
  presentationPrev: document.querySelector("#presentation-prev"),
  presentationNext: document.querySelector("#presentation-next"),
  presentationProgressBar: document.querySelector("#presentation-progress-bar"),
  presentationClose: document.querySelector("#presentation-close"),
  deleteProject: document.querySelector("#delete-project"),
  deleteProjectDialog: document.querySelector("#delete-project-dialog"),
  deleteConfirm: document.querySelector("#delete-confirm"),
  deleteCancel: document.querySelector("#delete-cancel"),
  copyProjectDialog: document.querySelector("#copy-project-dialog"),
  copyProjectName: document.querySelector("#copy-project-name"),
  copyProjectConfirm: document.querySelector("#copy-project-confirm"),
  copyProjectCancel: document.querySelector("#copy-project-cancel"),
  imagesExportedDialog: document.querySelector("#images-exported-dialog"),
  imagesExportedMessage: document.querySelector("#images-exported-message"),
  imagesExportedPath: document.querySelector("#images-exported-path"),
  imagesExportedCopy: document.querySelector("#images-exported-copy"),
  imagesExportedClose: document.querySelector("#images-exported-close"),
};

const state = {
  rootHandle: null,
  projectenHandle: null,
  indexHandle: null,
  indexData: { version: 1, projects: [] },
  selectedProjectId: null,
  projectHandle: null,
  projectDirHandle: null, // ⭐ NIEUW: handle naar project directory (niet file)
  projectImagesHandle: null,
  projectVideosHandle: null, // ⭐ NIEUW: handle naar videos/ folder in project
  projectAttachmentsHandle: null, // ⭐ NIEUW: handle naar attachments/ folder
  projectData: null,
  isDirty: false,
  sortOrder: "updated",
  dialogPromptId: null,
  draggedPromptId: null,
  dialogImageUrl: null,
  pendingExportText: null,
  currentMediaViewMode: null, // ⭐ NIEUW: track huidige media view mode ('images', 'videos', of null)
  pendingExportCount: 0,
  copyingPromptId: null,
  presentationMode: {
    currentSlide: 0,
    languageMode: "both", // "prompts", "notes", "both"
    workflowMode: "both", // ⭐ NIEUW: "ai-prompt", "traditional", "both"
    videoMode: false, // ⭐ true = video presentation, false = image/text
    videoTimeline: null, // ⭐ NIEUW: Timeline data voor gecombineerde video's
  },
};

let currentLanguage = "nl";

/**
 * Taalondersteuning: oplossen, interpoleren en toepassen van vertalingen.
 */
function resolveTranslation(lang, key) {
  const parts = key.split(".");
  let value = translations[lang];
  for (const part of parts) {
    value = value?.[part];
    if (value === undefined) break;
  }
  return value;
}

function interpolate(value, vars) {
  return value.replace(/\{\{(\w+)\}\}/g, (match, token) => {
    if (Object.prototype.hasOwnProperty.call(vars, token)) {
      return String(vars[token]);
    }
    return match;
  });
}

function t(key, vars = {}) {
  let value = resolveTranslation(currentLanguage, key);
  if (value === undefined) {
    value = resolveTranslation("nl", key);
  }
  if (typeof value === "string") {
    return Object.keys(vars).length ? interpolate(value, vars) : value;
  }
  return key;
}

function applyTranslations(root = document) {
  if (!root) return;
  root.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.dataset.i18n;
    if (!key) return;
    const text = t(key);
    if (node.tagName === "INPUT" || node.tagName === "TEXTAREA") {
      node.value = text;
    } else {
      node.textContent = text;
    }
  });

  root.querySelectorAll("[data-i18n-attr-title]").forEach((node) => {
    const key = node.dataset.i18nAttrTitle;
    if (key) node.setAttribute("title", t(key));
  });

  root.querySelectorAll("[data-i18n-attr-aria-label]").forEach((node) => {
    const key = node.dataset.i18nAttrAriaLabel;
    if (key) node.setAttribute("aria-label", t(key));
  });

  root.querySelectorAll("[data-i18n-attr-placeholder]").forEach((node) => {
    const key = node.dataset.i18nAttrPlaceholder;
    if (key) node.setAttribute("placeholder", t(key));
  });
}

function setLanguage(lang, { reRender = true } = {}) {
  currentLanguage = translations[lang] ? lang : "nl";
  if (elements.languageSwitch && elements.languageSwitch.value !== currentLanguage) {
    elements.languageSwitch.value = currentLanguage;
  }
  applyTranslations();
  setHelpLanguage(currentLanguage); // Update help system language
  updateExportPreviewInfo();
  if (reRender) {
    renderProjectList();
    renderProjectEditor();
  } else {
    refreshProjectMetaDisplay();
  }
}

const settingsDbName = "storyline-prompt-editor";
const settingsStoreName = "settings";
let settingsDbPromise = null;

function openSettingsDB() {
  if (!("indexedDB" in window)) {
    return Promise.reject(new Error("indexedDB niet beschikbaar"));
  }
  if (!settingsDbPromise) {
    settingsDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(settingsDbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(settingsStoreName)) {
          db.createObjectStore(settingsStoreName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return settingsDbPromise;
}

async function saveLastRootHandle(handle) {
  try {
    const db = await openSettingsDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(settingsStoreName, "readwrite");
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.objectStore(settingsStoreName).put(handle, "lastRoot");
    });
  } catch (error) {
    console.warn("Laatste projectmap opslaan mislukt", error);
  }
}

async function loadLastRootHandle() {
  try {
    const db = await openSettingsDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(settingsStoreName, "readonly");
      tx.oncomplete = () => {};
      tx.onerror = () => reject(tx.error);
      const request = tx.objectStore(settingsStoreName).get("lastRoot");
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Laatste projectmap laden mislukt", error);
    return null;
  }
}

async function clearLastRootHandle() {
  try {
    const db = await openSettingsDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(settingsStoreName, "readwrite");
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.objectStore(settingsStoreName).delete("lastRoot");
    });
  } catch (error) {
    console.warn("Laatste projectmap verwijderen mislukt", error);
  }
}

/**
 * Helpers voor datumweergave en bestands-IO
 */
async function getCurrentProjectDir() {
  if (!state.projectenHandle || !state.projectData) {
    throw new Error("Geen actief project");
  }
  const entry = state.indexData.projects.find((project) => project.id === state.projectData.id);
  if (!entry) {
    throw new Error("Project niet gevonden in index");
  }
  return state.projectenHandle.getDirectoryHandle(entry.slug, { create: false });
}

// formatDateTime is nu geïmporteerd uit modules/utils.js (regel 4)

// uuid en slugify zijn nu geïmporteerd uit modules/utils.js
// formatDateTime wordt nog hier gebruikt voor lokale referentie (backward compat)

/**
 * Cache van prompt-ID naar afbeeldingmetadata
 * Gebruikt voor snelle lookup bij rendering
 */
const imageMap = new Map();

/**
 * Cache van prompt-ID naar videometadata
 * Gebruikt voor snelle lookup bij rendering
 */
const videoMap = new Map();

/**
 * Algemene foutafhandeling via dialoog zodat de gebruiker weet wat er mis is.
 */
function showError(message, error) {
  console.error(message, error);
  elements.errorMessage.textContent = `${message}${error ? ` (${error.message ?? error})` : ""}`;
  if (!elements.errorDialog.open) {
    elements.errorDialog.showModal();
  }
}

/**
 * Toon een succesmelding via dialoog.
 */
function showSuccess(title, message) {
  if (elements.successDialog) {
    if (elements.successTitle) elements.successTitle.textContent = title;
    if (elements.successMessage) elements.successMessage.textContent = message;
    applyTranslations(elements.successDialog);
    elements.successDialog.showModal();
  } else {
    window.alert(`${title}\n${message}`);
  }
}

// readJsonFile, writeJsonFile, writeTextFile zijn nu geïmporteerd uit modules/utils.js

/**
 * Leest de projectmappen op schijf en synchroniseert de index zodat bestaande projecten zichtbaar blijven.
 */
async function syncIndexWithFilesystem() {
  if (!state.projectenHandle) return;
  const existingBySlug = new Map(state.indexData.projects.map((project) => [project.slug, project]));
  const projects = [];
  
  // Folders die we moeten overslaan (geen project folders)
  const skipFolders = ['audio', 'images', 'videos', 'projecten'];
  
  for await (const entry of state.projectenHandle.values()) {
    if (entry.kind !== "directory") continue;
    const slug = entry.name;
    
    // Skip system/media folders
    if (skipFolders.includes(slug) || slug.startsWith('scene_images_')) {
      continue;
    }
    
    try {
      const projectDir = await state.projectenHandle.getDirectoryHandle(slug, { create: false });
      const projectFile = await projectDir.getFileHandle("project.json", { create: false });
      const projectData = await readJsonFile(projectFile);
      const reference = existingBySlug.get(slug);
      let mutated = false;

      if (!projectData.id) {
        projectData.id = reference?.id ?? uuid();
        mutated = true;
      }
      projectData.prompts = Array.isArray(projectData.prompts) ? projectData.prompts : [];
      projectData.projectName = projectData.projectName ?? reference?.projectName ?? slug;
      projectData.createdAt = projectData.createdAt ?? reference?.createdAt ?? new Date().toISOString();
      projectData.updatedAt = projectData.updatedAt ?? reference?.updatedAt ?? projectData.createdAt;
      projectData.videoGenerator = projectData.videoGenerator ?? reference?.videoGenerator ?? "";
      projectData.notes = projectData.notes ?? reference?.notes ?? "";

      if (mutated) {
        await writeJsonFile(projectFile, projectData);
      }

      projects.push({
        id: projectData.id,
        slug,
        projectName: projectData.projectName,
        createdAt: projectData.createdAt,
        updatedAt: projectData.updatedAt,
        promptCount: projectData.prompts.length,
        videoGenerator: projectData.videoGenerator,
        notes: projectData.notes,
      });
    } catch (error) {
      console.warn(`Projectmap '${slug}' overslaan tijdens synchronisatie`, error);
    }
  }

  projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  state.indexData.projects = projects;
  if (state.indexHandle) {
    await writeJsonFile(state.indexHandle, state.indexData);
  }
}

async function refreshProjectsList() {
  if (!state.rootHandle) return;
  const currentId = state.selectedProjectId;
  await syncIndexWithFilesystem();

  if (currentId && state.indexData.projects.some((project) => project.id === currentId)) {
    await openProject(currentId);
    return;
  }

  state.selectedProjectId = null;
  state.projectHandle = null;
  state.projectImagesHandle = null;
  state.projectData = null;
  state.isDirty = false;

  renderProjectList();
  elements.projectEditor.classList.add("hidden");
  elements.projectEmptyState.classList.remove("hidden");
  updateRootUi();
}

/**
 * Zorgt ervoor dat de basisstructuur aanwezig is (projectenmap + index-bestand).
 */
async function ensureStructure() {
  if (!state.rootHandle) return;
  state.projectenHandle = await state.rootHandle.getDirectoryHandle("projecten", { create: true });
  state.indexHandle = await state.rootHandle.getFileHandle("index.json", { create: true });
  try {
    const existing = await readJsonFile(state.indexHandle);
    state.indexData = {
      version: 1,
      projects: Array.isArray(existing.projects) ? existing.projects : [],
    };
  } catch (error) {
    console.warn("Index lezen mislukt, maak nieuwe index.", error);
    state.indexData = { version: 1, projects: [] };
    await writeJsonFile(state.indexHandle, state.indexData);
  }

  await syncIndexWithFilesystem();
}

async function tryRestoreLastRoot() {
  try {
    const handle = await loadLastRootHandle();
    if (!handle) return;
    const ok = await ensureWritePermission(handle);
    if (!ok) {
      await clearLastRootHandle();
      return;
    }
    state.rootHandle = handle;
    
    // DEBUG: Uncomment de volgende 2 regels om logging aan te zetten
    // await initLogger(handle);
    // await log("Root directory hersteld vanuit vorige sessie");
    
    await ensureStructure();
    updateRootUi();
    renderProjectList();
  } catch (error) {
    console.warn("Automatisch herstellen van projectmap mislukt", error);
    await clearLastRootHandle();
  }
}

/**
 * Kijkt of we schrijfrechten hebben en vraagt die anders aan.
 */
async function ensureWritePermission(handle) {
  if (!handle) return false;
  const opts = { mode: "readwrite" };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  return (await handle.requestPermission(opts)) === "granted";
}

/**
 * Update de UI voor rootkeuze.
 */
function updateRootUi() {
  elements.rootPath.textContent = state.rootHandle?.name ?? "";
  const enabled = Boolean(state.rootHandle);
  elements.createProjectBtn.disabled = !enabled;
  elements.projectName.disabled = !enabled;
  elements.projectGenerator.disabled = !enabled;
  elements.projectNotes.disabled = !enabled;
  elements.addPrompt.disabled = !enabled || !state.projectData;
  elements.saveProject.disabled = !enabled || !state.projectData;
  elements.exportPrompts.disabled = !enabled || !state.projectData;
  elements.exportImages.disabled = !enabled || !state.projectData;
  elements.refreshProjects.disabled = !enabled;
}

/**
 * Rendert de lijst met projecten.
 */
function renderProjectList() {
  const { projects } = state.indexData;
  const hasProjects = projects.length > 0;
  elements.noProjects.classList.toggle("hidden", hasProjects);
  elements.projectList.innerHTML = "";
  if (!hasProjects) return;

  const sorted = [...projects];
  sorted.sort((a, b) => {
    switch (state.sortOrder) {
      case "name":
        return a.projectName.localeCompare(b.projectName, currentLanguage === "nl" ? "nl" : "en");
      case "created":
        return new Date(b.createdAt) - new Date(a.createdAt);
      case "updated":
      default:
        return new Date(b.updatedAt) - new Date(a.updatedAt);
    }
  });

  for (const project of sorted) {
    const li = document.createElement("li");
    li.className = "project-item";
    li.dataset.id = project.id;
    if (project.id === state.selectedProjectId) {
      li.classList.add("active");
    }
    
    // Audio timeline indicator
    if (project.hasAudioTimeline) {
      li.classList.add("has-audio-timeline");
    }

    const title = document.createElement("strong");
    title.textContent = project.projectName;
    
    // Voeg audio icon toe aan titel als project audio heeft
    if (project.hasAudioTimeline) {
      const audioIcon = document.createElement("span");
      audioIcon.className = "audio-indicator";
      audioIcon.textContent = " 🎵";
      audioIcon.title = "Dit project heeft een audio timeline";
      title.appendChild(audioIcon);
    }
    
    li.appendChild(title);

    const meta = document.createElement("span");
    meta.textContent = t("project.lastUpdated", { date: formatDateTime(project.updatedAt) });
    li.appendChild(meta);

    const created = document.createElement("span");
    created.textContent = t("project.created", { date: formatDateTime(project.createdAt) });
    li.appendChild(created);

    const count = document.createElement("span");
    count.textContent = t("project.promptCount", { count: project.promptCount ?? 0 });
    li.appendChild(count);

    li.addEventListener("click", () =>
      openProject(project.id).catch((error) => showError(t("errors.openProject"), error))
    );
    elements.projectList.appendChild(li);
  }
  applyTranslations(elements.projectList.parentElement);
}

/**
 * Zet het hele projectoverzicht klaar in de editor.
 */
function renderProjectEditor() {
  if (!state.projectData) return;
  const { projectName, videoGenerator, notes, prompts } = state.projectData;
  elements.projectTitle.textContent = projectName;
  elements.editGenerator.value = videoGenerator ?? "";
  elements.editNotes.value = notes ?? "";
  refreshProjectMetaDisplay();

  elements.promptsContainer.innerHTML = "";
  
  prompts.forEach((prompt, index) => {
    const card = createPromptCard(prompt, index);
    elements.promptsContainer.appendChild(card);
    
    // Voeg transitie button toe tussen scenes (behalve na laatste scene)
    if (index < prompts.length - 1) {
      const transitionBtn = renderTransitionButton(index, state.projectData, (sceneIndex) => {
        showTransitionDialog(sceneIndex, state.projectData, () => {
          state.isDirty = true;
          renderProjectEditor(); // Re-render om status indicator te updaten
        });
      });
      elements.promptsContainer.appendChild(transitionBtn);
    }
  });
  
  // Herstel de media view mode als die bestaat
  if (state.currentMediaViewMode === "images") {
    elements.promptsContainer.classList.add("media-view-images");
    elements.promptsContainer.classList.remove("media-view-videos");
    elements.showAllImages.classList.add("active");
    elements.showAllVideos.classList.remove("active");
    elements.showAllImages.innerHTML = "✓ 🖼️ Afbeeldingen";
    elements.showAllVideos.innerHTML = "🎬 Video's";
    
    // Update alle scene toggles
    updateAllSceneToggles("images");
  } else if (state.currentMediaViewMode === "videos") {
    elements.promptsContainer.classList.add("media-view-videos");
    elements.promptsContainer.classList.remove("media-view-images");
    elements.showAllVideos.classList.add("active");
    elements.showAllImages.classList.remove("active");
    elements.showAllVideos.innerHTML = "✓ 🎬 Video's";
    elements.showAllImages.innerHTML = "🖼️ Afbeeldingen";
    
    // Update alle scene toggles
    updateAllSceneToggles("videos");
  } else {
    // Normale mode (geen globale view)
    elements.promptsContainer.classList.remove("media-view-images", "media-view-videos");
    elements.showAllImages.classList.add("active");
    elements.showAllVideos.classList.remove("active");
    elements.showAllImages.innerHTML = "🖼️ Afbeeldingen";
    elements.showAllVideos.innerHTML = "🎬 Video's";
  }

  
  // Update help texts once after all cards are rendered
  updateHelpTexts();

  elements.projectEmptyState.classList.add("hidden");
  elements.projectEditor.classList.remove("hidden");
  updateRootUi();
  applyTranslations(elements.projectEditor);
}

/**
 * Update alle scene toggles naar een specifieke media mode
 */
function updateAllSceneToggles(mode) {
  const allSceneCards = elements.promptsContainer.querySelectorAll(".prompt-card");
  allSceneCards.forEach(card => {
    const toggleImage = card.querySelector(".toggle-image");
    const toggleVideo = card.querySelector(".toggle-video");
    const imageSection = card.querySelector(".image-uploader");
    const videoSection = card.querySelector(".video-uploader");
    
    if (toggleImage && toggleVideo && imageSection && videoSection) {
      if (mode === "images") {
        toggleImage.classList.add("active");
        toggleVideo.classList.remove("active");
        imageSection.dataset.active = "true";
        videoSection.dataset.active = "false";
      } else if (mode === "videos") {
        toggleVideo.classList.add("active");
        toggleImage.classList.remove("active");
        videoSection.dataset.active = "true";
        imageSection.dataset.active = "false";
      }
    }
  });
}

function refreshProjectMetaDisplay() {
  if (!state.projectData) return;
  const { createdAt, updatedAt, prompts } = state.projectData;
  const dirtySuffix = state.isDirty ? ` ${t("project.dirtySuffix")}` : "";
  elements.projectMeta.innerHTML = `
    <span>${t("project.created", { date: formatDateTime(createdAt) })}</span>
    <span>${t("project.lastUpdated", { date: formatDateTime(updatedAt) })}${dirtySuffix}</span>
    <span>${t("project.promptCount", { count: prompts.length })}</span>
  `;
}

function refreshActiveProjectListItem() {
  if (!state.selectedProjectId || !state.projectData) return;
  const item = elements.projectList.querySelector(`.project-item[data-id="${state.selectedProjectId}"]`);
  if (!item) return;
  const title = item.querySelector("strong");
  if (title) {
    title.textContent = state.projectData.projectName;
  }
  const spans = item.querySelectorAll("span");
  if (spans[0]) {
    spans[0].textContent = t("project.lastUpdated", { date: formatDateTime(state.projectData.updatedAt) });
  }
  if (spans[1]) {
    spans[1].textContent = t("project.created", { date: formatDateTime(state.projectData.createdAt) });
  }
  if (spans[2]) {
    spans[2].textContent = t("project.promptCount", { count: state.projectData.prompts.length });
  }
}

/**
 * Maakt een kaart voor een prompt inclusief events.
 */
function createPromptCard(prompt, index) {
  const template = elements.promptTemplate.content.cloneNode(true);
  const card = template.querySelector(".prompt-card");
  card.dataset.id = prompt.id;
  card.querySelector(".prompt-index").textContent = t("prompts.scene", { index: index + 1 });
  
  // AI Prompt velden
  card.querySelector(".prompt-text").value = prompt.text ?? "";
  card.querySelector(".prompt-nl").value = prompt.translation ?? "";
  
  // Traditionele velden
  const sceneWhatSee = card.querySelector(".scene-what-see");
  const sceneHowMake = card.querySelector(".scene-how-make");
  const sceneTimeline = card.querySelector(".scene-timeline");
  
  if (sceneWhatSee) sceneWhatSee.value = prompt.whatDoWeSee ?? "";
  if (sceneHowMake) sceneHowMake.value = prompt.howDoWeMake ?? "";
  if (sceneTimeline) sceneTimeline.value = prompt.timeline ?? "";

  // Afbeeldingvoorvertoning instellen indien aanwezig
  const uploader = card.querySelector(".image-uploader");
  const previewImg = uploader.querySelector("img");
  const placeholder = uploader.querySelector(".placeholder");
  if (prompt.imagePath) {
    uploader.dataset.hasImage = "true";
    placeholder.textContent = prompt.imageOriginalName ?? t("prompt.imageAddedFallback");
    loadImagePreview(prompt.imagePath, previewImg).catch((error) => {
      console.warn("Afbeelding voorvertoning mislukt", error);
      uploader.dataset.hasImage = "false";
      placeholder.textContent = t("prompt.placeholderImage");
    });
  } else {
    placeholder.textContent = t("prompt.placeholderImage");
  }

  const dialogButton = card.querySelector(".open-prompt");
  dialogButton.addEventListener("click", () =>
    openPromptDialog(prompt.id).catch((error) => showError(t("errors.openPrompt"), error))
  );

  // Events voor tekstvelden
  card.querySelector(".prompt-text").addEventListener("input", (event) => {
    updatePromptField(prompt.id, "text", event.target.value);
  });
  card.querySelector(".prompt-nl").addEventListener("input", (event) => {
    updatePromptField(prompt.id, "translation", event.target.value);
  });
  
  // Events voor traditionele velden
  if (sceneWhatSee) {
    sceneWhatSee.addEventListener("input", (event) => {
      updatePromptField(prompt.id, "whatDoWeSee", event.target.value);
    });
  }
  if (sceneHowMake) {
    sceneHowMake.addEventListener("input", (event) => {
      updatePromptField(prompt.id, "howDoWeMake", event.target.value);
    });
  }
  if (sceneTimeline) {
    sceneTimeline.addEventListener("input", (event) => {
      updatePromptField(prompt.id, "timeline", event.target.value);
    });
  }
  
  // Edit scene button (voor "both" mode)
  const editSceneBtn = card.querySelector(".edit-scene-btn");
  if (editSceneBtn) {
    editSceneBtn.addEventListener("click", () =>
      openPromptDialog(prompt.id).catch((error) => showError(t("errors.openPrompt"), error))
    );
  }

  // Verwijderen en verplaatsen
  card.querySelector(".delete").addEventListener("click", () => {
    deletePromptWrapper(prompt.id).catch((error) => showError(t("errors.deletePrompt"), error));
  });
  card.querySelector(".move-up").addEventListener("click", () => {
    movePromptWrapper(prompt.id, -1);
  });
  card.querySelector(".move-down").addEventListener("click", () => {
    movePromptWrapper(prompt.id, 1);
  });

  const dragHandle = card.querySelector(".drag-handle");
  dragHandle.addEventListener("dragstart", (event) => {
    state.draggedPromptId = prompt.id;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", prompt.id);
    card.classList.add("dragging");
  });
  dragHandle.addEventListener("dragend", () => {
    state.draggedPromptId = null;
    card.classList.remove("dragging");
  });

  // Uploadknop
  const input = card.querySelector(".image-input");
  input.addEventListener("change", (event) => {
    const [file] = event.target.files ?? [];
    if (file) {
      assignImageToPromptWrapper(prompt.id, file, uploader).catch((error) => showError(t("errors.assignImage"), error));
    }
  });

  // Drag & drop ondersteuning
  card.addEventListener("dragover", (event) => {
    const hasFiles = Array.from(event.dataTransfer?.types ?? []).includes("Files");
    if (!hasFiles) return;
    event.preventDefault();
    card.classList.add("drag-over");
  });
  card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
  card.addEventListener("drop", (event) => {
    const file = [...(event.dataTransfer?.files ?? [])].find((f) => f.type.startsWith("image/"));
    if (!file) return;
    event.preventDefault();
    card.classList.remove("drag-over");
    assignImageToPromptWrapper(prompt.id, file, uploader).catch((error) => showError(t("errors.assignImage"), error));
  });

  card.querySelector(".remove-image").addEventListener("click", () => {
    removeImageFromPromptWrapper(prompt.id, uploader).catch((error) => showError(t("errors.removeImage"), error));
  });

  // Video upload handlers
  const videoUploader = card.querySelector(".video-uploader");
  const videoPreview = videoUploader.querySelector("video");
  const videoPlaceholder = videoUploader.querySelector(".placeholder");
  const videoInput = card.querySelector(".video-input");
  
  // Initialiseer video preview
  if (prompt.videoPath) {
    videoUploader.dataset.hasVideo = "true";
    videoPlaceholder.textContent = prompt.videoOriginalName ?? "Video toegevoegd";
    loadVideoPreview(prompt.videoPath, videoPreview).catch((error) => {
      console.warn("Video voorvertoning mislukt", error);
      videoUploader.dataset.hasVideo = "false";
      videoPlaceholder.textContent = "Sleep hier een video (MP4 / WebM)";
    });
  } else {
    videoPlaceholder.textContent = "Sleep hier een video (MP4 / WebM)";
  }

  videoInput.addEventListener("change", (event) => {
    const [file] = event.target.files ?? [];
    if (file) {
      assignVideoToPromptWrapper(prompt.id, file, videoUploader).catch((error) => showError("Video uploaden mislukt", error));
    }
  });

  // Drag & drop ondersteuning voor video
  videoUploader.addEventListener("dragover", (event) => {
    const hasFiles = Array.from(event.dataTransfer?.types ?? []).includes("Files");
    if (!hasFiles) return;
    event.preventDefault();
    videoUploader.classList.add("drag-over");
  });
  videoUploader.addEventListener("dragleave", () => videoUploader.classList.remove("drag-over"));
  videoUploader.addEventListener("drop", (event) => {
    const file = [...(event.dataTransfer?.files ?? [])].find((f) => f.type.startsWith("video/"));
    if (!file) return;
    event.preventDefault();
    videoUploader.classList.remove("drag-over");
    assignVideoToPromptWrapper(prompt.id, file, videoUploader).catch((error) => showError("Video uploaden mislukt", error));
  });

  card.querySelector(".remove-video").addEventListener("click", () => {
    removeVideoFromPromptWrapper(prompt.id, videoUploader).catch((error) => showError("Video verwijderen mislukt", error));
  });

  // Media toggle (image/video)
  const toggleImage = card.querySelector(".toggle-image");
  const toggleVideo = card.querySelector(".toggle-video");
  const imageSection = card.querySelector(".image-uploader");
  const videoSection = card.querySelector(".video-uploader");

  // Bepaal standaard media type op basis van globale view mode
  const isVideoMode = elements.promptsContainer.classList.contains("media-view-videos");
  if (isVideoMode) {
    // Start met video actief als globale mode op video staat
    toggleVideo.classList.add("active");
    toggleImage.classList.remove("active");
    videoSection.dataset.active = "true";
    imageSection.dataset.active = "false";
  } else {
    // Start met image actief (standaard of als media-view-images actief is)
    toggleImage.classList.add("active");
    toggleVideo.classList.remove("active");
    imageSection.dataset.active = "true";
    videoSection.dataset.active = "false";
  }

  toggleImage.addEventListener("click", () => {
    toggleImage.classList.add("active");
    toggleVideo.classList.remove("active");
    imageSection.dataset.active = "true";
    videoSection.dataset.active = "false";
  });

  toggleVideo.addEventListener("click", () => {
    toggleVideo.classList.add("active");
    toggleImage.classList.remove("active");
    videoSection.dataset.active = "true";
    imageSection.dataset.active = "false";
  });

  // Attachments
  if (state.projectAttachmentsHandle) {
    initializeAttachments(card, prompt, state.projectAttachmentsHandle, {
      onUpdate: (promptId, field, value) => {
        updatePromptField(promptId, field, value);
      },
      onError: (message, error) => {
        showError(message, error);
      }
    });
  }

  // Rating widget
  const ratingContainer = card.querySelector(".rating");
  renderStarWidget(ratingContainer, prompt.rating ?? 0, (val) => {
    updatePromptField(prompt.id, "rating", val);
  });

  // Copy scene to other project
  const copyBtn = card.querySelector(".copy-scene");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      openCopyDialog(prompt.id).catch((error) => showError(t("errors.openPrompt"), error));
    });
  }

  applyTranslations(card);
  
  return card;
}

/**
 * Leest de afbeelding voorvertoning uit het project en toont deze.
 */
async function loadImagePreview(imagePath, imgElement) {
  if (!state.projectImagesHandle) return;
  try {
    const fileHandle = await state.projectImagesHandle.getFileHandle(imagePath);
    const file = await fileHandle.getFile();
    const blobUrl = URL.createObjectURL(file);
    imgElement.src = blobUrl;
  } catch (error) {
    console.warn("Voorvertoning laden mislukt", error);
  }
}

/**
 * Leest de video voorvertoning uit het project en toont deze.
 */
async function loadVideoPreview(videoPath, videoElement) {
  if (!state.projectVideosHandle) return;
  try {
    const fileHandle = await state.projectVideosHandle.getFileHandle(videoPath);
    const file = await fileHandle.getFile();
    const blobUrl = URL.createObjectURL(file);
    videoElement.src = blobUrl;
    videoElement.load(); // Belangrijk: herlaad video element
  } catch (error) {
    console.warn("Video voorvertoning laden mislukt", error);
  }
}

/**
 * Render a 5-star widget into a container. Calls onChange(newValue) when user sets rating.
 */
function renderStarWidget(container, currentValue = 0, onChange = () => {}) {
  if (!container) return;
  container.innerHTML = "";
  for (let i = 1; i <= 5; i += 1) {
    const star = document.createElement("button");
    star.type = "button";
    star.className = `star ${i <= (currentValue || 0) ? "filled" : ""}`;
    star.dataset.value = String(i);
    star.setAttribute("aria-label", `${i} star`);
    star.textContent = i <= (currentValue || 0) ? "★" : "☆";
    star.addEventListener("click", (e) => {
      e.preventDefault();
      const val = Number(star.dataset.value);
      onChange(val);
      // rerender
      renderStarWidget(container, val, onChange);
    });
    container.appendChild(star);
  }
}

/**
 * Past een veld aan binnen de prompt en markeert het project als gewijzigd.
 */
function updatePromptField(promptId, field, value) {
  const prompt = state.projectData.prompts.find((item) => item.id === promptId);
  if (!prompt) return;
  if (prompt[field] === value) return;
  prompt[field] = value;
  flagProjectDirty({ refreshEditor: false, refreshList: false });
}

/**
 * Wrapper: roept modules/scenes.js deletePrompt aan (met video cleanup)
 */
async function deletePromptWrapper(promptId) {
  // Check of deze scene een audio marker heeft
  const prompt = state.projectData?.prompts.find(p => p.id === promptId);
  const hasMarker = prompt?.isAudioLinked && prompt?.audioMarkerIndex !== undefined;
  const markerIndex = hasMarker ? prompt.audioMarkerIndex : null;
  
  // Verwijder de scene (en bijbehorende bestanden)
  await deletePrompt(promptId, state, elements);
  imageMap.delete(promptId);
  videoMap.delete(promptId);
  clearAttachmentCache(promptId); // ⭐ NIEUW: clear attachment cache
  
  // Cleanup transitions voor verwijderde scene
  if (state.projectData) {
    cleanupTransitions(state.projectData, state.projectData.prompts.length);
  }
  
  // Als de scene een marker had, verwijder die ook
  if (hasMarker && markerIndex !== null && hasAudioTimeline()) {
    removeMarkerByIndex(markerIndex);
  }
  
  flagProjectDirty();
}

/**
 * Wrapper: roept modules/scenes.js movePrompt aan
 */
function movePromptWrapper(promptId, direction) {
  if (!state.projectData) return;
  const prompts = state.projectData.prompts;
  const currentIndex = prompts.findIndex(p => p.id === promptId);
  if (currentIndex === -1) return;
  
  const newIndex = currentIndex + direction;
  if (newIndex < 0 || newIndex >= prompts.length) return;
  
  // Move scene
  movePrompt(promptId, direction, state);
  
  // Reindex transitions
  reindexTransitions(state.projectData, currentIndex, newIndex);
  
  flagProjectDirty();
}

function movePromptToIndex(promptId, targetIndex) {
  if (!state.projectData) return;
  const prompts = state.projectData.prompts;
  const currentIndex = prompts.findIndex((item) => item.id === promptId);
  if (currentIndex === -1) return;
  const [moved] = prompts.splice(currentIndex, 1);
  const boundedIndex = Math.max(0, Math.min(targetIndex, prompts.length));
  prompts.splice(boundedIndex, 0, moved);
  
  // Reindex transitions
  reindexTransitions(state.projectData, currentIndex, boundedIndex);
  
  flagProjectDirty();
}

function handlePromptContainerDragOver(event) {
  if (!state.draggedPromptId) return;
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
}

function handlePromptContainerDrop(event) {
  const promptId = state.draggedPromptId ?? event.dataTransfer?.getData("text/plain");
  if (!promptId) return;
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.clearData();
  }

  const cards = Array.from(elements.promptsContainer.querySelectorAll(".prompt-card")).filter(
    (card) => card.dataset.id !== promptId
  );

  let targetIndex = cards.length;
  for (let i = 0; i < cards.length; i += 1) {
    const card = cards[i];
    const rect = card.getBoundingClientRect();
    if (event.clientX < rect.left + rect.width / 2) {
      targetIndex = i;
      break;
    }
  }

  elements.promptsContainer.querySelectorAll(".prompt-card.dragging").forEach((card) => card.classList.remove("dragging"));
  movePromptToIndex(promptId, targetIndex);
  state.draggedPromptId = null;
}

/**
 * Open a dialog to choose a target project for copying a prompt.
 */
async function openCopyDialog(promptId) {
  if (!elements.copyDialog) return;
  if (!state.indexData.projects || state.indexData.projects.length <= 1) {
    showError(t("errors.refreshProjects"));
    return;
  }
  // Populate select with projects except the current one
  elements.copyTargetSelect.innerHTML = "";
  const options = state.indexData.projects.filter((p) => p.id !== state.selectedProjectId);
  for (const p of options) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.projectName;
    elements.copyTargetSelect.appendChild(opt);
  }
  state.copyingPromptId = promptId;
  elements.copyDialog.showModal();
}

/**
 * Copy a single prompt (and its image if present) into another project.
 */
async function copySceneToProject(promptId, targetProjectId) {
  if (!state.projectenHandle) throw new Error("Geen project root");
  const sourcePrompt = state.projectData.prompts.find((p) => p.id === promptId);
  if (!sourcePrompt) throw new Error(t("errors.noSceneSelected"));

  const targetMeta = state.indexData.projects.find((p) => p.id === targetProjectId);
  if (!targetMeta) throw new Error("Target project not found");

  const targetDir = await state.projectenHandle.getDirectoryHandle(targetMeta.slug, { create: false });
  const targetProjectFile = await targetDir.getFileHandle("project.json", { create: true });
  const targetImagesDir = await targetDir.getDirectoryHandle("images", { create: true });
  const targetVideosDir = await targetDir.getDirectoryHandle("videos", { create: true });

  const targetData = await readJsonFile(targetProjectFile);
  targetData.prompts = Array.isArray(targetData.prompts) ? targetData.prompts : [];

  // Create a copy of the prompt with a new id
  const newPrompt = {
    id: uuid(),
    text: sourcePrompt.text ?? "",
    translation: sourcePrompt.translation ?? "",
    imagePath: null,
    imageOriginalName: sourcePrompt.imageOriginalName ?? null,
    imageType: sourcePrompt.imageType ?? null,
    videoPath: null,
    videoOriginalName: sourcePrompt.videoOriginalName ?? null,
    videoType: sourcePrompt.videoType ?? null,
    rating: sourcePrompt.rating ?? null,
  };

  // If image exists, copy file bytes
  if (sourcePrompt.imagePath && state.projectImagesHandle) {
    try {
      const sourceHandle = await state.projectImagesHandle.getFileHandle(sourcePrompt.imagePath);
      const sourceFile = await sourceHandle.getFile();
      const extension = sourcePrompt.imagePath.split('.').pop();
      const targetFilename = `${newPrompt.id}.${extension}`;
      const targetHandle = await targetImagesDir.getFileHandle(targetFilename, { create: true });
      const writable = await targetHandle.createWritable();
      await writable.write(await sourceFile.arrayBuffer());
      await writable.close();
      newPrompt.imagePath = targetFilename;
    } catch (error) {
      console.warn("Kopiëren afbeelding mislukt", error);
      // We continue without image to not block the operation
      newPrompt.imagePath = null;
    }
  }

  // If video exists, copy file bytes
  if (sourcePrompt.videoPath && state.projectVideosHandle) {
    try {
      const sourceHandle = await state.projectVideosHandle.getFileHandle(sourcePrompt.videoPath);
      const sourceFile = await sourceHandle.getFile();
      const extension = sourcePrompt.videoPath.split('.').pop();
      const targetFilename = `${newPrompt.id}.${extension}`;
      const targetHandle = await targetVideosDir.getFileHandle(targetFilename, { create: true });
      const writable = await targetHandle.createWritable();
      await writable.write(await sourceFile.arrayBuffer());
      await writable.close();
      newPrompt.videoPath = targetFilename;
    } catch (error) {
      console.warn("Kopiëren video mislukt", error);
      // We continue without video to not block the operation
      newPrompt.videoPath = null;
    }
  }

  targetData.prompts.push(newPrompt);
  // update timestamps
  targetData.updatedAt = new Date().toISOString();
  await writeJsonFile(targetProjectFile, targetData);

  // If target project is currently open, refresh it
  if (state.selectedProjectId === targetProjectId) {
    state.projectData = targetData;
    // rebuild imageMap and videoMap for the open project
    imageMap.clear();
    videoMap.clear();
    state.projectData.prompts.forEach((p) => {
      if (p.imagePath) imageMap.set(p.id, { filename: p.imagePath });
      if (p.videoPath) videoMap.set(p.id, { filename: p.videoPath });
    });
    renderProjectEditor();
  } else {
    // update index entry for target project
    const entry = state.indexData.projects.find((p) => p.id === targetProjectId);
    if (entry) {
      entry.updatedAt = targetData.updatedAt;
      entry.promptCount = targetData.prompts.length;
      await writeJsonFile(state.indexHandle, state.indexData);
    }
  }
}

/**
 * Duplicate a prompt within the same project, inserting it right after the original.
 */
async function duplicateSceneInProject(promptId) {
  const sourcePrompt = state.projectData.prompts.find((p) => p.id === promptId);
  if (!sourcePrompt) throw new Error(t("errors.noSceneSelected"));

  const index = state.projectData.prompts.indexOf(sourcePrompt);
  const newPrompt = {
    id: uuid(),
    text: sourcePrompt.text ?? "",
    translation: sourcePrompt.translation ?? "",
    imagePath: null,
    imageOriginalName: sourcePrompt.imageOriginalName ?? null,
    imageType: sourcePrompt.imageType ?? null,
    videoPath: null,
    videoOriginalName: sourcePrompt.videoOriginalName ?? null,
    videoType: sourcePrompt.videoType ?? null,
    rating: sourcePrompt.rating ?? null,
  };

  // If image exists, copy file bytes within the same images dir
  if (sourcePrompt.imagePath && state.projectImagesHandle) {
    try {
      const sourceHandle = await state.projectImagesHandle.getFileHandle(sourcePrompt.imagePath);
      const sourceFile = await sourceHandle.getFile();
      const extension = sourcePrompt.imagePath.split('.').pop();
      const targetFilename = `${newPrompt.id}.${extension}`;
      const targetHandle = await state.projectImagesHandle.getFileHandle(targetFilename, { create: true });
      const writable = await targetHandle.createWritable();
      await writable.write(await sourceFile.arrayBuffer());
      await writable.close();
      newPrompt.imagePath = targetFilename;
      imageMap.set(newPrompt.id, { filename: targetFilename });
    } catch (error) {
      console.warn("Dupliceren afbeelding mislukt", error);
    }
  }

  // If video exists, copy file bytes within the same videos dir
  if (sourcePrompt.videoPath && state.projectVideosHandle) {
    try {
      const sourceHandle = await state.projectVideosHandle.getFileHandle(sourcePrompt.videoPath);
      const sourceFile = await sourceHandle.getFile();
      const extension = sourcePrompt.videoPath.split('.').pop();
      const targetFilename = `${newPrompt.id}.${extension}`;
      const targetHandle = await state.projectVideosHandle.getFileHandle(targetFilename, { create: true });
      const writable = await targetHandle.createWritable();
      await writable.write(await sourceFile.arrayBuffer());
      await writable.close();
      newPrompt.videoPath = targetFilename;
      videoMap.set(newPrompt.id, { filename: targetFilename });
    } catch (error) {
      console.warn("Dupliceren video mislukt", error);
    }
  }

  // Insert after the original
  state.projectData.prompts.splice(index + 1, 0, newPrompt);
  flagProjectDirty();
}

/**
 * Presentatiemodus: open fullscreen slideshow
 */
async function openPresentation() {
  if (!state.projectData || !state.projectData.prompts.length) {
    showError(t("errors.noPrompts"));
    return;
  }

  // Reset presentation state volledig
  state.presentationMode.currentSlide = 0;
  state.presentationMode.languageMode = "both";
  state.presentationMode.workflowMode = "both"; // Zorg dat workflow mode is ingesteld
  state.presentationMode.videoMode = false;
  state.presentationMode.audioMode = false;
  state.presentationMode.videoTimeline = null;
  state.presentationMode.audioMarkers = null;
  state.presentationMode.audioDuration = null;
  state.presentationMode.audioBuffer = null;
  
  // Stop en reset audio/video elementen van vorige presentaties
  if (elements.presentationAudio) {
    elements.presentationAudio.pause();
    elements.presentationAudio.removeAttribute("src");
    elements.presentationAudio.currentTime = 0;
    elements.presentationAudio.load();
  }
  if (elements.presentationVideo) {
    elements.presentationVideo.pause();
    elements.presentationVideo.removeAttribute("src");
    elements.presentationVideo.currentTime = 0;
    elements.presentationVideo.load();
  }

  if (elements.presentationLanguage) {
    elements.presentationLanguage.value = "both";
  }
  
  if (elements.presentationWorkflow) {
    elements.presentationWorkflow.value = "both";
  }

  // Check of project audio timeline heeft
  const hasAudio = state.projectData.audioTimeline && state.projectData.audioTimeline.audioFileName;
  
  // Bepaal mode op basis van opgeslagen waarde
  const savedMode = elements.presentationMode ? elements.presentationMode.value : "image";
  
  // Gebruik altijd de saved mode - laat gebruiker zelf kiezen
  state.presentationMode.videoMode = (savedMode === "video");
  state.presentationMode.audioMode = (savedMode === "audio-image" || savedMode === "audio-video" || savedMode === "audio-mixed");

  // Initialiseer video timeline als video mode actief is
  if (state.presentationMode.videoMode) {
    const timeline = await initializeCombinedVideoPresentation(state, elements, t);
    state.presentationMode.videoTimeline = timeline;
    
    if (!timeline || timeline.segments.length === 0) {
      console.warn("Geen video's gevonden in dit project");
      state.presentationMode.videoMode = false;
      if (elements.presentationMode) {
        elements.presentationMode.value = "image";
      }
    }
  }
  
  // Initialiseer audio als audio mode actief is EN project heeft audio
  if (state.presentationMode.audioMode && hasAudio) {
    const audioInitialized = await initializeAudioPresentation(
      state, 
      elements, 
      state.projectDirHandle,
      getSceneIndexAtTime,
      getAllScenes,
      updatePresentationSlideWrapper
    );
    
    // Als audio niet kon laden, val terug naar image mode
    if (!audioInitialized) {
      console.warn("Audio kon niet worden geladen, terugvallen naar image mode");
      state.presentationMode.audioMode = false;
      if (elements.presentationMode) {
        elements.presentationMode.value = "image";
      }
    }
  } else if (state.presentationMode.audioMode && !hasAudio) {
    // Geen audio beschikbaar, forceer image mode
    console.warn("Audio mode geselecteerd maar project heeft geen audio");
    state.presentationMode.audioMode = false;
    if (elements.presentationMode) {
      elements.presentationMode.value = "image";
    }
  }

  // Geef de UI tijd om de loader te renderen
  await new Promise(resolve => setTimeout(resolve, 50));

  if (elements.presentationDialog) {
    applyTranslations(elements.presentationDialog);
    
    // Set container visibility en footer class
    const imageContainer = elements.presentationDialog.querySelector(".slide-image-container");
    const videoContainer = elements.presentationDialog.querySelector(".slide-video-container");
    const footer = elements.presentationDialog.querySelector(".presentation-footer");
    const form = elements.presentationDialog.querySelector(".presentation-form");
    
    if (imageContainer && videoContainer && footer) {
      if (state.presentationMode.videoMode) {
        imageContainer.dataset.active = "false";
        videoContainer.dataset.active = "true";
        footer.classList.add("video-mode");
        footer.classList.remove("audio-mode");
        if (form) form.classList.remove("has-audio-timeline");
      } else if (state.presentationMode.audioMode) {
        const mode = elements.presentationMode.value;
        const showVideo = (mode === "audio-video");
        const mixedMode = (mode === "audio-mixed");
        
        // In mixed mode, bepaal per scene of we video of image tonen
        if (mixedMode) {
          const currentSlideIndex = state.presentationMode.currentSlide;
          const currentPrompt = state.projectData.prompts.find(p => 
            p.isAudioLinked && p.audioMarkerIndex === currentSlideIndex
          ) || state.projectData.prompts[currentSlideIndex];
          
          const useVideo = currentPrompt && currentPrompt.preferredMediaType === 'video';
          
          imageContainer.dataset.active = useVideo ? "false" : "true";
          videoContainer.dataset.active = useVideo ? "true" : "false";
        } else {
          imageContainer.dataset.active = showVideo ? "false" : "true";
          videoContainer.dataset.active = showVideo ? "true" : "false";
        }
        
        footer.classList.add("audio-mode");
        footer.classList.remove("video-mode");
        if (form) form.classList.add("has-audio-timeline");
      } else {
        // Image mode - GEEN audio waveform tonen (alleen in audio modes)
        imageContainer.dataset.active = "true";
        videoContainer.dataset.active = "false";
        footer.classList.remove("video-mode");
        footer.classList.remove("audio-mode");
        if (form) form.classList.remove("has-audio-timeline");
      }
    }
    
    elements.presentationDialog.showModal();
  }

  // Forceer start bij scene 0 (Scene 1)
  state.presentationMode.currentSlide = 0;
  
  // Laad eerste slide NA het openen van dialog
  await updatePresentationSlideWrapper();
  
  // Verberg loading indicator
  showPresentationLoader(false);
}

/**
 * Toon/verberg presentation loading indicator
 */
function showPresentationLoader(show) {
  let loader = document.getElementById('presentation-loader');
  
  if (show) {
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'presentation-loader';
      loader.innerHTML = `
        <div class="loader-spinner"></div>
        <div class="loader-text">Presentatie wordt geladen...</div>
      `;
      document.body.appendChild(loader);
    }
    loader.style.display = 'flex';
  } else {
    if (loader) {
      loader.style.display = 'none';
    }
  }
}

/**
 * DEPRECATED - oude slider functie
 */
function setupAudioTimelineSlider(elements, state) {
  // Deze functie is vervangen door setupPresentationAudioPlayer
}

/**
 * Bepaal welke scene index hoort bij een specifieke tijd
 * Returned de originalIndex van de scene in de prompts array
 */
function getSceneIndexAtTime(state, time) {
  if (!state.presentationMode.audioMarkers || !state.projectData) return -1;
  
  // Zoek laatste marker vóór of gelijk aan deze tijd
  let activeMarkerIndex = -1;
  for (let i = state.presentationMode.audioMarkers.length - 1; i >= 0; i--) {
    if (time >= state.presentationMode.audioMarkers[i]) {
      activeMarkerIndex = i;
      break;
    }
  }
  
  if (activeMarkerIndex === -1) return 0; // Voor start terug naar scene 0
  
  // Vind scene die aan deze marker gekoppeld is
  // We moeten de ECHTE index in de prompts array vinden, niet de marker index
  for (let i = 0; i < state.projectData.prompts.length; i++) {
    const prompt = state.projectData.prompts[i];
    if (prompt.isAudioLinked && prompt.audioMarkerIndex === activeMarkerIndex) {
      return i; // Return de echte positie in de prompts array
    }
  }
  
  // Als geen scene gekoppeld aan deze marker, blijf bij huidige
  return state.presentationMode.currentSlide;
}

/**
 * Update presentatie-slide met huidige inhoud
 */
/**
 * Wrapper: roept modules/presentation.js updatePresentationSlide of updateCombinedVideoPresentation aan
 * afhankelijk van de geselecteerde modus
 */
async function updatePresentationSlideWrapper() {
  
  if (state.presentationMode.videoMode && state.presentationMode.videoTimeline) {
    // Video modus: gebruik combined video presentation
    await updateCombinedVideoPresentation(state, elements, t);
  } else if (state.presentationMode.audioMode) {
    // Audio modus: gebruik standaard image/video slide update
    const mode = elements.presentationMode ? elements.presentationMode.value : 'audio-image';
    const currentSlideIndex = state.presentationMode.currentSlide;
    const prompt = state.projectData.prompts[currentSlideIndex];
    
    // Voor audio-mixed: zoek de juiste scene op basis van audioMarkerIndex
    const actualScene = (mode === 'audio-mixed') 
      ? (state.projectData.prompts.find(p => p.isAudioLinked && p.audioMarkerIndex === currentSlideIndex) || prompt)
      : prompt;
    
    if (mode === 'audio-video') {
      // Audio + video of mixed mode met video preference: laad video EN toon prompts
      
      // Update video als scene video heeft
      if (prompt && prompt.videoPath && state.projectVideosHandle) {
        (async () => {
          try {
            const fileHandle = await state.projectVideosHandle.getFileHandle(prompt.videoPath);
            const file = await fileHandle.getFile();
            const blobUrl = URL.createObjectURL(file);

            if (elements.presentationVideo) {
              elements.presentationVideo.pause();
              elements.presentationVideo.src = blobUrl;
              elements.presentationVideo.load();
              
              // Auto-play video
              elements.presentationVideo.play().catch(err => {
                console.log('Auto-play geblokkeerd door browser, gebruiker moet handmatig starten:', err);
              });
            }
            if (elements.presentationNoVideo) {
              elements.presentationNoVideo.style.display = "none";
            }
          } catch (error) {
            console.warn("Video laden mislukt in audio mode", error);
            if (elements.presentationVideo) elements.presentationVideo.style.display = "none";
            if (elements.presentationNoVideo) elements.presentationNoVideo.style.display = "block";
          }
        })();
      } else {
        // Geen video: toon placeholder
        if (elements.presentationVideo) {
          elements.presentationVideo.pause();
          elements.presentationVideo.removeAttribute("src");
        }
        if (elements.presentationNoVideo) {
          elements.presentationNoVideo.style.display = "block";
        }
      }
      
      // Update prompts/translations (hergebruik standaard slide update logica)
      updatePresentationSlide(state, elements, t);
    } else if (mode === 'audio-mixed') {
      // Audio + mixed: laad image OF video afhankelijk van preferredMediaType
      
      if (actualScene && actualScene.preferredMediaType === 'video') {
        // Deze scene gebruikt video
        if (actualScene.videoPath && state.projectVideosHandle) {
          (async () => {
            try {
              const fileHandle = await state.projectVideosHandle.getFileHandle(actualScene.videoPath);
              const file = await fileHandle.getFile();
              const blobUrl = URL.createObjectURL(file);

              if (elements.presentationVideo) {
                elements.presentationVideo.pause();
                elements.presentationVideo.src = blobUrl;
                elements.presentationVideo.load();
                
                // Auto-play video
                elements.presentationVideo.play().catch(err => {
                  console.log('Auto-play geblokkeerd door browser, gebruiker moet handmatig starten:', err);
                });
              }
              if (elements.presentationNoVideo) {
                elements.presentationNoVideo.style.display = "none";
              }
            } catch (error) {
              console.warn("Video laden mislukt in audio-mixed mode", error);
              if (elements.presentationVideo) elements.presentationVideo.style.display = "none";
              if (elements.presentationNoVideo) elements.presentationNoVideo.style.display = "block";
            }
          })();
        } else {
          // Geen video: toon placeholder
          if (elements.presentationVideo) {
            elements.presentationVideo.pause();
            elements.presentationVideo.removeAttribute("src");
          }
          if (elements.presentationNoVideo) {
            elements.presentationNoVideo.style.display = "block";
          }
        }
      }
      // Anders wordt image geladen door updatePresentationSlide hieronder
      
      // Update prompts/translations en image (als preferredMediaType = 'image')
      updatePresentationSlide(state, elements, t);
      
      // Update container visibility voor mixed mode
      updateMixedModeContainers();
    } else {
      // Audio + image: update image slide
      updatePresentationSlide(state, elements, t);
    }
  } else {
    // Standaard image modus: gebruik standaard updatePresentationSlide
    updatePresentationSlide(state, elements, t);
  }
}

/**
 * Wrapper: roept modules/presentation.js nextSlide aan
 */
function nextSlideWrapper() {
  if (state.presentationMode.videoMode && state.presentationMode.videoTimeline) {
    // In video modus: ga naar volgende segment
    const timeline = state.presentationMode.videoTimeline;
    if (timeline.currentSegmentIndex < timeline.segments.length - 1) {
      timeline.currentSegmentIndex++;
      updatePresentationSlideWrapper();
    }
  } else {
    // In image modus: gebruik standaard nextSlide
    const moved = nextSlide(state);
    if (moved) {
      updatePresentationSlideWrapper();
      // Update container visibility in mixed mode
      updateMixedModeContainers();
    }
  }
}

/**
 * Wrapper: roept modules/presentation.js prevSlide aan
 */
function prevSlideWrapper() {
  if (state.presentationMode.videoMode && state.presentationMode.videoTimeline) {
    // In video modus: ga naar vorige segment
    const timeline = state.presentationMode.videoTimeline;
    if (timeline.currentSegmentIndex > 0) {
      timeline.currentSegmentIndex--;
      updatePresentationSlideWrapper();
    }
  } else {
    // In image modus: gebruik standaard prevSlide
    const moved = prevSlide(state);
    if (moved) {
      updatePresentationSlideWrapper();
      // Update container visibility in mixed mode
      updateMixedModeContainers();
    }
  }
}

/**
 * Update image/video container visibility in mixed mode
 */
function updateMixedModeContainers() {
  if (!state.presentationMode.audioMode) return;
  
  const mode = elements.presentationMode ? elements.presentationMode.value : 'audio-image';
  if (mode !== 'audio-mixed') return;
  
  const imageContainer = document.querySelector('.slide-image-container');
  const videoContainer = document.querySelector('.slide-video-container');
  
  if (!imageContainer || !videoContainer) return;
  
  // Zoek de juiste scene op basis van audioMarkerIndex
  const currentSlideIndex = state.presentationMode.currentSlide;
  const currentPrompt = state.projectData.prompts.find(p => 
    p.isAudioLinked && p.audioMarkerIndex === currentSlideIndex
  ) || state.projectData.prompts[currentSlideIndex];
  
  const useVideo = currentPrompt && currentPrompt.preferredMediaType === 'video';
  
  imageContainer.dataset.active = useVideo ? "false" : "true";
  videoContainer.dataset.active = useVideo ? "true" : "false";
}

/**
 * Wrapper: roept modules/presentation.js setPresentationLanguage aan
 */
function setPresentationLanguageWrapper(lang) {
  setPresentationLanguage(lang, state);
  updatePresentationSlideWrapper(); // Update display met nieuwe taal
}

/**
 * Wrapper: roept modules/presentation.js closePresentationMode aan
 */
function closePresentationModeWrapper() {
  closePresentationMode(state, elements);
}

/**
 * Open delete confirmation dialog
 */
function openDeleteProjectDialog() {
  if (!state.projectData) return;
  if (elements.deleteProjectDialog) {
    applyTranslations(elements.deleteProjectDialog);
    elements.deleteProjectDialog.showModal();
  }
}

/**
 * Delete current project: remove from filesystem and UI
 */
async function deleteCurrentProject() {
  if (!state.projectData || !state.projectenHandle) return;

  const projectId = state.projectData.id;
  const projectSlug = state.indexData.projects.find((p) => p.id === projectId)?.slug;
  
  if (!projectSlug) throw new Error("Project niet gevonden in index");

  try {
    // Step 1: Remove from index FIRST (this prevents sync from trying to read it)
    state.indexData.projects = state.indexData.projects.filter((p) => p.id !== projectId);
    await writeJsonFile(state.indexHandle, state.indexData);

    // Step 2: Try to delete the filesystem directory
    try {
      await state.projectenHandle.removeEntry(projectSlug, { recursive: true });
    } catch (error) {
      // Even if filesystem delete fails, we already removed it from the index
      // so it won't cause sync errors
      console.warn(`Kon projectmap '${projectSlug}' niet verwijderen, maar is uit index verwijderd`, error);
    }

    // Step 3: Reset UI
    state.selectedProjectId = null;
    state.projectHandle = null;
    state.projectImagesHandle = null;
    state.projectData = null;
    state.isDirty = false;

    // Step 4: Hide editor
    elements.projectEditor.classList.add("hidden");
    elements.projectEmptyState.classList.remove("hidden");
    updateRootUi();

    // Step 5: Refresh list (safe now - project is not in index)
    renderProjectList();

    // Step 6: Show success dialog
    showSuccess(t("alerts.projectDeleted"), "Het project is uit de verkenner verwijderd.");
  } catch (error) {
    showError(t("errors.deleteProject"), error);
  }
}

/**
 * Koppelt een afbeelding aan een prompt door het bestand naar de images-map te schrijven.
 */
/**
 * Wrapper: roept modules/scenes.js assignImageToPrompt aan
 */
async function assignImageToPromptWrapper(promptId, file, uploader) {
  await assignImageToPrompt(promptId, file, state, uploader, imageMap);
  
  // UI feedback (preview update)
  if (uploader && file) {
    const previewImg = uploader.querySelector("img");
    const placeholder = uploader.querySelector(".placeholder");
    if (placeholder) placeholder.textContent = file.name || t("prompt.imageAddedFallback");
    if (previewImg) {
      const blobUrl = URL.createObjectURL(file);
      previewImg.src = blobUrl;
    }
  }
  
  flagProjectDirty();
}

/**
 * Wrapper: roept modules/scenes.js removeImageFromPrompt aan
 */
async function removeImageFromPromptWrapper(promptId, uploader) {
  await removeImageFromPrompt(promptId, state, uploader, imageMap);
  
  // UI feedback (reset preview)
  if (uploader) {
    uploader.dataset.hasImage = "false";
    const previewImg = uploader.querySelector("img");
    const placeholder = uploader.querySelector(".placeholder");
    if (placeholder) placeholder.textContent = t("prompt.placeholderImage");
    if (previewImg) previewImg.removeAttribute("src");
  }
  
  flagProjectDirty();
}

/**
 * Wrapper: roept modules/scenes.js assignVideoToPrompt aan
 */
async function assignVideoToPromptWrapper(promptId, file, uploader) {
  await assignVideoToPrompt(promptId, file, state, videoMap);
  
  // UI feedback (preview update)
  if (uploader && file) {
    uploader.dataset.hasVideo = "true";
    const videoPreview = uploader.querySelector("video");
    const placeholder = uploader.querySelector(".placeholder");
    if (placeholder) placeholder.textContent = file.name || "Video toegevoegd";
    if (videoPreview) {
      const blobUrl = URL.createObjectURL(file);
      videoPreview.src = blobUrl;
      videoPreview.load(); // Herlaad video element
    }
  }
  
  flagProjectDirty();
}

/**
 * Wrapper: roept modules/scenes.js removeVideoFromPrompt aan
 */
async function removeVideoFromPromptWrapper(promptId, uploader) {
  await removeVideoFromPrompt(promptId, state, videoMap);
  
  // UI feedback (reset preview)
  if (uploader) {
    uploader.dataset.hasVideo = "false";
    const videoPreview = uploader.querySelector("video");
    const placeholder = uploader.querySelector(".placeholder");
    if (placeholder) placeholder.textContent = "Sleep hier een video (MP4 / WebM)";
    if (videoPreview) {
      videoPreview.removeAttribute("src");
      videoPreview.load(); // Reset video element
    }
  }
  
  flagProjectDirty();
}

/**
 * Markeer project als gewijzigd zodat de gebruiker weet dat opslaan nodig is.
 */
function flagProjectDirty({ refreshEditor = true, refreshList = true } = {}) {
  state.isDirty = true;
  if (state.projectData) {
    state.projectData.updatedAt = new Date().toISOString();
  }
  updateProjectIndexEntry();
  if (refreshList) {
    renderProjectList();
  }
  if (refreshEditor) {
    renderProjectEditor();
  } else {
    refreshProjectMetaDisplay();
    refreshActiveProjectListItem();
  }
}

/**
 * Nieuw project aanmaken en benodigde mappen/files schrijven.
 */
async function createProject(event) {
  event.preventDefault();
  if (!state.rootHandle || !state.projectenHandle) return;

  const projectName = elements.projectName.value.trim();
  if (!projectName) {
    showError(t("errors.projectNameRequired"));
    return;
  }

  const rawSlug = slugify(projectName);
  let slug = rawSlug;
  let counter = 1;
  const existingSlugs = new Set(state.indexData.projects.map((project) => project.slug));
  while (existingSlugs.has(slug)) {
    slug = `${rawSlug}-${counter++}`;
  }

  const createdAt = new Date().toISOString();
  const projectDir = await state.projectenHandle.getDirectoryHandle(slug, { create: true });
  const imagesDir = await projectDir.getDirectoryHandle("images", { create: true });
  await imagesDir;

  const projectJsonHandle = await projectDir.getFileHandle("project.json", { create: true });
  const projectId = uuid();
  const projectData = {
    id: projectId,
    projectName,
    videoGenerator: elements.projectGenerator.value.trim(),
    notes: elements.projectNotes.value.trim(),
    createdAt,
    updatedAt: createdAt,
    prompts: [],
  };

  await writeJsonFile(projectJsonHandle, projectData);

  state.indexData.projects.push({
    id: projectId,
    projectName,
    slug,
    createdAt,
    updatedAt: createdAt,
    promptCount: 0,
    videoGenerator: projectData.videoGenerator,
    notes: projectData.notes,
  });
  await writeJsonFile(state.indexHandle, state.indexData);

  elements.projectForm.reset();
  renderProjectList();
  await openProject(projectId);
}

/**
 * Duplicate current project into a new project directory.
 * Opens a dialog where the user can enter a name; the dialog confirm
 * handler calls doCopyProject(name) to perform the duplication.
 */
async function copyProject() {
  // Open the copy-project dialog and prefill the suggested name.
  if (!state.projectData || !state.projectenHandle) return;
  const defaultName = `${state.projectData.projectName} (copy)`;
  if (elements.copyProjectName) elements.copyProjectName.value = defaultName;
  if (elements.copyProjectDialog) elements.copyProjectDialog.showModal();
}

/**
 * Perform the actual project duplication into a new project directory.
 * This is extracted so the dialog confirm handler can call it.
 */
async function doCopyProject(newName) {
  if (!state.projectData || !state.projectenHandle) throw new Error("Geen actief project of projectenmap");
  const slugBase = slugify(newName);
  const existing = new Set(state.indexData.projects.map((p) => p.slug));
  let slug = slugBase;
  let i = 1;
  while (existing.has(slug)) {
    slug = `${slugBase}-${i++}`;
  }

  const projectDir = await state.projectenHandle.getDirectoryHandle(slug, { create: true });
  const imagesDir = await projectDir.getDirectoryHandle("images", { create: true });
  const videosDir = await projectDir.getDirectoryHandle("videos", { create: true });
  const projectJsonHandle = await projectDir.getFileHandle("project.json", { create: true });
  const newProjectId = uuid();
  const createdAt = new Date().toISOString();
  const newProjectData = {
    id: newProjectId,
    projectName: newName,
    videoGenerator: state.projectData.videoGenerator ?? "",
    notes: state.projectData.notes ?? "",
    createdAt,
    updatedAt: createdAt,
    prompts: [],
  };

  // Copy prompts and images
  for (const p of state.projectData.prompts) {
    const newPrompt = {
      id: uuid(),
      text: p.text ?? "",
      translation: p.translation ?? "",
      imagePath: null,
      imageOriginalName: p.imageOriginalName ?? null,
      imageType: p.imageType ?? null,
      videoPath: null,
      videoOriginalName: p.videoOriginalName ?? null,
      videoType: p.videoType ?? null,
      rating: p.rating ?? null,
    };
    if (p.imagePath && state.projectImagesHandle) {
      try {
        const sourceHandle = await state.projectImagesHandle.getFileHandle(p.imagePath);
        const sourceFile = await sourceHandle.getFile();
        const extension = p.imagePath.split('.').pop();
        const targetFilename = `${newPrompt.id}.${extension}`;
        const targetHandle = await imagesDir.getFileHandle(targetFilename, { create: true });
        const writable = await targetHandle.createWritable();
        await writable.write(await sourceFile.arrayBuffer());
        await writable.close();
        newPrompt.imagePath = targetFilename;
      } catch (error) {
        console.warn("Kopiëren van afbeelding voor project duplicatie mislukt", error);
      }
    }
    // Copy video if exists
    if (p.videoPath && state.projectVideosHandle) {
      try {
        const sourceHandle = await state.projectVideosHandle.getFileHandle(p.videoPath);
        const sourceFile = await sourceHandle.getFile();
        const extension = p.videoPath.split('.').pop();
        const targetFilename = `${newPrompt.id}.${extension}`;
        const targetHandle = await videosDir.getFileHandle(targetFilename, { create: true });
        const writable = await targetHandle.createWritable();
        await writable.write(await sourceFile.arrayBuffer());
        await writable.close();
        newPrompt.videoPath = targetFilename;
      } catch (error) {
        console.warn("Kopiëren van video voor project duplicatie mislukt", error);
      }
    }
    newProjectData.prompts.push(newPrompt);
  }

  await writeJsonFile(projectJsonHandle, newProjectData);

  state.indexData.projects.push({
    id: newProjectId,
    projectName: newName,
    slug,
    createdAt,
    updatedAt: createdAt,
    promptCount: newProjectData.prompts.length,
    videoGenerator: newProjectData.videoGenerator,
    notes: newProjectData.notes,
  });
  await writeJsonFile(state.indexHandle, state.indexData);
  renderProjectList();
  // open the new project
  await openProject(newProjectId);
}

/**
 * Opent een project en laadt alle data.
 */
async function openProject(projectId) {
  if (!state.projectenHandle) throw new Error("Projectenmap niet beschikbaar");
  const projectMeta = state.indexData.projects.find((project) => project.id === projectId);
  if (!projectMeta) throw new Error("Project niet gevonden");

  const projectDir = await state.projectenHandle.getDirectoryHandle(projectMeta.slug, { create: false });
  const imagesDir = await projectDir.getDirectoryHandle("images", { create: true });
  const videosDir = await projectDir.getDirectoryHandle("videos", { create: true }); // ⭐ NIEUW: videos folder
  const attachmentsDir = await projectDir.getDirectoryHandle("attachments", { create: true }); // ⭐ NIEUW: attachments folder
  const projectFile = await projectDir.getFileHandle("project.json", { create: false });

  const projectData = await readJsonFile(projectFile);
  // Zorg dat verplichte velden bestaan voor oudere versies
  projectData.prompts ??= [];
  projectData.transitions ??= []; // ⭐ NIEUW: transitions field
  // Backwards compatibility: oudere projecten kunnen geen rating hebben
  projectData.prompts.forEach((p) => {
    if (p.rating === undefined) p.rating = null;
    if (p.videoPath === undefined) p.videoPath = null; // ⭐ NIEUW: video fields
    if (p.videoOriginalName === undefined) p.videoOriginalName = null;
    if (p.videoType === undefined) p.videoType = null;
    if (p.attachments === undefined) p.attachments = []; // ⭐ NIEUW: attachments field
    if (p.preferredMediaType === undefined) p.preferredMediaType = 'image'; // ⭐ NIEUW: audio timeline media type
  });
  projectData.createdAt ??= projectMeta.createdAt;
  projectData.updatedAt ??= projectMeta.updatedAt;
  projectData.videoGenerator ??= projectMeta.videoGenerator ?? "";
  projectData.notes ??= projectMeta.notes ?? "";

  state.selectedProjectId = projectId;
  state.projectHandle = projectFile;
  state.projectDirHandle = projectDir; // ⭐ NIEUW: bewaar project directory handle
  state.projectImagesHandle = imagesDir;
  state.projectVideosHandle = videosDir; // ⭐ NIEUW: stel videos handle in
  state.projectAttachmentsHandle = attachmentsDir; // ⭐ NIEUW: stel attachments handle in
  state.projectData = projectData;
  state.isDirty = false;
  state.currentMediaViewMode = null; // ⭐ RESET: media view mode bij nieuw project

  imageMap.clear();
  videoMap.clear(); // ⭐ NIEUW: clear video cache
  projectData.prompts.forEach((prompt) => {
    if (prompt.imagePath) {
      imageMap.set(prompt.id, { filename: prompt.imagePath });
    }
    if (prompt.videoPath) { // ⭐ NIEUW: populate video cache
      videoMap.set(prompt.id, { filename: prompt.videoPath });
    }
  });

  console.log("Project geladen, check audio timeline:", projectData.audioTimeline ? "JA" : "NEE");

  // Reset audio timeline eerst
  resetAudioTimeline();
  
  // Reset audio video editor ook
  resetAudioVideoEditor();
  
  // Set project handle altijd (ook als er nog geen audio timeline is)
  setAudioProjectHandle(projectDir);
  
  // Registreer callbacks altijd (ook als er nog geen audio timeline is)
  setSceneCallbacks(
    handleSceneCreateFromMarker,
    handleSceneDeleteFromMarker,
    handleSceneReorderFromMarkers,
    getUnlinkedScenes,
    handleEditSceneFromMarker,
    getAllScenes
  );
  
  // Laad audio timeline data indien aanwezig
  if (projectData.audioTimeline) {
    console.log("Audio timeline gevonden, verwerk data...");
    
    // FIX: Valideer en repareer duplicate marker assignments
    fixDuplicateMarkerAssignments(projectData);
    
    await restoreAudioTimelineData(projectData.audioTimeline, projectDir);
    
    // Sync scenes met markers - creëer ontbrekende scenes
    syncScenesWithMarkers(projectData.audioTimeline.markers, projectData.audioTimeline.audioDuration);
    
    // Sorteer scenes op basis van audio marker volgorde
    sortScenesByAudioMarkers();
    
    // Forceer refresh van markers display nu callbacks beschikbaar zijn
    refreshMarkersDisplay();
    
    // ALTIJD: Zorg dat audio timeline container hidden is na project load
    const audioContainer = document.querySelector("#audio-timeline-container");
    if (audioContainer) {
      audioContainer.classList.add("hidden");
    }
  }

  renderProjectList();
  renderProjectEditor();
  updateRootUi();
  
  // Update audio timeline button NADAT renderProjectEditor() is aangeroepen
  // (renderProjectEditor roept applyTranslations aan die de button innerHTML overschrijft)
  if (projectData.audioTimeline) {
    const audioBtn = document.querySelector("#toggle-audio-timeline");
    
    if (audioBtn) {
      audioBtn.classList.add("has-audio");
      audioBtn.textContent = "🎵 Audio Timeline ✓";
      
      // Voeg badge element toe (kan niet in HTML blijven want wordt overschreven door applyTranslations)
      let badge = audioBtn.querySelector("#audio-timeline-info-badge");
      if (!badge) {
        badge = document.createElement("span");
        badge.id = "audio-timeline-info-badge";
        badge.textContent = "!";
        audioBtn.appendChild(badge);
        
        // Maak badge klikbaar - toon info dialog
        badge.addEventListener("click", (event) => {
          event.stopPropagation(); // Voorkom dat toggle-audio-timeline wordt getriggerd
          const infoDialog = document.querySelector("#audio-timeline-info-dialog");
          if (infoDialog) {
            applyTranslations(infoDialog);
            infoDialog.showModal();
          }
        });
      }
      badge.classList.add("visible");
      
      console.log("Badge dynamisch toegevoegd en zichtbaar gemaakt");
    }
  } else {
    const audioBtn = document.querySelector("#toggle-audio-timeline");
    const audioInfoBadge = audioBtn?.querySelector("#audio-timeline-info-badge");
    
    if (audioBtn) {
      audioBtn.classList.remove("has-audio");
      audioBtn.textContent = "🎵 Audio Timeline";
    }
    if (audioInfoBadge) {
      audioInfoBadge.classList.remove("visible");
    }
  }
}

/**
 * Prompt toevoegen aan huidige project.
 */
/**
 * Fix duplicate marker assignments - zorg dat elke marker maximaal 1 scene heeft
 */
function fixDuplicateMarkerAssignments(projectData) {
  if (!projectData?.prompts || !projectData?.audioTimeline?.markers) {
    return;
  }

  const markerMap = new Map(); // markerIndex -> scene ids
  const duplicates = [];

  // Scan alle scenes voor duplicate marker assignments
  projectData.prompts.forEach((prompt, index) => {
    if (prompt.isAudioLinked && prompt.audioMarkerIndex !== undefined) {
      const markerIndex = prompt.audioMarkerIndex;
      
      if (!markerMap.has(markerIndex)) {
        markerMap.set(markerIndex, []);
      }
      
      markerMap.get(markerIndex).push({ prompt, index });
    }
  });

  // Zoek markers met meerdere scenes
  markerMap.forEach((scenes, markerIndex) => {
    if (scenes.length > 1) {
      console.warn(`⚠️ Marker ${markerIndex} heeft ${scenes.length} scenes gekoppeld:`, scenes.map(s => s.prompt.id));
      duplicates.push({ markerIndex, scenes });
    }
  });

  if (duplicates.length === 0) {
    return; // Geen duplicates
  }

  // FIX: Houd alleen de EERSTE scene per marker, ontkoppel de rest
  duplicates.forEach(({ markerIndex, scenes }) => {
    // Skip eerste scene (blijft gekoppeld)
    for (let i = 1; i < scenes.length; i++) {
      const { prompt, index } = scenes[i];
      
      // Ontkoppel deze scene
      prompt.isAudioLinked = false;
      prompt.audioMarkerIndex = undefined;
      // Verwijder timeline/duration want niet meer gekoppeld
      delete prompt.timeline;
      delete prompt.duration;
    }
  });
}

/**
 * Wrapper: roept modules/scenes.js addPrompt aan
 * @param {Object} sceneData - Optionele scene data (voor audio timeline)
 */
function addPromptWrapper(sceneData = null) {
  // Voorkom handmatig scenes toevoegen als audio timeline actief is
  if (!sceneData && state.projectData?.audioTimeline && hasAudioTimeline()) {
    alert("Scenes worden automatisch aangemaakt via markers in de Audio Timeline. Klik op de waveform om een marker (en scene) toe te voegen.");
    return null;
  }
  
  const prompt = addPrompt(state, elements, flagProjectDirty);
  
  // Als scene data meegegeven is (vanuit audio timeline), vul de velden in
  if (sceneData && prompt) {
    if (sceneData.timeline) prompt.timeline = sceneData.timeline;
    if (sceneData.duration) prompt.duration = sceneData.duration;
    if (sceneData.whatDoWeSee) prompt.whatDoWeSee = sceneData.whatDoWeSee;
    if (sceneData.howDoWeMake) prompt.howDoWeMake = sceneData.howDoWeMake;
    if (sceneData.text) prompt.text = sceneData.text;
    if (sceneData.translation) prompt.translation = sceneData.translation;
    if (sceneData.audioMarkerIndex !== undefined) prompt.audioMarkerIndex = sceneData.audioMarkerIndex;
    if (sceneData.isAudioLinked !== undefined) prompt.isAudioLinked = sceneData.isAudioLinked;
    
    // Re-render de prompts om de nieuwe data te tonen
    renderProjectEditor();
  }
  
  return prompt;
}

/**
 * Update scenes die gekoppeld zijn aan audio markers
 * Bewaar de marker TIJD bij elke scene zodat we deze kunnen terugvinden
 * BELANGRIJK: Gebruik audioMarkerTime om de marker te vinden, niet audioMarkerIndex
 */
function updateScenesFromAudioMarkers(markers, audioDuration, draggedMarkerInfo) {
  if (!state.projectData || !state.projectData.prompts) return;
  
  let hasChanges = false;
  
  // Helper functie om tijd te formatteren
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };
  
  // Update elke scene die gekoppeld is aan een marker
  state.projectData.prompts.forEach((prompt) => {
    if (prompt.isAudioLinked && prompt.audioMarkerTime !== undefined) {
      // Vind de marker tijd in de nieuwe gesorteerde markers array
      let searchTime = prompt.audioMarkerTime;
      
      // Als deze scene aan de gesleepte marker was gekoppeld, gebruik de nieuwe tijd
      if (draggedMarkerInfo && Math.abs(searchTime - draggedMarkerInfo.oldTime) < 0.01) {
        searchTime = draggedMarkerInfo.newTime;
      }
      
      // Zoek deze tijd in de markers array (met kleine tolerance)
      const newMarkerIndex = markers.findIndex(time => Math.abs(time - searchTime) < 0.01);
      
      if (newMarkerIndex >= 0) {
        // Update de marker index naar de nieuwe positie
        prompt.audioMarkerIndex = newMarkerIndex;
        
        const time = markers[newMarkerIndex];
        const nextTime = markers[newMarkerIndex + 1] || audioDuration;
        const duration = nextTime - time;
        
        const newTimeline = `${formatTime(time)} - ${formatTime(nextTime)}`;
        const newDuration = duration.toFixed(2);
        
        // Update audioMarkerTime met de (mogelijk aangepaste) tijd
        prompt.audioMarkerTime = time;
        
        // Update alleen als de waarde is veranderd
        if (prompt.timeline !== newTimeline || prompt.duration !== newDuration) {
          prompt.timeline = newTimeline;
          prompt.duration = newDuration;
          hasChanges = true;
        }
      } else {
        console.warn('Marker tijd niet gevonden voor scene:', searchTime, 'beschikbare markers:', markers);
      }
    }
  });
  
  // Als er changes zijn, re-render en markeer als dirty
  if (hasChanges) {
    renderProjectEditor();
    flagProjectDirty();
  }
}

/**
 * Callback: Creëer een scene wanneer een marker wordt toegevoegd
 */
function handleSceneCreateFromMarker(sceneData, markerIndex) {
  if (!state.projectData) return;
  
  // Voeg scene toe via addPrompt
  const prompt = addPrompt(state, elements, flagProjectDirty);
  
  // Vul scene data in
  if (sceneData && prompt) {
    prompt.timeline = sceneData.timeline;
    prompt.duration = sceneData.duration;
    prompt.whatDoWeSee = sceneData.whatDoWeSee || "";
    prompt.howDoWeMake = sceneData.howDoWeMake || "";
    prompt.text = sceneData.text;
    prompt.translation = sceneData.translation || "";
    prompt.audioMarkerIndex = markerIndex;
    prompt.isAudioLinked = true;
    // Bewaar marker tijd voor sortering (wordt opgehaald uit sceneData)
    const timeMatch = sceneData.timeline.match(/(\d+):(\d+)\.(\d+)/);
    if (timeMatch) {
      const mins = parseInt(timeMatch[1]);
      const secs = parseInt(timeMatch[2]);
      const ms = parseInt(timeMatch[3]);
      prompt.audioMarkerTime = mins * 60 + secs + ms / 100;
    }
  }
  
  // Sorteer scenes zodat de nieuwe scene op de juiste chronologische plek komt
  sortScenesByAudioMarkers();
  
  // Re-render (wordt ook al gedaan door sortScenesByAudioMarkers, maar voor de zekerheid)
  renderProjectEditor();
  flagProjectDirty();
}

/**
 * Callback: Ontkoppel een scene wanneer een marker wordt verwijderd
 * De scene blijft bestaan maar wordt "niet actief" (ontkoppeld van audio)
 */
function handleSceneDeleteFromMarker(markerIndex) {
  if (!state.projectData || !state.projectData.prompts) return;
  
  // Vind de scene met deze marker index
  const scene = state.projectData.prompts.find(
    p => p.isAudioLinked && p.audioMarkerIndex === markerIndex
  );
  
  if (scene) {
    // Ontkoppel de scene van de marker (maak het "niet actief")
    scene.isAudioLinked = false;
    scene.audioMarkerIndex = undefined;
    // Verwijder timeline en duration omdat deze niet meer van toepassing zijn
    delete scene.timeline;
    delete scene.duration;
    
    // Update alle audioMarkerIndex van scenes na deze marker
    state.projectData.prompts.forEach((prompt) => {
      if (prompt.isAudioLinked && prompt.audioMarkerIndex > markerIndex) {
        prompt.audioMarkerIndex--;
      }
    });
    
    renderProjectEditor();
    flagProjectDirty();
  }
}

/**
 * Callback: Herorden scenes wanneer markers van volgorde veranderen
 */
function handleSceneReorderFromMarkers(markers) {
  if (!state.projectData || !state.projectData.prompts) return;
  
  // Gebruik de sortScenesByAudioMarkers functie
  sortScenesByAudioMarkers();
}

/**
 * Haal ongevoppelde scenes op (scenes zonder audioMarkerIndex)
 */
function getUnlinkedScenes() {
  if (!state.projectData || !state.projectData.prompts) return [];
  
  return state.projectData.prompts
    .map((prompt, index) => ({ ...prompt, originalIndex: index }))
    .filter(prompt => !prompt.isAudioLinked);
}

/**
 * Haal ALLE scenes op met info of ze gekoppeld zijn
 */
function getAllScenes() {
  if (!state.projectData || !state.projectData.prompts) {
    return [];
  }
  
  const result = state.projectData.prompts.map((prompt, index) => ({ 
    ...prompt, 
    originalIndex: index,
    isLinked: prompt.isAudioLinked || false,
    markerIndex: prompt.audioMarkerIndex
  }));
  
  return result;
}

/**
 * Callback: Bewerk scene vanuit audio timeline marker
 */
/**
 * Maak scene aan vanuit audio editor marker
 */
function handleCreateSceneFromEditor(sceneData, markerIndex) {
  if (!state.projectData || !state.projectData.prompts) return;
  
  console.log('🎬 Creating scene from editor marker:', markerIndex, sceneData);
  
  // Check of er al een scene is voor deze marker
  const existingScene = state.projectData.prompts.find(p => 
    p.isAudioLinked && p.audioMarkerIndex === markerIndex
  );
  
  if (existingScene) {
    console.warn('Scene already exists for marker', markerIndex);
    return;
  }
  
  // Voeg scene toe via wrapper (met sceneData)
  const newPrompt = addPromptWrapper(sceneData);
  
  if (newPrompt) {
    console.log('✅ Scene created successfully:', newPrompt.id);
    
    // Update alle scenes na deze marker (hun index kan verschoven zijn)
    updateInactiveScenesAfterMarkers();
  }
}

/**
 * Update inactieve scenes (zonder marker) - voeg ze toe achteraan
 */
function updateInactiveScenesAfterMarkers() {
  if (!state.projectData || !state.projectData.prompts) return;
  
  // Sorteer scenes: eerst audio-linked (op volgorde), dan inactieve
  const activeScenes = state.projectData.prompts.filter(p => p.isAudioLinked);
  const inactiveScenes = state.projectData.prompts.filter(p => !p.isAudioLinked);
  
  // Sorteer active scenes op audioMarkerIndex
  activeScenes.sort((a, b) => (a.audioMarkerIndex || 0) - (b.audioMarkerIndex || 0));
  
  // Combineer: active eerst, daarna inactive
  state.projectData.prompts = [...activeScenes, ...inactiveScenes];
  
  // Re-render
  renderProjectEditor();
  
  console.log('📋 Scenes reordered: active scenes first, inactive scenes last');
}

/**
 * Link bestaande scene aan nieuwe marker vanuit audio editor
 */
function handleLinkSceneToMarkerFromEditor(sceneId, markerIndex, time) {
  if (!state.projectData || !state.projectData.prompts) return;
  
  const scene = state.projectData.prompts.find(p => p.id === sceneId);
  
  if (!scene) {
    console.warn('Scene not found:', sceneId);
    return;
  }
  
  // Update scene met marker info
  scene.audioMarkerIndex = markerIndex;
  scene.audioMarkerTime = time;
  scene.isAudioLinked = true;
  
  // Update timeline van scene
  const nextMarkerTime = getNextMarkerTime(markerIndex);
  scene.timeline = `${formatTime(time)} - ${formatTime(nextMarkerTime)}`;
  scene.duration = (nextMarkerTime - time).toFixed(2);
  
  state.isDirty = true;
  
  // Re-render
  updateInactiveScenesAfterMarkers();
  
  console.log('✅ Scene linked to marker:', sceneId, markerIndex);
}

/**
 * Haal de tijd van de volgende marker op (of audio duration)
 */
function getNextMarkerTime(markerIndex) {
  if (!state.projectData?.audioTimeline?.audioBuffer) return 0;
  
  const markers = state.projectData.audioTimeline.markers || [];
  const nextMarker = markers[markerIndex + 1];
  
  return nextMarker !== undefined 
    ? nextMarker 
    : state.projectData.audioTimeline.audioBuffer.duration;
}

/**
 * Edit scene vanuit audio editor marker
 */
function handleEditSceneFromMarker(markerIndex) {
  if (!state.projectData || !state.projectData.prompts) return;
  
  // Zoek de scene met deze audioMarkerIndex
  const scene = state.projectData.prompts.find(p => 
    p.isAudioLinked && p.audioMarkerIndex === markerIndex
  );
  
  if (!scene) {
    console.warn(`Geen scene gevonden voor marker ${markerIndex}`);
    return;
  }
  
  // Open de scene editor dialog
  openPromptDialog(scene.id).catch((error) => {
    showError(t("errors.openPrompt"), error);
  });
}

/**
 * Update scene media type vanuit audio editor
 */
function updateSceneMediaTypeFromEditor(markerIndex, mediaType) {
  if (!state.projectData || !state.projectData.prompts) return;
  
  // Zoek de scene met deze audioMarkerIndex
  const scene = state.projectData.prompts.find(p => 
    p.isAudioLinked && p.audioMarkerIndex === markerIndex
  );
  
  if (scene) {
    scene.preferredMediaType = mediaType;
    state.isDirty = true;
  }
}

/**
 * Haal scene media type op
 */
function getSceneMediaType(markerIndex) {
  if (!state.projectData || !state.projectData.prompts) return 'image';
  
  // Zoek de scene met deze audioMarkerIndex
  const scene = state.projectData.prompts.find(p => 
    p.isAudioLinked && p.audioMarkerIndex === markerIndex
  );
  
  return scene ? (scene.preferredMediaType || 'image') : 'image';
}

/**
 * Verstuur scene preview data naar audio editor
 */
async function sendScenePreviewToEditor(markerIndex, mediaType) {
  if (!state.projectData || !state.projectData.prompts) return;
  
  // Zoek de scene met deze audioMarkerIndex
  const scene = state.projectData.prompts.find(p => 
    p.isAudioLinked && p.audioMarkerIndex === markerIndex
  );
  
  let imageUrl = null;
  let videoUrl = null;
  
  if (scene) {
    // Laad image/video URLs
    if (mediaType === 'image' && scene.imagePath && state.projectImagesHandle) {
      try {
        const fileHandle = await state.projectImagesHandle.getFileHandle(scene.imagePath);
        const file = await fileHandle.getFile();
        imageUrl = URL.createObjectURL(file);
      } catch (error) {
        console.warn('Could not load image:', error);
      }
    } else if (mediaType === 'video' && scene.videoPath && state.projectVideosHandle) {
      try {
        const fileHandle = await state.projectVideosHandle.getFileHandle(scene.videoPath);
        const file = await fileHandle.getFile();
        videoUrl = URL.createObjectURL(file);
      } catch (error) {
        console.warn('Could not load video:', error);
      }
    }
  }
  
  // Verstuur response
  const event = new CustomEvent('scenePreviewResponse', {
    detail: {
      markerIndex,
      mediaType,
      imageUrl,
      videoUrl
    }
  });
  document.dispatchEvent(event);
}

/**
 * Update marker positie vanuit audio editor
 */
function updateMarkerPositionFromEditor(markerIndex, newTime) {
  if (!state.projectData || !state.projectData.prompts) return;
  
  // Zoek de scene met deze audioMarkerIndex
  const scene = state.projectData.prompts.find(p => 
    p.isAudioLinked && p.audioMarkerIndex === markerIndex
  );
  
  if (scene) {
    console.log(`🎯 Updating marker ${markerIndex} position to ${newTime.toFixed(2)}s`);
    
    // Update marker tijd in audio timeline module
    updateAudioMarkerTime(markerIndex, newTime);
  }
}

/**
 * Handle marker volgorde wijziging vanuit audio editor
 */
function handleMarkerReorderFromEditor(oldIndex, newIndex) {
  if (!state.projectData || !state.projectData.prompts) return;
  
  console.log(`🔄 Reordering marker from ${oldIndex} to ${newIndex}`);
  
  // Vind de scene die verplaatst moet worden
  const sceneToMove = state.projectData.prompts.find(p => 
    p.isAudioLinked && p.audioMarkerIndex === oldIndex
  );
  
  if (!sceneToMove) {
    console.warn(`Scene niet gevonden voor oude marker index ${oldIndex}`);
    return;
  }
  
  console.log(`📌 Moving scene "${sceneToMove.prompt?.substring(0, 30)}..." from marker ${oldIndex} to ${newIndex}`);
  
  // Update audioMarkerIndex van de verplaatste scene
  sceneToMove.audioMarkerIndex = newIndex;
  
  // Update alle andere scenes die tussen oldIndex en newIndex vallen
  state.projectData.prompts.forEach(scene => {
    if (!scene.isAudioLinked || scene === sceneToMove) return;
    
    if (oldIndex < newIndex) {
      // Scene verschuift naar rechts, scenes ertussen schuiven naar links
      if (scene.audioMarkerIndex > oldIndex && scene.audioMarkerIndex <= newIndex) {
        console.log(`  ⬅️ Scene marker ${scene.audioMarkerIndex} → ${scene.audioMarkerIndex - 1}`);
        scene.audioMarkerIndex--;
      }
    } else if (oldIndex > newIndex) {
      // Scene verschuift naar links, scenes ertussen schuiven naar rechts
      if (scene.audioMarkerIndex >= newIndex && scene.audioMarkerIndex < oldIndex) {
        console.log(`  ➡️ Scene marker ${scene.audioMarkerIndex} → ${scene.audioMarkerIndex + 1}`);
        scene.audioMarkerIndex++;
      }
    }
  });
  
  // Sorteer scenes op basis van nieuwe audioMarkerIndex
  sortScenesByAudioMarkers();
  
  console.log('✅ Marker reorder completed');
}

/**
 * Sync scenes met markers - zorg dat er voor elke marker een scene is
 */
function syncScenesWithMarkers(markers, audioDuration) {
  if (!state.projectData || !markers) return;
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };
  
  // Update bestaande audio-linked scenes met nieuwe timeline/duration
  state.projectData.prompts.forEach(prompt => {
    if (prompt.isAudioLinked && prompt.audioMarkerIndex !== undefined) {
      const markerIndex = prompt.audioMarkerIndex;
      const time = markers[markerIndex];
      
      if (time !== undefined) {
        // Update timeline en duration
        const nextTime = markers[markerIndex + 1] || audioDuration;
        const duration = nextTime - time;
        
        prompt.timeline = `${formatTime(time)} - ${formatTime(nextTime)}`;
        prompt.duration = duration.toFixed(2);
      }
    }
  });
  
  // Check welke markers scenes nodig hebben
  markers.forEach((time, markerIndex) => {
    const hasScene = state.projectData.prompts.some(p => p.isAudioLinked && p.audioMarkerIndex === markerIndex);
    
    if (!hasScene) {
      // Creëer scene voor deze marker
      const nextTime = markers[markerIndex + 1] || audioDuration;
      const duration = nextTime - time;
      
      const prompt = addPrompt(state, elements, flagProjectDirty);
      if (prompt) {
        prompt.timeline = `${formatTime(time)} - ${formatTime(nextTime)}`;
        prompt.duration = duration.toFixed(2);
        prompt.text = `Scene ${markerIndex + 1}`;
        prompt.audioMarkerIndex = markerIndex;
        prompt.isAudioLinked = true;
        prompt.whatDoWeSee = "";
        prompt.howDoWeMake = "";
        prompt.translation = "";
      }
    }
  });
  
  // Verwijder audio scenes zonder corresponderende marker
  const markersSet = new Set(markers.map((_, idx) => idx));
  const scenesToRemove = [];
  
  state.projectData.prompts.forEach((prompt, idx) => {
    if (prompt.isAudioLinked && !markersSet.has(prompt.audioMarkerIndex)) {
      scenesToRemove.push(idx);
    }
  });
  
  // Verwijder van achter naar voren om indices niet te verknallen
  scenesToRemove.reverse().forEach(idx => {
    state.projectData.prompts.splice(idx, 1);
  });
  
  if (scenesToRemove.length > 0) {
    renderProjectEditor();
  }
}

/**
 * Sorteer scenes in prompts array op basis van audio marker volgorde
 * Gebruikt audioMarkerTime (de marker tijd) in plaats van audioMarkerIndex
 * Scenes gekoppeld aan markers worden gesorteerd op marker tijdstip
 * Ongekoppelde scenes blijven aan het eind
 */
function sortScenesByAudioMarkers() {
  if (!state.projectData || !state.projectData.prompts) return;
  
  // Alleen sorteren als er audio timeline is
  if (!hasAudioTimeline()) return;
  
  // Get markers from audio timeline
  const audioData = getAudioTimelineData();
  if (!audioData || !audioData.markers) return;
  
  const markers = audioData.markers; // Deze zijn al gesorteerd op tijd
  
  console.log('🔄 Sorting scenes by audio markers...', { 
    totalScenes: state.projectData.prompts.length,
    markers: markers.length
  });
  
  // Splits scenes in gekoppeld en ongekoppeld
  const linkedScenes = [];
  const unlinkedScenes = [];
  
  state.projectData.prompts.forEach((prompt) => {
    if (prompt.isAudioLinked && prompt.audioMarkerIndex !== undefined) {
      linkedScenes.push(prompt);
    } else {
      unlinkedScenes.push(prompt);
    }
  });
  
  console.log('📊 Linked scenes:', linkedScenes.length, 'Unlinked scenes:', unlinkedScenes.length);
  
  // Sorteer gekoppelde scenes op basis van hun audioMarkerIndex
  linkedScenes.sort((a, b) => {
    const indexA = a.audioMarkerIndex ?? 999999;
    const indexB = b.audioMarkerIndex ?? 999999;
    return indexA - indexB;
  });
  
  // Update audioMarkerTime naar de correcte tijd van hun marker (voor backwards compatibility)
  linkedScenes.forEach(scene => {
    const markerIndex = scene.audioMarkerIndex;
    if (markerIndex >= 0 && markerIndex < markers.length) {
      scene.audioMarkerTime = markers[markerIndex];
    }
  });
  
  // Combineer: eerst gekoppelde scenes (gesorteerd op marker index), dan ongekoppelde
  state.projectData.prompts = [...linkedScenes, ...unlinkedScenes];
  
  console.log('✅ Scenes sorted:', linkedScenes.map(s => `Scene ${s.audioMarkerIndex}`).join(', '));
  
  // Update UI (zowel storyboard als audio timeline markers)
  renderProjectEditor();
  
  // Update ook de markers display in de audio timeline
  if (hasAudioTimeline()) {
    refreshMarkersDisplay();
  }
  
  state.isDirty = true;
}

/**
 * Koppel een bestaande scene aan een marker
 * sceneIndex is de originalIndex (positie in de volledige prompts array)
 */
function handleLinkSceneToMarker(sceneIndex, markerIndex, time) {
  if (!state.projectData || !state.projectData.prompts) return;
  
  // sceneIndex is de originalIndex in de prompts array
  if (sceneIndex >= state.projectData.prompts.length) return;
  
  const scene = state.projectData.prompts[sceneIndex];
  
  // Check of deze scene niet al gekoppeld is
  if (scene.isAudioLinked) {
    console.warn('Scene is al gekoppeld aan een marker');
    return;
  }
  
  // Helper voor tijd formattering
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };
  
  // Haal marker data op via getAudioTimelineData
  const audioData = getAudioTimelineData();
  if (!audioData) return;
  
  const markers = audioData.markers;
  const nextTime = markers[markerIndex + 1] || audioData.audioDuration;
  const duration = nextTime - time;
  
  // Update scene met audio link
  state.projectData.prompts[sceneIndex].isAudioLinked = true;
  state.projectData.prompts[sceneIndex].audioMarkerIndex = markerIndex;
  state.projectData.prompts[sceneIndex].timeline = `${formatTime(time)} - ${formatTime(nextTime)}`;
  state.projectData.prompts[sceneIndex].duration = duration.toFixed(2);
  state.projectData.prompts[sceneIndex].audioMarkerTime = time; // Bewaar marker tijd
  
  // Sorteer scenes zodat de nieuwe actieve scene op de juiste plek komt
  sortScenesByAudioMarkers();
  
  // Re-render (wordt ook al gedaan door sortScenesByAudioMarkers, maar voor de zekerheid)
  renderProjectEditor();
  flagProjectDirty();
}

/**
 * Slaat de huidige projectdata op.
 */
async function saveProject() {
  if (!state.projectHandle || !state.projectData) return;
  try {
    state.projectData.updatedAt = new Date().toISOString();
    
    // Sla audio timeline data op
    const audioData = getAudioTimelineData();
    if (audioData) {
      state.projectData.audioTimeline = audioData;
    } else if (state.projectData.audioTimeline) {
      // Verwijder audio timeline als het niet meer actief is
      delete state.projectData.audioTimeline;
    }
    
    await writeJsonFile(state.projectHandle, state.projectData);
    state.isDirty = false;
    updateProjectIndexEntry();
    await writeJsonFile(state.indexHandle, state.indexData);
    renderProjectList();
    renderProjectEditor();
  } catch (error) {
    showError(t("errors.saveProject"), error);
  }
}

/**
 * Synchroniseert de indexinformatie met de actuele projectstatus.
 */
function updateProjectIndexEntry() {
  const entry = state.indexData.projects.find((project) => project.id === state.projectData.id);
  if (!entry) return;
  entry.projectName = state.projectData.projectName;
  entry.updatedAt = state.projectData.updatedAt;
  entry.createdAt = state.projectData.createdAt;
  entry.promptCount = state.projectData.prompts.length;
  entry.videoGenerator = state.projectData.videoGenerator;
  entry.notes = state.projectData.notes;
  entry.hasAudioTimeline = state.projectData.audioTimeline ? true : false;
}

/**
 * Exporteert prompts naar klembord en naar een tekstbestand zonder lege regels binnen een prompt.
 */
async function exportPrompts() {
  // Backwards-compatible wrapper: default to exporting prompts
  return exportPromptsMode("prompts");
}

// Mode-aware export: 'prompts' or 'notes'
async function exportPromptsMode(mode = "prompts") {
  if (!state.projectData || !state.projectHandle) return;
  try {
    const items = Array.isArray(state.projectData.prompts) ? state.projectData.prompts : [];
    const lines = items
      .map((p) => (mode === "notes" ? (p.translation ?? "") : (p.text ?? "")))
      .map((s) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim() : ""))
      .filter((s) => s.length > 0);

    if (!lines.length) {
      showError(t("errors.noPrompts"));
      return;
    }

    state.pendingExportText = lines.join("\n\n");
    state.pendingExportCount = lines.length;
    state.pendingExportMode = mode;
    if (elements.exportPreviewText) {
      elements.exportPreviewText.value = state.pendingExportText;
    }
    updateExportPreviewInfo();
    applyTranslations(elements.exportPreviewDialog);
    if (elements.exportPreviewDialog) {
      elements.exportPreviewDialog.returnValue = "";
      elements.exportPreviewDialog.showModal();
    }
  } catch (error) {
    showError(t("errors.exportPrompts"), error);
  }
}

function updateExportPreviewInfo(customKey, vars = {}) {
  if (!elements.exportPreviewInfo) return;
  if (customKey) {
    elements.exportPreviewInfo.textContent = t(customKey, vars);
    return;
  }
  elements.exportPreviewInfo.textContent = t("exportPreview.description");
}

async function copyToClipboard(text) {
  if (!navigator.clipboard?.writeText) {
    throw new Error(t("info.clipboardNotSupported"));
  }
  await navigator.clipboard.writeText(text);
}

async function finalizePromptExport() {
  if (!state.pendingExportText || !state.projectHandle) return;
  const text = state.pendingExportText;
  let copySucceeded = true;
  try {
    await copyToClipboard(text);
  } catch (error) {
    copySucceeded = false;
    showError(t("errors.copyFailed"), error);
  }

  let saveSucceeded = false;
  try {
    const parentDir = await getCurrentProjectDir();
    const exportFile = await parentDir.getFileHandle("prompts_export.txt", { create: true });
    await writeTextFile(exportFile, text);
    saveSucceeded = true;
  } catch (error) {
    showError(t("errors.exportPrompts"), error);
  }

  if (copySucceeded && saveSucceeded && elements.exportDialog && !elements.exportDialog.open) {
    applyTranslations(elements.exportDialog);
    elements.exportDialog.showModal();
  }

  state.pendingExportText = null;
  state.pendingExportCount = 0;
  updateExportPreviewInfo();
}

async function handleExportPreviewCopy() {
  if (!state.pendingExportText) return;
  try {
    await copyToClipboard(state.pendingExportText);
    updateExportPreviewInfo("exportPreview.copied");
  } catch (error) {
    showError(t("errors.copyFailed"), error);
  }
}

function handleExportPreviewClose() {
  if (!elements.exportPreviewDialog) return;
  const { returnValue } = elements.exportPreviewDialog;
  if (returnValue === "save") {
    finalizePromptExport().catch((error) => showError(t("errors.exportPrompts"), error));
  } else {
    state.pendingExportText = null;
    state.pendingExportCount = 0;
    updateExportPreviewInfo();
  }
}

/**
 * Exporteert alle afbeeldingen in volgorde naar scene_images_[PROJECTNAAM].
 */
async function exportImages() {
  if (!state.projectData || !state.projectHandle) return;
  try {
    const parentDir = await getCurrentProjectDir();
    const slug = state.indexData.projects.find((project) => project.id === state.projectData.id)?.slug;
    const exportDirName = `scene_images_${slug}`;
    const exportDir = await parentDir.getDirectoryHandle(exportDirName, { create: true });

    // Verzamel eerst welke nummers we gaan schrijven, dan verwijder we alleen ongebruikte oude bestanden
    const newFileNumbers = new Set();
    let counter = 1;
    
    // Eerste pass: bepaal welke afbeeldingen we gaan exporteren
    for (const prompt of state.projectData.prompts) {
      if (prompt.imagePath && state.projectImagesHandle) {
        try {
          await state.projectImagesHandle.getFileHandle(prompt.imagePath);
          newFileNumbers.add(counter);
        } catch (err) {
          console.warn(`Afbeelding ${prompt.imagePath} niet beschikbaar`, err);
        }
      }
      counter += 1;
    }

    // Verwijder alleen bestanden die NIET meer nodig zijn
    for await (const entry of exportDir.values()) {
      if (entry.kind === "file") {
        const fileNum = parseInt(entry.name.split(".")[0], 10);
        if (!newFileNumbers.has(fileNum)) {
          try {
            await exportDir.removeEntry(entry.name);
          } catch (err) {
            console.warn(`Kon bestand ${entry.name} niet verwijderen`, err);
          }
        }
      }
    }

    // Tweede pass: schrijf de afbeeldingen
    counter = 1;
    for (const prompt of state.projectData.prompts) {
      if (!prompt.imagePath) continue;
      if (!state.projectImagesHandle) {
        console.warn("Geen images-handle aanwezig, overslaan");
        counter += 1;
        continue;
      }
      try {
        const sourceHandle = await state.projectImagesHandle.getFileHandle(prompt.imagePath);
        const sourceFile = await sourceHandle.getFile();
        const extension = prompt.imagePath.split(".").pop();
        const targetName = `${counter}.${extension}`;
        const targetHandle = await exportDir.getFileHandle(targetName, { create: true });
        const writable = await targetHandle.createWritable();
        await writable.write(await sourceFile.arrayBuffer());
        await writable.close();
      } catch (err) {
        console.warn(`Afbeelding ${prompt.imagePath} niet gevonden of leesfout, overslaan`, err);
        // skip this image and continue with next
      }
      counter += 1;
    }

    // Show a professional dialog with the export path and copy option
    const message = t("alerts.imagesExported", { dir: exportDirName });
    const detail = t("alerts.imagesExportedDetail", { dir: exportDirName });
    if (elements.imagesExportedDialog) {
      if (elements.imagesExportedMessage) elements.imagesExportedMessage.textContent = detail;
      if (elements.imagesExportedPath) elements.imagesExportedPath.textContent = exportDirName;
      applyTranslations(elements.imagesExportedDialog);
      elements.imagesExportedDialog.showModal();
    } else {
      window.alert(message);
    }
  } catch (error) {
    showError(t("errors.exportImages"), error);
  }
}

function resetDialogImageState(message = t("dialog.prompt.noImage")) {
  if (!elements.dialogImageWrapper) return;
  if (state.dialogImageUrl) {
    URL.revokeObjectURL(state.dialogImageUrl);
    state.dialogImageUrl = null;
  }
  elements.dialogImageWrapper.dataset.hasImage = "false";
  if (elements.dialogImage) {
    elements.dialogImage.src = "";
  }
  if (elements.dialogImagePlaceholder) {
    elements.dialogImagePlaceholder.textContent = message;
  }
}

async function loadPromptDialogImage(prompt) {
  if (!elements.dialogImageWrapper) return;
  if (!prompt.imagePath || !state.projectImagesHandle) {
    resetDialogImageState(t("dialog.prompt.noImage"));
    return;
  }
  try {
    const fileHandle = await state.projectImagesHandle.getFileHandle(prompt.imagePath);
    const file = await fileHandle.getFile();
    const blobUrl = URL.createObjectURL(file);
    resetDialogImageState();
    elements.dialogImageWrapper.dataset.hasImage = "true";
    if (elements.dialogImage) {
      elements.dialogImage.src = blobUrl;
    }
    state.dialogImageUrl = blobUrl;
  } catch (error) {
    console.warn("Afbeelding voor dialoog laden mislukt", error);
    resetDialogImageState(t("dialog.prompt.loadFailed"));
  }
}

async function loadPromptDialogVideo(prompt) {
  if (!elements.dialogVideoWrapper) return;
  if (!prompt.videoPath || !state.projectVideosHandle) {
    // Geen video: toon placeholder
    elements.dialogVideoWrapper.dataset.hasVideo = "false";
    if (elements.dialogVideo) {
      elements.dialogVideo.removeAttribute("src");
      elements.dialogVideo.load();
    }
    if (elements.dialogVideoPlaceholder) {
      elements.dialogVideoPlaceholder.textContent = "Nog geen video gekoppeld.";
    }
    return;
  }
  try {
    const fileHandle = await state.projectVideosHandle.getFileHandle(prompt.videoPath);
    const file = await fileHandle.getFile();
    const blobUrl = URL.createObjectURL(file);
    elements.dialogVideoWrapper.dataset.hasVideo = "true";
    if (elements.dialogVideo) {
      elements.dialogVideo.src = blobUrl;
      elements.dialogVideo.load();
    }
  } catch (error) {
    console.warn("Video voor dialoog laden mislukt", error);
    elements.dialogVideoWrapper.dataset.hasVideo = "false";
    if (elements.dialogVideoPlaceholder) {
      elements.dialogVideoPlaceholder.textContent = "Video laden mislukt";
    }
  }
}

async function openPromptDialog(promptId) {
  if (!elements.promptDialog) return;
  if (!state.projectData) return;
  const prompt = state.projectData.prompts.find((item) => item.id === promptId);
  if (!prompt) return;
  state.dialogPromptId = promptId;

  resetDialogImageState(prompt.imagePath ? t("dialog.prompt.loadingImage") : t("dialog.prompt.noImage"));

  const sceneIndex = state.projectData.prompts.indexOf(prompt) + 1;
  const totalScenes = state.projectData.prompts.length;
  
  elements.dialogSceneIndex.textContent = sceneIndex;
  
  // Update navigation buttons state
  if (elements.dialogPrevScene) {
    elements.dialogPrevScene.disabled = (sceneIndex === 1);
  }
  if (elements.dialogNextScene) {
    elements.dialogNextScene.disabled = (sceneIndex === totalScenes);
  }
  
  if (elements.dialogText) {
    elements.dialogText.value = prompt.text ?? "";
  }
  if (elements.dialogTranslation) {
    elements.dialogTranslation.value = prompt.translation ?? "";
  }
  
  // Laad traditionele video velden indien aanwezig
  if (elements.dialogWhatSee) {
    elements.dialogWhatSee.value = prompt.whatDoWeSee ?? "";
  }
  if (elements.dialogHowMake) {
    elements.dialogHowMake.value = prompt.howDoWeMake ?? "";
  }
  if (elements.dialogTimeline) {
    elements.dialogTimeline.value = prompt.timeline ?? "";
  }
  if (elements.dialogDuration) {
    elements.dialogDuration.value = prompt.duration ?? "";
  }
  
  elements.dialogOpenImage.disabled = !prompt.imagePath;

  // Pas workflow mode toe op dialog
  applyWorkflowModeToDialog();
  
  // Update help texts voor dialog elementen
  updateHelpTexts();

  elements.promptDialog.returnValue = "";
  elements.promptDialog.showModal();

  await loadPromptDialogImage(prompt);
  await loadPromptDialogVideo(prompt);
  applyTranslations(elements.promptDialog);
}

/**
 * Navigeer naar vorige/volgende scene in de dialog
 */
function navigateDialogScene(direction) {
  if (!state.projectData || !state.dialogPromptId) return;
  
  const currentPrompt = state.projectData.prompts.find(p => p.id === state.dialogPromptId);
  if (!currentPrompt) return;
  
  const currentIndex = state.projectData.prompts.indexOf(currentPrompt);
  let newIndex = currentIndex + direction;
  
  // Check bounds
  if (newIndex < 0 || newIndex >= state.projectData.prompts.length) return;
  
  // Save current changes first
  if (elements.dialogText && elements.dialogTranslation) {
    currentPrompt.text = elements.dialogText.value;
    currentPrompt.translation = elements.dialogTranslation.value;
    
    // Save traditional video fields
    if (elements.dialogWhatSee) {
      currentPrompt.whatDoWeSee = elements.dialogWhatSee.value;
    }
    if (elements.dialogHowMake) {
      currentPrompt.howDoWeMake = elements.dialogHowMake.value;
    }
    if (elements.dialogTimeline) {
      currentPrompt.timeline = elements.dialogTimeline.value;
    }
    if (elements.dialogDuration) {
      // Rond duration af naar 2 decimalen
      const durationValue = parseFloat(elements.dialogDuration.value);
      currentPrompt.duration = isNaN(durationValue) ? "" : durationValue.toFixed(2);
    }
    
    flagProjectDirty();
  }
  
  // Open new scene
  const newPrompt = state.projectData.prompts[newIndex];
  openPromptDialog(newPrompt.id);
}

function handlePromptDialogClose() {
  const wasSaved = elements.promptDialog.returnValue === "save";
  if (!state.projectData || !state.dialogPromptId) {
    resetDialogImageState();
    state.dialogPromptId = null;
    return;
  }
  const prompt = state.projectData.prompts.find((item) => item.id === state.dialogPromptId);
  if (prompt && wasSaved) {
    const newText = elements.dialogText ? elements.dialogText.value : prompt.text ?? "";
    const newTranslation = elements.dialogTranslation ? elements.dialogTranslation.value : prompt.translation ?? "";
    
    // Traditionele video velden
    const newWhatSee = elements.dialogWhatSee ? elements.dialogWhatSee.value : prompt.whatDoWeSee ?? "";
    const newHowMake = elements.dialogHowMake ? elements.dialogHowMake.value : prompt.howDoWeMake ?? "";
    const newTimeline = elements.dialogTimeline ? elements.dialogTimeline.value : prompt.timeline ?? "";
    const newDuration = elements.dialogDuration ? elements.dialogDuration.value : prompt.duration ?? "";
    
    const changed = newText !== (prompt.text ?? "") 
      || newTranslation !== (prompt.translation ?? "")
      || newWhatSee !== (prompt.whatDoWeSee ?? "")
      || newHowMake !== (prompt.howDoWeMake ?? "")
      || newTimeline !== (prompt.timeline ?? "")
      || newDuration !== (prompt.duration ?? "");
      
    if (changed) {
      prompt.text = newText;
      prompt.translation = newTranslation;
      prompt.whatDoWeSee = newWhatSee;
      prompt.howDoWeMake = newHowMake;
      prompt.timeline = newTimeline;
      prompt.duration = newDuration;
      
      const card = elements.promptsContainer.querySelector(`.prompt-card[data-id="${prompt.id}"]`);
      if (card) {
        card.querySelector(".prompt-text").value = newText;
        card.querySelector(".prompt-nl").value = newTranslation;
        
        // Update traditionele velden in scene card
        const sceneWhatSee = card.querySelector(".scene-what-see");
        const sceneHowMake = card.querySelector(".scene-how-make");
        const sceneTimeline = card.querySelector(".scene-timeline");
        
        if (sceneWhatSee) sceneWhatSee.value = newWhatSee;
        if (sceneHowMake) sceneHowMake.value = newHowMake;
        if (sceneTimeline) sceneTimeline.value = newTimeline;
      }
      flagProjectDirty({ refreshEditor: false, refreshList: false });
    }
  }

  state.dialogPromptId = null;
  elements.dialogSceneIndex.textContent = "";
  if (elements.dialogText) {
    elements.dialogText.value = "";
  }
  if (elements.dialogTranslation) {
    elements.dialogTranslation.value = "";
  }
  if (elements.dialogWhatSee) {
    elements.dialogWhatSee.value = "";
  }
  if (elements.dialogHowMake) {
    elements.dialogHowMake.value = "";
  }
  if (elements.dialogTimeline) {
    elements.dialogTimeline.value = "";
  }
  if (elements.dialogDuration) {
    elements.dialogDuration.value = "";
  }
  elements.dialogOpenImage.disabled = true;
  resetDialogImageState();
  applyTranslations(elements.promptDialog);
}

async function handleDialogOpenImage() {
  if (!state.projectData || !state.dialogPromptId) {
    showError(t("errors.noSceneSelected"));
    return;
  }
  const prompt = state.projectData.prompts.find((item) => item.id === state.dialogPromptId);
  if (!prompt?.imagePath || !state.projectImagesHandle) {
    showError(t("errors.noImageAvailable"), new Error(t("errors.linkImageFirst")));
    return;
  }
  let previewWindow;
  try {
    previewWindow = window.open("", "_blank");
    if (!previewWindow) {
      showError(t("errors.loadImage"), new Error(t("errors.popupBlocked")));
      return;
    }
    const fileHandle = await state.projectImagesHandle.getFileHandle(prompt.imagePath);
    const file = await fileHandle.getFile();
    const blobUrl = URL.createObjectURL(file);
    previewWindow.location = blobUrl;
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch (error) {
    if (previewWindow) {
      previewWindow.close();
    }
    showError(t("errors.loadImage"), error);
  }
}

/**
 * Rootmap kiezen en rechten aanvragen.
 */
async function handleChooseRoot() {
  try {
    const rootHandle = await window.showDirectoryPicker({ id: "storyline-root" });
    const ok = await ensureWritePermission(rootHandle);
    if (!ok) {
      showError(t("errors.chooseRootPermission"));
      await clearLastRootHandle();
      return;
    }
    state.rootHandle = rootHandle;
    
    // DEBUG: Uncomment these lines to enable file logging:
    // await initLogger(rootHandle);
    // await log("Root directory gekozen");
    
    await ensureStructure();
    await saveLastRootHandle(rootHandle);
    updateRootUi();
    renderProjectList();
  } catch (error) {
    if (error.name === "AbortError") return;
    showError(t("errors.chooseRoot"), error);
    await clearLastRootHandle();
  }
}

/**
 * Houd sorteerinstelling bij.
 */
function handleSortChange(event) {
  state.sortOrder = event.target.value;
  renderProjectList();
}

/**
 * Wijzigingen aan meta direct in state zetten.
 */
function handleMetaChange() {
  if (!state.projectData) return;
  const generator = elements.editGenerator.value;
  const notes = elements.editNotes.value;
  if (generator === (state.projectData.videoGenerator ?? "") && notes === (state.projectData.notes ?? "")) {
    return;
  }
  state.projectData.videoGenerator = generator;
  state.projectData.notes = notes;
  flagProjectDirty({ refreshEditor: false, refreshList: false });
}

/**
 * Startpunt van de applicatie.
 */
function init() {
  if (typeof window.showDirectoryPicker !== "function") {
    showError(t("errors.chooseRoot"), new Error(t("info.needsSecureContext")));
    elements.chooseRoot.disabled = true;
    return;
  }

  setLanguage(currentLanguage, { reRender: false });
  
  // Initialiseer help systeem (laadt ook opgeslagen workflow mode)
  initializeHelpSystem(currentLanguage);

  if (elements.languageSwitch) {
    elements.languageSwitch.addEventListener("change", (event) => {
      setLanguage(event.target.value);
    });
  }

  // Workflow mode selector
  if (elements.workflowMode) {
    elements.workflowMode.addEventListener("change", (event) => {
      handleWorkflowModeChange(event.target.value);
    });
  }

  // Help mode toggle
  if (elements.toggleHelp) {
    elements.toggleHelp.addEventListener("click", toggleHelpMode);
  }

  elements.chooseRoot.addEventListener("click", handleChooseRoot);
  elements.projectForm.addEventListener("submit", (event) =>
    createProject(event).catch((error) => showError(t("errors.createProject"), error))
  );
  elements.sortProjects.addEventListener("change", handleSortChange);
  elements.refreshProjects.addEventListener("click", () =>
    refreshProjectsList().catch((error) => showError(t("errors.refreshProjects"), error))
  );
  if (elements.duplicateProject) {
    elements.duplicateProject.addEventListener("click", () =>
      copyProject().catch((error) => showError(t("errors.createProject"), error))
    );
  }
  elements.addPrompt.addEventListener("click", addPromptWrapper);
  
  // Media toggle event listeners
  if (elements.showAllImages) {
    elements.showAllImages.addEventListener("click", () => {
      elements.showAllImages.classList.add("active");
      elements.showAllVideos.classList.remove("active");
      elements.promptsContainer.classList.remove("media-view-videos");
      elements.promptsContainer.classList.add("media-view-images");
      
      // Update button text om actieve status te tonen
      elements.showAllImages.innerHTML = "✓ 🖼️ Afbeeldingen";
      elements.showAllVideos.innerHTML = "🎬 Video's";
      
      // Sla mode op in state
      state.currentMediaViewMode = "images";
      
      // Update alle scene toggles naar image mode
      updateAllSceneToggles("images");
    });
  }
  
  if (elements.showAllVideos) {
    elements.showAllVideos.addEventListener("click", () => {
      elements.showAllVideos.classList.add("active");
      elements.showAllImages.classList.remove("active");
      elements.promptsContainer.classList.remove("media-view-images");
      elements.promptsContainer.classList.add("media-view-videos");
      
      // Update button text om actieve status te tonen
      elements.showAllVideos.innerHTML = "✓ 🎬 Video's";
      elements.showAllImages.innerHTML = "🖼️ Afbeeldingen";
      
      // Sla mode op in state
      state.currentMediaViewMode = "videos";
      
      // Update alle scene toggles naar video mode
      updateAllSceneToggles("videos");
    });
  }
  
  // Audio Timeline event listeners
  const toggleAudioBtn = document.querySelector("#toggle-audio-timeline");
  const closeAudioBtn = document.querySelector("#close-audio-timeline");
  const audioInfoBadge = document.querySelector("#audio-timeline-info-badge");
  const audioInfoDialog = document.querySelector("#audio-timeline-info-dialog");
  
  // Info badge click handler - toon uitleg dialog
  if (audioInfoBadge) {
    audioInfoBadge.addEventListener("click", (e) => {
      e.stopPropagation(); // Voorkom dat toggle-audio-timeline wordt getriggerd
      if (audioInfoDialog) {
        audioInfoDialog.showModal();
      }
    });
  }
  
  // Audio Timeline button opent nu fullscreen editor
  if (toggleAudioBtn) {
    toggleAudioBtn.addEventListener("click", () => {
      openAudioVideoEditor();
    });
  }
  
  // Initialiseer oude audio timeline module (voor data compatibility)
  initializeAudioTimeline();
  
  // Registreer callbacks voor audio timeline (ook als er nog geen audio is)
  setSceneCallbacks(
    handleSceneCreateFromMarker,
    handleSceneDeleteFromMarker,
    handleSceneReorderFromMarkers,
    getUnlinkedScenes,
    handleEditSceneFromMarker,
    getAllScenes
  );
  
  // Initialiseer audio video editor
  initializeAudioVideoEditor();
  
  // Event listeners voor audio editor <-> scene synchronisatie
  document.addEventListener('updateSceneMediaType', (e) => {
    const { markerIndex, mediaType } = e.detail;
    updateSceneMediaTypeFromEditor(markerIndex, mediaType);
  });
  
  document.addEventListener('getInactiveScenes', (e) => {
    e.detail.scenes = getUnlinkedScenes();
  });
  
  document.addEventListener('linkSceneToMarker', (e) => {
    const { sceneId, markerIndex, time } = e.detail;
    handleLinkSceneToMarkerFromEditor(sceneId, markerIndex, time);
  });
  
  document.addEventListener('getScenePreview', (e) => {
    const { markerIndex, mediaType } = e.detail;
    sendScenePreviewToEditor(markerIndex, mediaType);
  });
  
  document.addEventListener('getSceneMediaType', (e) => {
    const { markerIndex } = e.detail;
    const mediaType = getSceneMediaType(markerIndex);
    
    const response = new CustomEvent('sceneMediaTypeResponse', {
      detail: { markerIndex, mediaType }
    });
    document.dispatchEvent(response);
  });

  document.addEventListener('updateMarkerPosition', (e) => {
    const { markerIndex, newTime } = e.detail;
    updateMarkerPositionFromEditor(markerIndex, newTime);
  });

  document.addEventListener('reorderMarker', (e) => {
    const { oldIndex, newIndex } = e.detail;
    handleMarkerReorderFromEditor(oldIndex, newIndex);
  });

  document.addEventListener('openSceneEditor', (e) => {
    const { markerIndex } = e.detail;
    handleEditSceneFromMarker(markerIndex);
  });

  document.addEventListener('createSceneFromEditor', (e) => {
    const { sceneData, markerIndex } = e.detail;
    handleCreateSceneFromEditor(sceneData, markerIndex);
  });

  elements.saveProject.addEventListener("click", () => saveProject().catch((error) => showError(t("errors.saveProject"), error)));
  elements.exportPrompts.addEventListener("click", () =>
    exportPrompts().catch((error) => showError(t("errors.exportPrompts"), error))
  );
  elements.exportImages.addEventListener("click", () =>
    exportImages().catch((error) => showError(t("errors.exportImages"), error))
  );
  elements.editGenerator.addEventListener("input", handleMetaChange);
  elements.editNotes.addEventListener("input", handleMetaChange);
  elements.promptsContainer.addEventListener("dragover", handlePromptContainerDragOver);
  elements.promptsContainer.addEventListener("drop", handlePromptContainerDrop);
  if (elements.promptDialog) {
    elements.promptDialog.addEventListener("close", handlePromptDialogClose);
    
    // Keyboard shortcuts voor scene navigatie in dialog
    elements.promptDialog.addEventListener("keydown", (event) => {
      // Alleen als we NIET in een textarea zijn
      if (event.target.tagName === "TEXTAREA") return;
      
      if (event.key === "ArrowLeft" && elements.dialogPrevScene && !elements.dialogPrevScene.disabled) {
        event.preventDefault();
        navigateDialogScene(-1);
      } else if (event.key === "ArrowRight" && elements.dialogNextScene && !elements.dialogNextScene.disabled) {
        event.preventDefault();
        navigateDialogScene(1);
      }
    });
  }
  if (elements.dialogPrevScene) {
    elements.dialogPrevScene.addEventListener("click", () => navigateDialogScene(-1));
  }
  if (elements.dialogNextScene) {
    elements.dialogNextScene.addEventListener("click", () => navigateDialogScene(1));
  }
  if (elements.dialogOpenImage) {
    elements.dialogOpenImage.addEventListener("click", () => {
      handleDialogOpenImage().catch((error) => showError(t("errors.loadImage"), error));
    });
    elements.dialogOpenImage.disabled = true;
  }
  if (elements.exportPreviewCopy) {
    elements.exportPreviewCopy.addEventListener("click", () => {
      handleExportPreviewCopy().catch((error) => showError(t("errors.copyFailed"), error));
    });
  }
  if (elements.exportPreviewDialog) {
    elements.exportPreviewDialog.addEventListener("close", handleExportPreviewClose);
  }
  if (elements.copyConfirm) {
    elements.copyConfirm.addEventListener("click", async (event) => {
      event.preventDefault();
      try {
        const targetId = elements.copyTargetSelect.value;
        if (!targetId || !state.copyingPromptId) return;
        await copySceneToProject(state.copyingPromptId, targetId);
      } catch (error) {
        showError(t("errors.exportPrompts"), error);
      } finally {
        if (elements.copyDialog) elements.copyDialog.close();
        state.copyingPromptId = null;
      }
    });
  }
  if (elements.copyDuplicate) {
    elements.copyDuplicate.addEventListener("click", async (event) => {
      event.preventDefault();
      try {
        if (!state.copyingPromptId) return;
        await duplicateSceneInProject(state.copyingPromptId);
      } catch (error) {
        showError(t("errors.exportPrompts"), error);
      } finally {
        if (elements.copyDialog) elements.copyDialog.close();
        state.copyingPromptId = null;
      }
    });
  }
  if (elements.copyCancel && elements.copyDialog) {
    elements.copyCancel.addEventListener("click", () => {
      state.copyingPromptId = null;
      elements.copyDialog.close();
    });
  }

  // Copy project dialog handlers (duplicate project)
  if (elements.copyProjectConfirm) {
    elements.copyProjectConfirm.addEventListener("click", async (ev) => {
      ev.preventDefault();
      try {
        const name = elements.copyProjectName?.value?.trim();
        if (!name) {
          showError(t("errors.projectNameRequired"));
          return;
        }
        if (elements.copyProjectDialog) elements.copyProjectDialog.close();
        await doCopyProject(name);
      } catch (error) {
        showError(t("errors.createProject"), error);
      }
    });
  }
  if (elements.copyProjectCancel && elements.copyProjectDialog) {
    elements.copyProjectCancel.addEventListener("click", () => {
      elements.copyProjectDialog.close();
    });
  }
  if (elements.startPresentation) {
    elements.startPresentation.addEventListener("click", async () => {
      // Toon loader DIRECT bij klik
      showPresentationLoader(true);
      
      try {
        await openPresentation();
      } catch (error) {
        showPresentationLoader(false);
        showError(t("errors.openPrompt"), error);
      }
    });
  }
  if (elements.presentationLanguage) {
    elements.presentationLanguage.addEventListener("change", (event) => {
      setPresentationLanguageWrapper(event.target.value);
    });
  }
  if (elements.presentationWorkflow) {
    elements.presentationWorkflow.addEventListener("change", (event) => {
      setPresentationWorkflowMode(event.target.value, state, elements);
      // Update de slide om nieuwe velden te tonen
      if (state.presentationMode.videoMode) {
        updateVideoPresentationSlide(state, elements, t, () => nextSlide(state));
      } else {
        updatePresentationSlide(state, elements, t);
      }
    });
  }
  if (elements.presentationMode) {
    elements.presentationMode.addEventListener("change", async (event) => {
      const mode = event.target.value; // "image", "video", "audio-image", "audio-video"
      const wasVideoMode = state.presentationMode.videoMode;
      const wasAudioMode = state.presentationMode.audioMode || false;
      
      // Stop oude media voordat we mode wijzigen
      if (wasVideoMode && mode !== "video") {
        // Van video mode weg: stop video
        if (elements.presentationVideo) {
          elements.presentationVideo.pause();
          elements.presentationVideo.currentTime = 0;
        }
      }
      if (wasAudioMode && !mode.startsWith("audio-")) {
        // Van audio mode weg: stop audio
        if (elements.presentationAudio) {
          elements.presentationAudio.pause();
          elements.presentationAudio.currentTime = 0;
        }
      }
      
      state.presentationMode.videoMode = (mode === "video");
      state.presentationMode.audioMode = (mode === "audio-image" || mode === "audio-video" || mode === "audio-mixed");
      state.presentationMode.showVideoInAudio = (mode === "audio-video");
      
      // Toggle image/video/audio containers
      const imageContainer = elements.presentationDialog.querySelector(".slide-image-container");
      const videoContainer = elements.presentationDialog.querySelector(".slide-video-container");
      const footer = elements.presentationDialog.querySelector(".presentation-footer");
      const form = elements.presentationDialog.querySelector(".presentation-form");
      
      if (imageContainer && videoContainer) {
        if (mode === "video") {
          // Video only mode
          imageContainer.dataset.active = "false";
          videoContainer.dataset.active = "true";
          if (footer) footer.classList.add("video-mode");
          if (footer) footer.classList.remove("audio-mode");
          if (form) form.classList.remove("has-audio-timeline");
          if (elements.videoTimelineContainer) elements.videoTimelineContainer.style.display = "block";
          if (elements.presentationAudioTimelineContainer) elements.presentationAudioTimelineContainer.style.display = "none";
          
          // Initialiseer video timeline als we naar video mode switchen
          if (!wasVideoMode) {
            const timeline = await initializeCombinedVideoPresentation(state, elements, t);
            state.presentationMode.videoTimeline = timeline;
            
            if (!timeline || timeline.segments.length === 0) {
              showError("Geen video's gevonden in dit project");
              state.presentationMode.videoMode = false;
              event.target.value = "image";
              imageContainer.dataset.active = "true";
              videoContainer.dataset.active = "false";
              if (footer) footer.classList.remove("video-mode");
              return;
            }
          }
        } else if (mode === "audio-image" || mode === "audio-video" || mode === "audio-mixed") {
          // Audio modes (image, video, of mixed)
          if (mode === "audio-mixed") {
            // Mixed mode: bepaal per scene
            const currentPrompt = state.projectData.prompts[state.presentationMode.currentSlide];
            const useVideo = currentPrompt && currentPrompt.preferredMediaType === 'video';
            imageContainer.dataset.active = useVideo ? "false" : "true";
            videoContainer.dataset.active = useVideo ? "true" : "false";
          } else {
            imageContainer.dataset.active = (mode === "audio-image") ? "true" : "false";
            videoContainer.dataset.active = (mode === "audio-video") ? "true" : "false";
          }
          
          if (footer) {
            footer.classList.remove("video-mode");
            footer.classList.add("audio-mode");
          }
          if (form) form.classList.add("has-audio-timeline");
          if (elements.videoTimelineContainer) elements.videoTimelineContainer.style.display = "none";
          if (elements.presentationAudioTimelineContainer) elements.presentationAudioTimelineContainer.style.display = "flex";
          
          // Initialiseer audio voor presentatie (alleen als project audio heeft)
          if (state.projectData.audioTimeline && state.projectData.audioTimeline.audioFileName) {
            await initializeAudioPresentation(
              state, 
              elements,
              state.projectDirHandle,
              getSceneIndexAtTime,
              getAllScenes,
              updatePresentationSlideWrapper
            );
          } else {
            console.warn("Kan niet naar audio mode: project heeft geen audio timeline");
            // Fallback naar image mode
            event.target.value = "image";
            state.presentationMode.audioMode = false;
            imageContainer.dataset.active = "true";
            if (footer) footer.classList.remove("audio-mode");
            if (form) form.classList.remove("has-audio-timeline");
            if (elements.presentationAudioTimelineContainer) elements.presentationAudioTimelineContainer.style.display = "none";
          }
        } else {
          // Image only mode
          imageContainer.dataset.active = "true";
          videoContainer.dataset.active = "false";
          if (footer) {
            footer.classList.remove("video-mode");
            footer.classList.remove("audio-mode");
          }
          if (form) form.classList.remove("has-audio-timeline");
          if (elements.videoTimelineContainer) elements.videoTimelineContainer.style.display = "none";
          if (elements.presentationAudioTimelineContainer) elements.presentationAudioTimelineContainer.style.display = "none";
          
          // Stop video/audio als we terug gaan naar image mode
          if (elements.presentationVideo) {
            elements.presentationVideo.pause();
          }
          if (elements.presentationAudio) {
            elements.presentationAudio.pause();
          }
        }
      }
      
      // Update slide voor nieuwe modus
      await updatePresentationSlideWrapper();
    });
  }
  if (elements.presentationNext) {
    elements.presentationNext.addEventListener("click", nextSlideWrapper);
  }
  if (elements.presentationPrev) {
    elements.presentationPrev.addEventListener("click", prevSlideWrapper);
  }
  if (elements.videoTimelineSlider) {
    elements.videoTimelineSlider.addEventListener("input", (event) => {
      if (state.presentationMode.videoMode && state.presentationMode.videoTimeline) {
        const percentage = parseFloat(event.target.value);
        seekCombinedVideoTimeline(percentage, state, elements, t);
      }
    });
  }
  if (elements.presentationClose) {
    elements.presentationClose.addEventListener("click", closePresentationModeWrapper);
  }
  if (elements.presentationDialog) {
    elements.presentationDialog.addEventListener("close", closePresentationModeWrapper);
  }
  
  // Audio markers changed event listener
  document.addEventListener('audioMarkersChanged', (event) => {
    updateScenesFromAudioMarkers(
      event.detail.markers, 
      event.detail.duration, 
      event.detail.draggedMarker // Kan undefined zijn als het geen drag was
    );
    // Sorteer scenes op basis van de nieuwe marker volgorde
    sortScenesByAudioMarkers();
  });
  
  // Link scene to marker event listener
  document.addEventListener('linkSceneToMarker', (event) => {
    handleLinkSceneToMarker(event.detail.sceneIndex, event.detail.markerIndex, event.detail.time);
  });
  
  // Keyboard shortcuts voor presentatie
  document.addEventListener("keydown", (event) => {
    if (!elements.presentationDialog || !elements.presentationDialog.open) return;
    if (event.key === "ArrowRight" || event.key === " ") {
      event.preventDefault();
      nextSlideWrapper();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      prevSlideWrapper();
    } else if (event.key === "Escape") {
      event.preventDefault();
      closePresentationModeWrapper();
    }
  });
  if (elements.deleteProject) {
    elements.deleteProject.addEventListener("click", () => {
      openDeleteProjectDialog();
    });
  }
  if (elements.deleteConfirm) {
    elements.deleteConfirm.addEventListener("click", async (event) => {
      event.preventDefault();
      try {
        await deleteCurrentProject();
        // Only close dialog if deletion was successful
        if (elements.deleteProjectDialog) elements.deleteProjectDialog.close();
      } catch (error) {
        showError(t("errors.deleteProject"), error);
        // Keep dialog open so user can try again
      }
    });
  }
  if (elements.deleteCancel && elements.deleteProjectDialog) {
    elements.deleteCancel.addEventListener("click", () => {
      elements.deleteProjectDialog.close();
    });
  }
  if (elements.deleteProjectDialog) {
    elements.deleteProjectDialog.addEventListener("close", () => {
      // Dialog gesloten
    });
  }
  updateRootUi();
  tryRestoreLastRoot().catch((error) => {
    console.warn("Projectmap herstellen mislukt", error);
  });
}

// Wire export-choice dialog and dropdown actions (fallback if init wiring absent)
if (elements.exportPromptsDropdown && elements.exportChoiceDialog) {
  elements.exportPromptsDropdown.addEventListener("click", () => {
    applyTranslations(elements.exportChoiceDialog);
    elements.exportChoiceDialog.showModal();
  });
}
if (elements.exportPrompts) {
  // Primary click -> default export (prompts). Small arrow opens the choice dialog.
  elements.exportPrompts.addEventListener("click", (ev) => {
    ev.preventDefault();
    try {
      // default behaviour: export prompts
      exportPromptsMode("prompts");
    } catch (err) {
      showError(t("errors.exportPrompts"), err);
    }
  });
}
if (elements.exportChoicePrompts) {
  elements.exportChoicePrompts.addEventListener("click", (ev) => {
    ev.preventDefault();
    try {
      exportPromptsMode("prompts");
    } catch (err) {
      showError(t("errors.exportPrompts"), err);
    } finally {
      if (elements.exportChoiceDialog) elements.exportChoiceDialog.close();
    }
  });
}
if (elements.exportChoiceNotes) {
  elements.exportChoiceNotes.addEventListener("click", (ev) => {
    ev.preventDefault();
    try {
      exportPromptsMode("notes");
    } catch (err) {
      showError(t("errors.exportPrompts"), err);
    } finally {
      if (elements.exportChoiceDialog) elements.exportChoiceDialog.close();
    }
  });
}

// images exported dialog actions
if (elements.imagesExportedCopy) {
  elements.imagesExportedCopy.addEventListener("click", async () => {
    try {
      const text = elements.imagesExportedPath ? elements.imagesExportedPath.textContent : "";
      if (text) await copyToClipboard(text);
      // provide quick feedback using translations
      const copiedLabel = t("actions.copied") || "Gekopieerd";
      const copyLabel = t("actions.copyPath") || "Kopieer pad";
      elements.imagesExportedCopy.textContent = copiedLabel;
      setTimeout(() => {
        if (elements.imagesExportedCopy) elements.imagesExportedCopy.textContent = copyLabel;
      }, 1200);
    } catch (err) {
      showError(t("errors.copyFailed"), err);
    }
  });
}
if (elements.imagesExportedClose && elements.imagesExportedDialog) {
  elements.imagesExportedClose.addEventListener("click", () => {
    elements.imagesExportedDialog.close();
  });
}

// Start applicatie, verdere logica verloopt via eventlisteners hierboven.
init();
