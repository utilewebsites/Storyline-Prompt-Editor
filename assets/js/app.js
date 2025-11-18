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

// Nieuwe modules voor betere code organisatie
import { t, applyTranslations, setLanguage as setI18nLanguage, getCurrentLanguage } from "./modules/i18n.js";
import { showError, showSuccess, copyToClipboard } from "./modules/dialogs.js";
import { saveLastRootHandle, loadLastRootHandle, clearLastRootHandle, pickDirectory, ensureWritePermission } from "./modules/file-system.js";
import { getState, resetState, setRootHandle, setProjectenHandle, setIndexData, loadProject, setProjectDirty, isProjectDirty, updateScene, getScene, getAllScenes as getStateSce, getImageCache, getVideoCache, updateProjectInIndex, removeProjectFromIndex, addProjectToIndex } from "./modules/state.js";
import { formatTime, debounce, toggleVisibility } from "./modules/dom-helpers.js";
import { FILE_NAMES, DIR_NAMES, MIME_TYPES, SCENE_DEFAULTS, PROJECT_DEFAULTS, CSS_CLASSES, LIMITS } from "./modules/constants.js";

// Bestaande imports
import translations from "./translations.js";
import { uuid, slugify, formatDateTime, readJsonFile, writeJsonFile, writeTextFile } from "./modules/utils.js";
import { addPrompt, deletePrompt, movePrompt, assignImageToPrompt, assignVideoToPrompt, removeImageFromPrompt, removeVideoFromPrompt } from "./modules/scenes.js";
import { updatePresentationSlide, updateVideoPresentationSlide, nextSlide, prevSlide, setPresentationLanguage, setPresentationWorkflowMode, closePresentationMode, initializeCombinedVideoPresentation, updateCombinedVideoPresentation, seekCombinedVideoTimeline, renderPresentationWaveform, renderPresentationMarkers, renderMarkerButtons, setupPresentationAudioPlayer, initializeAudioPresentation } from "./modules/presentation.js";
import { initializeHelpSystem, setHelpLanguage, toggleHelpMode, handleWorkflowModeChange, applyWorkflowModeToDialog, getWorkflowMode, updateHelpTexts } from "./modules/help.js";
import { deleteMarker as deleteEditorMarker } from "./modules/audio-video-editor.js";
import { initializeAttachments, clearAttachmentCache } from "./modules/attachments.js";
import { renderTransitionButton, showTransitionDialog, cleanupTransitions, reindexTransitions } from "./modules/transitions.js";
import { initializeAudioVideoEditor, openEditor as openAudioVideoEditor, resetAudioVideoEditor, getAudioTimelineData, restoreAudioTimelineFromData, clearAudioFileReference, loadAudioFromProjectDir } from "./modules/audio-video-editor.js";
// import { initLogger, log, logSection } from "./modules/logger.js"; // DEBUG: Uncomment om logging aan te zetten

// Nieuwe refactoring modules (nov 2024)
import { loadImagePreview, loadVideoPreview, uploadImage, uploadVideo, removeImage, removeVideo, renderStarWidget, validateMediaFile } from "./modules/media-handlers.js";
import { handleCardDragStart, handleContainerDragOver, handleContainerDrop, handleCardDragEnd, movePromptToIndex as movePromptToIndexDnD, moveScene as moveSceneDnD } from "./modules/drag-drop.js";
import { syncIndexWithFilesystem as syncIndex, ensureStructure as ensureProjectStructure, renderProjectList as renderProjectListUI, updateRootUi as updateRootUI, refreshProjectsList as refreshProjects } from "./modules/project-manager.js";
import { exportPromptsToText, exportSceneImages } from "./modules/export-handlers.js";
import { copySceneToProject, duplicateSceneInProject } from "./modules/scene-copy.js";
import { createProjectListItem, updateProjectListItem, renderProjectMeta, renderSceneIndex } from "./modules/ui-rendering.js";
import { addNewScene, duplicateScene, deleteScene, moveScene, updateSceneText, updateSceneMedia, updateSceneTransition, findSceneById, findSceneIndexById, validateScene } from "./modules/scene-actions.js";
import { createNewProject, openProjectById, saveProjectData, deleteProject as deleteProjectOp, duplicateProject as duplicateProjectOp } from "./modules/project-operations.js";
import { handleImageUpload as handleImageUploadOp, handleImageRemove as handleImageRemoveOp, handleVideoUpload as handleVideoUploadOp, handleVideoRemove as handleVideoRemoveOp } from "./modules/upload-handlers.js";
import { testOllamaConnection, getAvailableModels, isLLMServiceActive, generateAIPromptWithStatus } from "./modules/llm-service.js";
import { initializeAutoSave, setupAutoSaveButton } from "./modules/auto-save.js";

/**
 * Storyline Prompt Editor
 * Complete beheer van storylineprojecten met gemodulariseerde architectuur.
 * 
 * FUNCTIONALITEIT:
 * - Structuur opzetten in de gekozen map
 * - Projecten laden, aanmaken, updaten en exporteren
 * - Promptvelden beheren inclusief afbeeldingen en video's
 * - Presentatiemodus met video-afspeeling
 * - Audio timeline mode voor automatische scene generatie
 * - Attachments per scene
 * - Transitions tussen scenes
 * - Multi-language support (EN/NL)
 * 
 * ARCHITECTUUR (nov 2024 refactoring):
 * 
 * Core (app.js):
 * - Initialisatie, event wiring, UI orchestration
 * 
 * State Management:
 * - modules/state.js: centrale state store
 * - modules/i18n.js: translations & language switching
 * - modules/constants.js: applicatie-constanten
 * 
 * File System:
 * - modules/file-system.js: File System Access API wrappers
 * - modules/utils.js: uuid, slugify, formatDateTime, JSON I/O
 * 
 * UI Rendering:
 * - modules/dialogs.js: showError, showSuccess
 * - modules/dom-helpers.js: applyTranslations, DOM utilities
 * - modules/ui-rendering.js: renderProjectMeta, createProjectListItem
 * 
 * Project Management:
 * - modules/project-manager.js: sync, ensure structure, refresh
 * - modules/project-operations.js: create, open, save, delete, duplicate
 * - modules/project-actions.js: CRUD operations (deprecated - gebruik project-operations)
 * 
 * Scene Management:
 * - modules/scenes.js: add, duplicate, delete, move, update scenes
 * - modules/scene-actions.js: scene CRUD wrappers
 * - modules/scene-copy.js: copy scene tussen projects
 * 
 * Media:
 * - modules/media-handlers.js: image/video preview, upload, remove, star rating
 * - modules/upload-handlers.js: wrappers voor media operaties
 * - modules/attachments.js: file attachments per scene
 * 
 * Features:
 * - modules/presentation.js: fullscreen presentatiemodus
 * - modules/transitions.js: scene transitions management
 * - modules/audio-timeline.js: audio timeline voor scene timing (deprecated)
 * - modules/audio-video-editor.js: audio timeline met waveform (nieuw)
 * - modules/drag-drop.js: drag & drop card reordering
 * - modules/export-handlers.js: export prompts, images, notes
 * 
 * Support:
 * - modules/help.js: help system
 * - modules/logger.js: debug logging (opt-in)
 * 
 * UI:
 * - index.html: HTML markup
 * - assets/css/*.css: gemodulariseerde styling
 * 
 * Alle comments zijn in het Nederlands voor team-toegankelijkheid.
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
  // LLM Settings elements
  llmSettingsBtn: document.querySelector("#llm-settings-btn"),
  llmStatusIndicator: document.querySelector("#llm-status-indicator"),
  llmSettingsDialog: document.querySelector("#llm-settings-dialog"),
  llmSettingsClose: document.querySelector("#llm-settings-close"),
  llmEnabled: document.querySelector("#llm-enabled"),
  llmOllamaUrl: document.querySelector("#llm-ollama-url"),
  llmTestConnection: document.querySelector("#llm-test-connection"),
  llmConnectionStatus: document.querySelector("#llm-connection-status"),
  llmImageModel: document.querySelector("#llm-image-model"),
  llmPromptModel: document.querySelector("#llm-prompt-model"),
  llmRefreshModels: document.querySelector("#llm-refresh-models"),
  llmSaveSettings: document.querySelector("#llm-save-settings"),
  // AI Prompt Generator elements
  aiPromptDialog: document.querySelector("#ai-prompt-generator-dialog"),
  aiPromptClose: document.querySelector("#ai-prompt-close"),
  aiModeSingle: document.querySelector("#ai-mode-single"),
  aiModeSequence: document.querySelector("#ai-mode-sequence"),
  aiPromptTranslationLang: document.querySelector("#ai-prompt-translation-lang"),
  aiPromptImage1: document.querySelector("#ai-prompt-image-1"),
  aiPromptImage2: document.querySelector("#ai-prompt-image-2"),
  aiPromptExtraInstructions: document.querySelector("#ai-prompt-extra-instructions"),
  aiPromptGenerate: document.querySelector("#ai-prompt-generate"),
  aiPromptStatus: document.querySelector("#ai-prompt-status"),
  aiPromptStatusText: document.querySelector("#ai-prompt-status-text"),
  aiResultPlaceholder: document.querySelector("#ai-result-placeholder"),
  aiPromptResult: document.querySelector("#ai-prompt-result"),
  aiPromptResultEn: document.querySelector("#ai-prompt-result-en"),
  aiPromptResultTranslation: document.querySelector("#ai-prompt-result-translation"),
  aiPromptToggleReasoning: document.querySelector("#ai-prompt-toggle-reasoning"),
  aiPromptReasoning: document.querySelector("#ai-prompt-reasoning"),
  aiPromptReasoningText: document.querySelector("#ai-prompt-reasoning-text"),
  aiPromptUse: document.querySelector("#ai-prompt-use"),
  aiPromptRegenerate: document.querySelector("#ai-prompt-regenerate"),
};

// State is nu centraal beheerd in modules/state.js
// Voor backward compatibility behouden we een referentie
const state = getState();

// Extra state properties die niet in de state module zitten
const localState = {
  dialogPromptId: null,
  draggedPromptId: null,
  dialogImageUrl: null,
  pendingExportText: null,
  pendingExportCount: 0,
  copyingPromptId: null,
  headerMinimized: false,
  sidebarCollapsed: false,
  projectHeaderMinimized: false,
  allMinimized: false,
  aiPromptContext: null, // { sceneIndex, mode: 'single' | 'sequence' }
  presentationMode: {
    currentSlide: 0,
    languageMode: "both",
    workflowMode: "both",
    videoMode: false,
    videoTimeline: null,
  },
};

// i18n functies zijn nu geïmporteerd uit modules/i18n.js
// file-system functies zijn nu geïmporteerd uit modules/file-system.js

/**
 * Wrapper voor setLanguage om oude functionaliteit te behouden
 * Roept de i18n module aan en update de UI
 */
function setLanguage(lang, { reRender = true } = {}) {
  const currentLanguage = getCurrentLanguage();
  
  // Update language via i18n module
  setI18nLanguage(lang, (newLang) => {
    // Update UI elements
    if (elements.languageSwitch && elements.languageSwitch.value !== newLang) {
      elements.languageSwitch.value = newLang;
    }
    setHelpLanguage(newLang);
    updateExportPreviewInfo();
    
    if (reRender) {
      renderProjectList();
      renderProjectEditor();
    } else {
      refreshProjectMetaDisplay();
    }
  });
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
// Image en video cache zijn nu in state.js module
const imageMap = getImageCache();
const videoMap = getVideoCache();

// showError en showSuccess functies zijn nu geïmporteerd uit modules/dialogs.js

// readJsonFile, writeJsonFile, writeTextFile zijn nu geïmporteerd uit modules/utils.js

// syncIndexWithFilesystem, ensureStructure, updateRootUi, refreshProjectsList zijn nu geïmporteerd uit modules/project-manager.js

async function syncIndexWithFilesystem() {
  const projects = await syncIndex(state.projectenHandle, state.indexHandle, state.indexData);
  state.indexData.projects = projects;
}

async function ensureStructure() {
  if (!state.rootHandle) return;
  const { projectenHandle, indexHandle, indexData } = await ensureProjectStructure(state.rootHandle);
  state.projectenHandle = projectenHandle;
  state.indexHandle = indexHandle;
  state.indexData = indexData;
  await syncIndexWithFilesystem();
}

function updateRootUi() {
  updateRootUI(elements, state.rootHandle, Boolean(state.projectData));
}

async function refreshProjectsList() {
  await refreshProjects(
    state,
    () => syncIndexWithFilesystem(),
    (id) => openProject(id),
    () => {
      state.selectedProjectId = null;
      state.projectHandle = null;
      state.projectImagesHandle = null;
      state.projectData = null;
      state.isDirty = false;
    },
    () => {
      renderProjectList();
      elements.projectEditor.classList.add("hidden");
      elements.projectEmptyState.classList.remove("hidden");
      updateRootUi();
    }
  );
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

// updateRootUi is nu geïmporteerd uit modules/project-manager.js

/**
 * Rendert de lijst met projecten.
 */
function renderProjectList() {
  renderProjectListUI(
    elements.projectList,
    elements.noProjects,
    state.indexData.projects,
    state.selectedProjectId,
    state.sortOrder,
    getCurrentLanguage(),
    (projectId) => openProject(projectId).catch((error) => showError(t("errors.openProject"), error))
  );
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

  // Update LLM status indicator bij laden van project
  updateLLMStatusIndicator();

  elements.promptsContainer.innerHTML = "";
  
  prompts.forEach((prompt, index) => {
    const card = createPromptCard(prompt, index);
    elements.promptsContainer.appendChild(card);
    
    // Voeg transitie button en AI button toe tussen scenes (behalve na laatste scene)
    if (index < prompts.length - 1) {
      // Maak container voor beide buttons (verticaal)
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'transition-ai-container';
      
      // Transitie button
      const transitionBtn = renderTransitionButton(index, state.projectData, (sceneIndex) => {
        showTransitionDialog(sceneIndex, state.projectData, () => {
          state.isDirty = true;
          renderProjectEditor(); // Re-render om status indicator te updaten
        });
      });
      buttonContainer.appendChild(transitionBtn);
      
      // AI Prompt Generator button
      const aiPromptBtn = renderAIPromptButton(index);
      buttonContainer.appendChild(aiPromptBtn);
      
      elements.promptsContainer.appendChild(buttonContainer);
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

// refreshProjectMetaDisplay is nu geïmporteerd uit modules/ui-rendering.js (renderProjectMeta)
function refreshProjectMetaDisplay() {
  renderProjectMeta(elements.projectMeta, state.projectData, state.isDirty);
}

function refreshActiveProjectListItem() {
  if (!state.selectedProjectId || !state.projectData) return;
  const item = elements.projectList.querySelector(`.project-item[data-id="${state.selectedProjectId}"]`);
  if (!item) return;
  updateProjectListItem(item, state.projectData);
}

/**
 * Maakt een kaart voor een prompt inclusief events.
 */
function createPromptCard(prompt, index) {
  const template = elements.promptTemplate.content.cloneNode(true);
  const card = template.querySelector(".prompt-card");
  card.dataset.id = prompt.id;
  
  // Check of dit een audio timeline project is
  const isAudioTimelineProject = state.projectData?.audioTimeline?.fileName;
  
  // Scene index of audio marker tijd
  const indexElement = card.querySelector(".prompt-index");
  if (prompt.isAudioLinked && prompt.audioMarkerTime !== undefined && prompt.audioMarkerTime !== null) {
    // Toon muzieknootje + tijd voor audio-linked scenes
    const minutes = Math.floor(prompt.audioMarkerTime / 60);
    const seconds = Math.floor(prompt.audioMarkerTime % 60);
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    indexElement.innerHTML = `🎵 ${timeStr}`;
    indexElement.title = `Audio marker ${prompt.audioMarkerIndex + 1} op ${timeStr}`;
  } else {
    indexElement.textContent = t("prompts.scene", { index: index + 1 });
  }
  
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
    loadImagePreview(prompt.imagePath, previewImg, state.projectImagesHandle).catch((error) => {
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
    handleDeleteScene(prompt.id).catch((error) => showError(t("errors.deletePrompt"), error));
  });
  
  const moveUpBtn = card.querySelector(".move-up");
  const moveDownBtn = card.querySelector(".move-down");
  const dragHandle = card.querySelector(".drag-handle");
  
  // Bij audio timeline projects: verberg move/drag buttons
  if (isAudioTimelineProject) {
    moveUpBtn.style.display = 'none';
    moveDownBtn.style.display = 'none';
    dragHandle.style.display = 'none';
  } else {
    moveUpBtn.addEventListener("click", () => {
      handleMoveScene(prompt.id, -1);
    });
    moveDownBtn.addEventListener("click", () => {
      handleMoveScene(prompt.id, 1);
    });
    
    // Drag handle events alleen bij niet-audio projects
    dragHandle.addEventListener("dragstart", (event) => {
      localState.draggedPromptId = prompt.id;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", prompt.id);
      card.classList.add("dragging");
    });
    dragHandle.addEventListener("dragend", () => {
      localState.draggedPromptId = null;
      card.classList.remove("dragging");
    });
  }

  // Uploadknop
  const input = card.querySelector(".image-input");
  input.addEventListener("change", (event) => {
    const [file] = event.target.files ?? [];
    if (file) {
      handleImageUpload(prompt.id, file, uploader).catch((error) => showError(t("errors.assignImage"), error));
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
    const file = [...(event.dataTransfer?.files ?? [])].find((f) => f.type.startsWith(MIME_TYPES.IMAGE_PREFIX));
    if (!file) return;
    event.preventDefault();
    card.classList.remove("drag-over");
    handleImageUpload(prompt.id, file, uploader).catch((error) => showError(t("errors.assignImage"), error));
  });

  card.querySelector(".remove-image").addEventListener("click", () => {
    handleImageRemove(prompt.id, uploader).catch((error) => showError(t("errors.removeImage"), error));
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
    loadVideoPreview(prompt.videoPath, videoPreview, state.projectVideosHandle).catch((error) => {
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
      handleVideoUpload(prompt.id, file, videoUploader).catch((error) => showError("Video uploaden mislukt", error));
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
    const file = [...(event.dataTransfer?.files ?? [])].find((f) => f.type.startsWith(MIME_TYPES.VIDEO_PREFIX));
    if (!file) return;
    event.preventDefault();
    videoUploader.classList.remove("drag-over");
    handleVideoUpload(prompt.id, file, videoUploader).catch((error) => showError("Video uploaden mislukt", error));
  });

  card.querySelector(".remove-video").addEventListener("click", () => {
    handleVideoRemove(prompt.id, videoUploader).catch((error) => showError("Video verwijderen mislukt", error));
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

// loadImagePreview, loadVideoPreview, renderStarWidget zijn nu geïmporteerd uit modules/media-handlers.js

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
async function handleDeleteScene(promptId) {
  // Verwijder de scene (inclusief marker regeneratie via event in scenes.js)
  await deletePrompt(promptId, state, elements);
  imageMap.delete(promptId);
  videoMap.delete(promptId);
  clearAttachmentCache(promptId);
  
  // Cleanup transitions voor verwijderde scene
  if (state.projectData) {
    cleanupTransitions(state.projectData, state.projectData.prompts.length);
  }
  
  // Re-render UI om scene cards en marker count bij te werken
  flagProjectDirty();
  renderProjectEditor();
}

/**
 * Wrapper: roept modules/scenes.js movePrompt aan
 */
function handleMoveScene(promptId, direction) {
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
  if (!localState.draggedPromptId) return;
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
}

function handlePromptContainerDrop(event) {
  const promptId = localState.draggedPromptId ?? event.dataTransfer?.getData("text/plain");
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
  localState.draggedPromptId = null;
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
  localState.copyingPromptId = promptId;
  elements.copyDialog.showModal();
}

/**
 * Wrapper: roept modules/scene-copy.js copySceneToProject aan
 */
async function handleCopySceneToProject(promptId, targetProjectId) {
  const result = await copySceneToProject(promptId, targetProjectId, state, imageMap, videoMap);
  if (result.needsRender) {
    renderProjectEditor();
  }
}

/**
 * Wrapper: roept modules/scene-copy.js duplicateSceneInProject aan
 */
async function handleDuplicateScene(promptId) {
  await duplicateSceneInProject(promptId, state, imageMap, videoMap);
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

  // Sla project eerst op als er wijzigingen zijn
  if (state.isDirty) {
    await saveProject();
  }

  // Reset presentation state volledig
  localState.presentationMode.currentSlide = 0;
  localState.presentationMode.languageMode = "both";
  localState.presentationMode.workflowMode = "both"; // Zorg dat workflow mode is ingesteld
  localState.presentationMode.videoMode = false;
  localState.presentationMode.audioMode = false;
  localState.presentationMode.videoTimeline = null;
  localState.presentationMode.audioMarkers = null;
  localState.presentationMode.audioDuration = null;
  localState.presentationMode.audioBuffer = null;
  
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
  localState.presentationMode.videoMode = (savedMode === "video");
  localState.presentationMode.audioMode = (savedMode === "audio-image" || savedMode === "audio-video" || savedMode === "audio-mixed");

  // Initialiseer video timeline als video mode actief is
  if (localState.presentationMode.videoMode) {
    const timeline = await initializeCombinedVideoPresentation(state, localState, elements, t);
    localState.presentationMode.videoTimeline = timeline;
    
    if (!timeline || timeline.segments.length === 0) {
      console.warn("Geen video's gevonden in dit project");
      localState.presentationMode.videoMode = false;
      if (elements.presentationMode) {
        elements.presentationMode.value = "image";
      }
    }
  }
  
  // Initialiseer audio als audio mode actief is EN project heeft audio
  if (localState.presentationMode.audioMode && hasAudio) {
    const audioInitialized = await initializeAudioPresentation(
      state,
      localState,
      elements, 
      state.projectDirHandle,
      getSceneIndexAtTime,
      getAllScenes,
      handlePresentationSlideUpdate
    );
    
    // Als audio niet kon laden, val terug naar image mode
    if (!audioInitialized) {
      console.warn("Audio kon niet worden geladen, terugvallen naar image mode");
      localState.presentationMode.audioMode = false;
      if (elements.presentationMode) {
        elements.presentationMode.value = "image";
      }
    }
  } else if (localState.presentationMode.audioMode && !hasAudio) {
    // Geen audio beschikbaar, forceer image mode
    console.warn("Audio mode geselecteerd maar project heeft geen audio");
    localState.presentationMode.audioMode = false;
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
      if (localState.presentationMode.videoMode) {
        imageContainer.dataset.active = "false";
        videoContainer.dataset.active = "true";
        footer.classList.add("video-mode");
        footer.classList.remove("audio-mode");
        if (form) form.classList.remove("has-audio-timeline");
      } else if (localState.presentationMode.audioMode) {
        const mode = elements.presentationMode.value;
        const showVideo = (mode === "audio-video");
        const mixedMode = (mode === "audio-mixed");
        
        // In mixed mode, bepaal per scene of we video of image tonen
        if (mixedMode) {
          const currentSlideIndex = localState.presentationMode.currentSlide;
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
  localState.presentationMode.currentSlide = 0;
  
  // Laad eerste slide NA het openen van dialog
  await handlePresentationSlideUpdate();
  
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
  if (!localState.presentationMode.audioMarkers || !state.projectData) return -1;
  
  // Zoek laatste marker vóór of gelijk aan deze tijd
  let activeMarkerIndex = -1;
  for (let i = localState.presentationMode.audioMarkers.length - 1; i >= 0; i--) {
    if (time >= localState.presentationMode.audioMarkers[i]) {
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
  return localState.presentationMode.currentSlide;
}

/**
 * Update presentatie-slide met huidige inhoud
 */
/**
 * Wrapper: roept modules/presentation.js updatePresentationSlide of updateCombinedVideoPresentation aan
 * afhankelijk van de geselecteerde modus
 */
async function handlePresentationSlideUpdate() {
  
  if (localState.presentationMode.videoMode && localState.presentationMode.videoTimeline) {
    // Video modus: gebruik combined video presentation
    await updateCombinedVideoPresentation(state, localState, elements, t);
  } else if (localState.presentationMode.audioMode) {
    // Audio modus: gebruik standaard image/video slide update
    const mode = elements.presentationMode ? elements.presentationMode.value : 'audio-image';
    const currentSlideIndex = localState.presentationMode.currentSlide;
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
              
              // Wacht tot video geladen is voordat we auto-play doen
              elements.presentationVideo.addEventListener('loadeddata', () => {
                elements.presentationVideo.play().catch(err => {
                });
              }, { once: true });
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
      updatePresentationSlide(state, localState, elements, t);
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
                
                // Wacht tot video geladen is voordat we auto-play doen
                elements.presentationVideo.addEventListener('loadeddata', () => {
                  elements.presentationVideo.play().catch(err => {
                  });
                }, { once: true });
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
      updatePresentationSlide(state, localState, elements, t);
      
      // Update container visibility voor mixed mode
      updateMixedModeContainers();
    } else {
      // Audio + image: update image slide
      updatePresentationSlide(state, localState, elements, t);
    }
  } else {
    // Standaard image modus: gebruik standaard updatePresentationSlide
    updatePresentationSlide(state, localState, elements, t);
  }
}

/**
 * Wrapper: roept modules/presentation.js nextSlide aan
 */
function handleNextSlide() {
  if (localState.presentationMode.videoMode && localState.presentationMode.videoTimeline) {
    // In video modus: ga naar volgende segment
    const timeline = localState.presentationMode.videoTimeline;
    if (timeline.currentSegmentIndex < timeline.segments.length - 1) {
      timeline.currentSegmentIndex++;
      handlePresentationSlideUpdate();
    }
  } else {
    // In image modus: gebruik standaard nextSlide
    const moved = nextSlide(state, localState);
    if (moved) {
      handlePresentationSlideUpdate();
      // Update container visibility in mixed mode
      updateMixedModeContainers();
    }
  }
}

/**
 * Wrapper: roept modules/presentation.js prevSlide aan
 */
function handlePrevSlide() {
  if (localState.presentationMode.videoMode && localState.presentationMode.videoTimeline) {
    // In video modus: ga naar vorige segment
    const timeline = localState.presentationMode.videoTimeline;
    if (timeline.currentSegmentIndex > 0) {
      timeline.currentSegmentIndex--;
      handlePresentationSlideUpdate();
    }
  } else {
    // In image modus: gebruik standaard prevSlide
    const moved = prevSlide(state, localState);
    if (moved) {
      handlePresentationSlideUpdate();
      // Update container visibility in mixed mode
      updateMixedModeContainers();
    }
  }
}

/**
 * Update image/video container visibility in mixed mode
 */
function updateMixedModeContainers() {
  if (!localState.presentationMode.audioMode) return;
  
  const mode = elements.presentationMode ? elements.presentationMode.value : 'audio-image';
  if (mode !== 'audio-mixed') return;
  
  const imageContainer = document.querySelector('.slide-image-container');
  const videoContainer = document.querySelector('.slide-video-container');
  
  if (!imageContainer || !videoContainer) return;
  
  // Zoek de juiste scene op basis van audioMarkerIndex
  const currentSlideIndex = localState.presentationMode.currentSlide;
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
function handlePresentationLanguageChange(lang) {
  setPresentationLanguage(lang, localState);
  handlePresentationSlideUpdate(); // Update display met nieuwe taal
}

/**
 * Wrapper: roept modules/presentation.js closePresentationMode aan
 */
function handlePresentationClose() {
  closePresentationMode(localState, elements);
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
async function handleImageUpload(promptId, file, uploader) {
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
async function handleImageRemove(promptId, uploader) {
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
async function handleVideoUpload(promptId, file, uploader) {
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
async function handleVideoRemove(promptId, uploader) {
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
  const imagesDir = await projectDir.getDirectoryHandle(DIR_NAMES.IMAGES, { create: true });
  await imagesDir;

  const projectJsonHandle = await projectDir.getFileHandle(FILE_NAMES.PROJECT, { create: true });
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
  
  // Zorg dat we de source project handles hebben
  const sourceProjectDirHandle = state.projectDirHandle;
  const sourceImagesHandle = state.projectImagesHandle;
  const sourceVideosHandle = state.projectVideosHandle;
  const sourceAttachmentsHandle = state.projectAttachmentsHandle;
  
  const slugBase = slugify(newName);
  const existing = new Set(state.indexData.projects.map((p) => p.slug));
  let slug = slugBase;
  let i = 1;
  while (existing.has(slug)) {
    slug = `${slugBase}-${i++}`;
  }

  const projectDir = await state.projectenHandle.getDirectoryHandle(slug, { create: true });
  const imagesDir = await projectDir.getDirectoryHandle(DIR_NAMES.IMAGES, { create: true });
  const videosDir = await projectDir.getDirectoryHandle(DIR_NAMES.VIDEOS, { create: true });
  const attachmentsDir = await projectDir.getDirectoryHandle(DIR_NAMES.ATTACHMENTS, { create: true });
  const projectJsonHandle = await projectDir.getFileHandle(FILE_NAMES.PROJECT, { create: true });
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
    transitions: [], // Initialize transitions array
  };
  
  // Copy transitions array (project-level)
  if (state.projectData.transitions && Array.isArray(state.projectData.transitions)) {
    newProjectData.transitions = state.projectData.transitions.map(t => ({
      sceneIndex: t.sceneIndex,
      description: t.description,
      updatedAt: createdAt
    }));
  }
  
  // Copy audioTimeline data if exists
  if (state.projectData.audioTimeline) {
    newProjectData.audioTimeline = {
      fileName: state.projectData.audioTimeline.fileName,
      markers: [...(state.projectData.audioTimeline.markers || [])],
      duration: state.projectData.audioTimeline.duration,
      isActive: state.projectData.audioTimeline.isActive
    };
    
    // Copy audio file if it exists in the project directory
    if (state.projectData.audioTimeline.fileName && sourceProjectDirHandle) {
      try {
        const audioFileHandle = await sourceProjectDirHandle.getFileHandle(state.projectData.audioTimeline.fileName);
        const audioFile = await audioFileHandle.getFile();
        const targetAudioHandle = await projectDir.getFileHandle(state.projectData.audioTimeline.fileName, { create: true });
        const writable = await targetAudioHandle.createWritable();
        await writable.write(await audioFile.arrayBuffer());
        await writable.close();
      } catch (error) {
        console.warn("Kopiëren van audio bestand mislukt", error);
      }
    }
  }

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
      // Copy audio timeline properties
      isAudioLinked: p.isAudioLinked ?? false,
      audioMarkerIndex: p.audioMarkerIndex ?? undefined,
      audioMarkerTime: p.audioMarkerTime ?? undefined,
      timeline: p.timeline ?? undefined,
      duration: p.duration ?? undefined,
      // Copy other properties
      whatDoWeSee: p.whatDoWeSee ?? "",
      howDoWeMake: p.howDoWeMake ?? "",
      preferredMediaType: p.preferredMediaType ?? undefined,
      // Copy attachments if they exist
      attachments: p.attachments ? [...p.attachments] : undefined,
      // Copy transitions if they exist
      transitions: p.transitions ? {...p.transitions} : undefined
    };
    if (p.imagePath && sourceImagesHandle) {
      try {
        const sourceHandle = await sourceImagesHandle.getFileHandle(p.imagePath);
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
    if (p.videoPath && sourceVideosHandle) {
      try {
        const sourceHandle = await sourceVideosHandle.getFileHandle(p.videoPath);
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
    
    // Copy attachments if they exist
    if (p.attachments && p.attachments.length > 0 && sourceAttachmentsHandle) {
      const copiedAttachments = [];
      for (const attachment of p.attachments) {
        // Attachments gebruiken 'filename' (lowercase), niet 'fileName'
        const attachmentFilename = attachment.filename || attachment.fileName;
        if (!attachment || !attachmentFilename) {
          console.warn('Attachment zonder filename gevonden, wordt overgeslagen', attachment);
          continue;
        }
        try {
          const sourceHandle = await sourceAttachmentsHandle.getFileHandle(attachmentFilename);
          const sourceFile = await sourceHandle.getFile();
          const targetHandle = await attachmentsDir.getFileHandle(attachmentFilename, { create: true });
          const writable = await targetHandle.createWritable();
          await writable.write(await sourceFile.arrayBuffer());
          await writable.close();
          copiedAttachments.push({...attachment});
        } catch (error) {
          console.warn(`Kopiëren van attachment ${attachmentFilename} mislukt`, error);
        }
      }
      if (copiedAttachments.length > 0) {
        newPrompt.attachments = copiedAttachments;
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
  const imagesDir = await projectDir.getDirectoryHandle(DIR_NAMES.IMAGES, { create: true });
  const videosDir = await projectDir.getDirectoryHandle(DIR_NAMES.VIDEOS, { create: true }); // ⭐ NIEUW: videos folder
  const attachmentsDir = await projectDir.getDirectoryHandle(DIR_NAMES.ATTACHMENTS, { create: true }); // ⭐ NIEUW: attachments folder
  const projectFile = await projectDir.getFileHandle(FILE_NAMES.PROJECT, { create: false });

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

  // Reset audio video editor
  resetAudioVideoEditor();
  
  // Registreer callbacks altijd (voor CustomEvent compatibility)
  // OPMERKING: audio-video-editor werkt met CustomEvents, geen callbacks meer nodig
  
  // Laad audio timeline data indien aanwezig
  if (projectData.audioTimeline) {
    
    // FIX: Valideer en repareer duplicate marker assignments
    fixDuplicateMarkerAssignments(projectData);
    
    // Auto-detect audio bestand als fileName ontbreekt
    let audioFileName = projectData.audioTimeline.fileName;
    
    if (!audioFileName) {
      // Zoek naar audio bestanden in de project map
      try {
        const entries = [];
        for await (const entry of projectDir.values()) {
          if (entry.kind === 'file' && entry.name.match(/\.(wav|mp3|ogg|m4a|aac|flac)$/i)) {
            entries.push(entry.name);
          }
        }
        
        if (entries.length > 0) {
          // Gebruik eerste gevonden audio bestand
          audioFileName = entries[0];
          projectData.audioTimeline.fileName = audioFileName;
        }
      } catch (err) {
        console.warn('Could not scan for audio files:', err);
      }
    }
    
    // Laad audio bestand automatisch in de NIEUWE audio-video-editor
    if (audioFileName) {
      try {
        await loadAudioFromProjectDir(projectDir, audioFileName);
      } catch (err) {
        console.warn('⚠️ Audio bestand niet gevonden in project map:', audioFileName);
      }
    }
    
    // Restore markers data EENMALIG (met projectData voor scene sync)
    restoreAudioTimelineFromData(projectData.audioTimeline, projectData);
    
    // NIET syncScenesWithMarkers aanroepen bij project load!
    // De scenes zijn al gekoppeld aan markers via audioMarkerIndex
    // syncScenesWithMarkers is alleen voor NIEUWE audio uploads
    
    // Zet projectData EERST in state voordat cleanup draait
    state.projectData = projectData;
    
    // Sync scene markers naar audioTimeline.markers array VOOR cleanup
    syncSceneMarkersToTimeline();
    
    // FIX: Reset scenes met ongeldige marker indices
    cleanupInvalidSceneMarkerIndices();
    
    // FIX: Repareer negatieve durations NA sync (zodat alle markers beschikbaar zijn)
    fixNegativeDurations(projectData);
    
    // Cleanup: Verwijder orphaned markers (markers zonder gekoppelde scene)
    cleanupOrphanedMarkers();
    
    // Check of audioTimeline nog bestaat na cleanup (kan zijn verwijderd als er geen scenes zijn)
    if (!state.projectData.audioTimeline || !state.projectData.audioTimeline.markers) {
      // Geen audio timeline meer, stop hier
      state.isDirty = false;
      renderProjectEditor();
      return;
    }
    
    // OUDE AUTO-FIX CODE VERWIJDERD
    // Scenes hoeven GEEN media te hebben om aan markers gekoppeld te zijn
    // De koppeling is puur gebaseerd op audioMarkerTime en isAudioLinked
    
    state.isDirty = false;
    
    // Sorteer scenes op basis van audio marker volgorde
    sortScenesByAudioMarkers();
    
    // Markers worden automatisch bijgewerkt via audio-video-editor.js
    
    // ALTIJD: Zorg dat audio timeline container hidden is na project load
    const audioContainer = document.querySelector("#audio-timeline-container");
    if (audioContainer) {
      audioContainer.classList.add("hidden");
    }
  }

  renderProjectList();
  renderProjectEditor();
  updateRootUi();
  
  // Initialiseer LLM settings (test connectie en laad models)
  await initializeLLMForProject();
  
  // Update audio timeline button NADAT renderProjectEditor() is aangeroepen
  // (renderProjectEditor roept applyTranslations aan die de button innerHTML overschrijft)
  if (state.projectData.audioTimeline) {
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
 * Bereken de duration van een prompt op basis van audio timeline markers
 * @param {string} promptId - ID van de prompt
 * @returns {number|null} Duration in seconden of null als niet gekoppeld
 */
function calculatePromptDuration(promptId) {
  if (!state.projectData?.prompts || !state.projectData?.audioTimeline?.markers) {
    return null;
  }
  
  const prompt = state.projectData.prompts.find(p => p.id === promptId);
  if (!prompt || !prompt.isAudioLinked || prompt.audioMarkerIndex === undefined) {
    return null;
  }
  
  const markers = state.projectData.audioTimeline.markers;
  const totalDuration = state.projectData.audioTimeline.duration || 0;
  const markerIndex = prompt.audioMarkerIndex;
  
  const markerTime = markers[markerIndex];
  const nextMarkerTime = markers[markerIndex + 1] || totalDuration;
  
  return nextMarkerTime - markerTime;
}

/**
 * Fix negatieve durations door timeline/duration opnieuw te berekenen
 */
function fixNegativeDurations(projectData) {
  if (!projectData?.prompts || !projectData?.audioTimeline) {
    return;
  }

  const markers = projectData.audioTimeline.markers || [];
  const totalDuration = projectData.audioTimeline.duration || 0;

  projectData.prompts.forEach(prompt => {
    if (prompt.isAudioLinked && prompt.audioMarkerIndex !== undefined) {
      const markerIndex = prompt.audioMarkerIndex;
      const markerTime = markers[markerIndex];
      const nextMarkerTime = markers[markerIndex + 1] || totalDuration;
      
      // Herbereken timeline en duration
      prompt.timeline = `${formatTime(markerTime)} - ${formatTime(nextMarkerTime)}`;
      prompt.duration = (nextMarkerTime - markerTime).toFixed(2);
    }
  });
}

/**
 * Sync alle scene audioMarkerTime waarden naar audioTimeline.markers array
 * Dit zorgt ervoor dat scenes die zijn aangemaakt hun markers behouden
 */
function syncSceneMarkersToTimeline() {
  if (!state.projectData?.audioTimeline || !state.projectData?.prompts) return;
  
  // Verzamel alle marker times van scenes
  const sceneMarkerTimes = new Set();
  state.projectData.prompts.forEach((scene, idx) => {
    let markerTime = scene.audioMarkerTime;
    
    // Als audioMarkerTime ontbreekt maar timeline bestaat, haal tijd uit timeline string
    if ((markerTime === undefined || markerTime === 0) && scene.timeline && scene.isAudioLinked) {
      // Parse timeline formaat: "00:26.688 - 00:31.688" of "0:26 - 0:31" of "01:15.802 - 04:24.746"
      const timeMatch = scene.timeline.match(/^(\d+):(\d+(?:\.\d+)?)/);
      if (timeMatch) {
        const minutes = parseInt(timeMatch[1]);
        const seconds = parseFloat(timeMatch[2]);
        markerTime = minutes * 60 + seconds;
        
        // Update scene met de geparsede tijd
        scene.audioMarkerTime = markerTime;
      }
    }
    
    if (markerTime !== undefined && markerTime > 0) {
      sceneMarkerTimes.add(markerTime);
    }
  });
  
  // Voeg ontbrekende marker times toe aan audioTimeline.markers
  sceneMarkerTimes.forEach(time => {
    const markerExists = state.projectData.audioTimeline.markers.some(m => 
      Math.abs(m - time) < 0.01
    );
    
    if (!markerExists) {
      state.projectData.audioTimeline.markers.push(time);
    }
  });
  
  // Sorteer markers op tijd
  state.projectData.audioTimeline.markers.sort((a, b) => a - b);
  
  // Update alle audioMarkerIndex waarden na sync
  state.projectData.prompts.forEach(scene => {
    if (scene.isAudioLinked && scene.audioMarkerTime !== undefined && scene.audioMarkerTime > 0) {
      const newIndex = state.projectData.audioTimeline.markers.findIndex(m => 
        Math.abs(m - scene.audioMarkerTime) < 0.01
      );
      if (newIndex !== -1) {
        scene.audioMarkerIndex = newIndex;
      }
    }
  });
}

/**
 * Reset scenes met ongeldige marker indices naar ontkoppeld
 * Dit gebeurt wanneer audioMarkerIndex verwijst naar een niet-bestaande marker
 */
function cleanupInvalidSceneMarkerIndices() {
  if (!state.projectData?.prompts) return;
  
  // NIEUWE STRATEGIE: Scenes zijn leidend, niet audioTimeline.markers
  // Check alleen of scenes geldige audioMarkerTime hebben
  state.projectData.prompts.forEach(scene => {
    if (scene.isAudioLinked) {
      // Check of audioMarkerTime geldig is (moet >= 0 zijn)
      const hasValidTime = scene.audioMarkerTime !== undefined && scene.audioMarkerTime >= 0;
      
      // audioMarkerIndex mag undefined zijn - wordt dynamisch gegenereerd bij restore
      
      // Als scene gekoppeld is maar geen geldige tijd heeft, ontkoppel
      if (!hasValidTime) {
        console.warn('⚠️ Cleanup: Scene heeft isAudioLinked maar geen geldige audioMarkerTime:', scene.id.substring(0, 8));
        scene.isAudioLinked = false;
        delete scene.audioMarkerIndex;
        delete scene.audioMarkerTime;
        delete scene.timeline;
        delete scene.duration;
      }
    }
  });
}

/**
 * Verwijder orphaned markers (markers zonder gekoppelde scene)
 * EN verwijder audio timeline als er geen scenes meer zijn
 */
function cleanupOrphanedMarkers() {
  if (!state.projectData?.audioTimeline?.markers) return;
  
  const markers = state.projectData.audioTimeline.markers;
  const prompts = state.projectData.prompts || [];
  
  // Filter scenes: actief gekoppeld OF hebben audioMarkerTime (inactief maar wel gekoppeld geweest)
  const scenesWithMarkers = prompts.filter(p => 
    (p.isAudioLinked && p.audioMarkerIndex !== undefined) || 
    (p.audioMarkerTime !== undefined)
  );
  
  // Als er geen prompts zijn, verwijder ALLES: markers EN audio timeline
  if (prompts.length === 0 && state.projectData.audioTimeline) {
    // Verwijder audio bestand uit project map
    if (state.projectData.audioTimeline.fileName && state.projectDirHandle) {
      state.projectDirHandle.removeEntry(state.projectData.audioTimeline.fileName).catch(() => {
        // Bestand bestaat niet meer, negeer error
      });
    }
    
    // Verwijder hele audioTimeline uit projectData
    delete state.projectData.audioTimeline;
    state.isDirty = true;
    
    // Dispatch event naar editor om audio timeline te sluiten/resetten
    const clearEvent = new CustomEvent('clearAudioTimeline');
    document.dispatchEvent(clearEvent);
    
    // Forceer render zodat veranderingen zichtbaar zijn
    renderProjectEditor();
    return;
  }
  
  // Maak een set van gebruikte marker tijden (gebruik audioMarkerTime als bron)
  const usedMarkerTimes = new Set();
  scenesWithMarkers.forEach(scene => {
    if (scene.audioMarkerTime !== undefined) {
      usedMarkerTimes.add(scene.audioMarkerTime);
    }
  });
  
  // Filter markers: behoud alleen markers die door een scene worden gebruikt
  const cleanedMarkers = markers.filter((markerTime, index) => {
    // Check of deze marker tijd voorkomt in de set van gebruikte tijden
    for (const usedTime of usedMarkerTimes) {
      if (Math.abs(markerTime - usedTime) < 0.01) {
        return true; // Marker wordt gebruikt
      }
    }
    return false; // Orphaned marker
  });
  
  if (cleanedMarkers.length !== markers.length) {
    state.projectData.audioTimeline.markers = cleanedMarkers;
    
    // Update alle scene indices na cleanup
    scenesWithMarkers.forEach(scene => {
      if (scene.audioMarkerTime !== undefined) {
        // Vind de nieuwe index voor deze marker tijd
        const newIndex = cleanedMarkers.findIndex(time => Math.abs(time - scene.audioMarkerTime) < 0.01);
        if (newIndex !== -1) {
          // Update audioMarkerIndex voor actief gekoppelde scenes
          if (scene.isAudioLinked) {
            scene.audioMarkerIndex = newIndex;
          }
        }
      }
    });
    
    // Dispatch event naar editor om markers te updaten
    const event = new CustomEvent('markersReindexed', {
      detail: { markers: cleanedMarkers }
    });
    document.dispatchEvent(event);
    document.dispatchEvent(event);
    
    state.isDirty = true;
    
    // Forceer render zodat veranderingen zichtbaar zijn
    renderProjectEditor();
  }
}

/**
 * Wrapper: roept modules/scenes.js addPrompt aan
 * @param {Object} sceneData - Optionele scene data (voor audio timeline)
 */
function handleAddScene(sceneData = null) {
  // Voorkom handmatig scenes toevoegen als audio timeline actief is
  if (!sceneData && state.projectData?.audioTimeline?.fileName) {
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
    if (sceneData.audioMarkerTime !== undefined) prompt.audioMarkerTime = sceneData.audioMarkerTime;
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
  
  // Check of er al een scene is voor deze marker TIME (niet index!)
  // We checken op audioMarkerTime omdat markerIndex kan veranderen bij herschikken
  const markerTime = sceneData.audioMarkerTime || parseFloat(sceneData.timeline?.split(' - ')[0]) || 0;
  
  const existingScene = state.projectData.prompts.find(p => 
    p.isAudioLinked && Math.abs(p.audioMarkerTime - markerTime) < 0.01
  );
  
  if (existingScene) {
    console.warn('Scene already exists for marker at time', markerTime);
    return;
  }
  
  // Initialiseer audioTimeline object als het nog niet bestaat
  if (!state.projectData.audioTimeline) {
    // Haal audio data op van audio-video-editor
    const editorAudioData = getAudioTimelineData();
    
    state.projectData.audioTimeline = {
      fileName: editorAudioData?.fileName || '',
      markers: [],
      duration: editorAudioData?.duration || 0,
      isActive: true,
      audioBuffer: true
    };
  }
  
  // Voeg marker toe aan state.projectData.audioTimeline.markers als deze er nog niet is
  if (state.projectData.audioTimeline && markerTime !== undefined) {
    const markerExists = state.projectData.audioTimeline.markers.some(m => 
      Math.abs(m - markerTime) < 0.01
    );
    
    if (!markerExists) {
      state.projectData.audioTimeline.markers.push(markerTime);
      // Sorteer markers op tijd
      state.projectData.audioTimeline.markers.sort((a, b) => a - b);
    }
  }
  
  // Voeg scene toe via wrapper (met sceneData)
  const newPrompt = handleAddScene(sceneData);
  
  if (newPrompt) {
    // Sorteer scenes direct zodat de nieuwe scene op de juiste positie staat
    const activeScenes = state.projectData.prompts.filter(p => p.isAudioLinked);
    const inactiveScenes = state.projectData.prompts.filter(p => !p.isAudioLinked);
    
    // Sorteer active scenes op audioMarkerIndex
    activeScenes.sort((a, b) => (a.audioMarkerIndex || 0) - (b.audioMarkerIndex || 0));
    
    // Combineer: active eerst, daarna inactive
    state.projectData.prompts = [...activeScenes, ...inactiveScenes];
    
    // Re-render zodat de nieuwe scene direct zichtbaar is
    renderProjectEditor();
  }
}

/**
 * Update alle audioMarkerIndex waarden na marker herschikking
 * Dit wordt aangeroepen wanneer markers worden toegevoegd/verplaatst/verwijderd
 */
function handleMarkersReindexed(markerTimes) {
  if (!state.projectData || !state.projectData.prompts) return;
  
  // Normalize incoming markerTimes (round to ms) and update projectData
  const roundTime = (t) => Math.round((Number(t) || 0) * 1000) / 1000;
  const normalizedMarkers = markerTimes.map(m => roundTime(m));

  // Update projectData markers met de genormaliseerde lijst
  if (state.projectData.audioTimeline) {
    state.projectData.audioTimeline.markers = normalizedMarkers.map(t => Number(t));
  }
  
  let hasChanges = false;
  let disconnectedScenes = [];
  
  // Update elke gekoppelde scene met de nieuwe markerIndex
  state.projectData.prompts.forEach(prompt => {
    if (!prompt.isAudioLinked || prompt.audioMarkerTime === undefined) return;
    
    // Vind de nieuwe index voor deze marker tijd
    const newIndex = markerTimes.findIndex(time => Math.abs(time - prompt.audioMarkerTime) < 0.01);
    
    if (newIndex === -1) {
      // Marker bestaat niet meer - ontkoppel de scene maar behoud audioMarkerTime
      prompt.isAudioLinked = false;
      delete prompt.audioMarkerIndex;
      // BEHOUD audioMarkerTime zodat scene als "ontkoppeld" kan worden herkend
      disconnectedScenes.push(prompt);
      hasChanges = true;
    } else if (newIndex !== prompt.audioMarkerIndex) {
      prompt.audioMarkerIndex = newIndex;
      // Update audioMarkerTime naar genormaliseerde waarde
      prompt.audioMarkerTime = normalizedMarkers[newIndex];
      hasChanges = true;
    }
  });
  
  if (disconnectedScenes.length > 0) {
    // Scenes zijn ontkoppeld
  }
  
  if (hasChanges) {
    updateInactiveScenesAfterMarkers();
  } else {
    // Ook refreshen als er geen changes zijn (voor visuele update)
    renderProjectEditor();
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
}

// formatTime is nu geïmporteerd uit modules/dom-helpers.js

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
  
  // Check of er al een andere scene aan deze marker gekoppeld is
  const existingScene = state.projectData.prompts.find(p => 
    p.id !== sceneId && p.isAudioLinked && p.audioMarkerIndex === markerIndex
  );
  
  if (existingScene) {
    // Ontkoppel de oude scene
    existingScene.isAudioLinked = false;
    delete existingScene.audioMarkerIndex;
    delete existingScene.audioMarkerTime;
    delete existingScene.timeline;
    delete existingScene.duration;
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
  
  // Regenereer markers uit scenes (audio editor sync)
  const regenerateEvent = new CustomEvent('regenerateMarkersFromScenes', {
    detail: { projectData: state.projectData }
  });
  document.dispatchEvent(regenerateEvent);
  
  // renderProjectEditor() wordt automatisch getriggerd via renderProjectEditorRequest
  // Re-render wordt nu gedaan in updateInactiveScenesAfterMarkers
  // updateInactiveScenesAfterMarkers();
}

/**
 * Verwijder marker uit project (zowel uit projectData als uit editor)
 * Nieuwe architectuur: Markers zitten in scenes, niet in aparte array
 */
function deleteMarkerFromProject(markerIndex) {
  if (!state.projectData?.prompts) return;
  
  // Vind de scene die aan deze marker is gekoppeld
  const sceneToDisconnect = state.projectData.prompts.find(p => 
    p.isAudioLinked && p.audioMarkerIndex === markerIndex
  );
  
  if (sceneToDisconnect) {
    // Ontkoppel de scene van de marker
    sceneToDisconnect.isAudioLinked = false;
    sceneToDisconnect.audioMarkerIndex = null;
    sceneToDisconnect.audioMarkerTime = null;
  }
  
  // Dispatch event om markers te regenereren uit scenes
  const regenerateEvent = new CustomEvent('regenerateMarkersFromScenes', {
    detail: { projectData: state.projectData }
  });
  document.dispatchEvent(regenerateEvent);
  
  // Mark project dirty en re-render
  state.isDirty = true;
  renderProjectEditor();
}

/**
 * Haal de tijd van de volgende marker op (of audio duration)
 */
function getNextMarkerTime(markerIndex) {
  if (!state.projectData?.audioTimeline) return 0;
  
  const markers = state.projectData.audioTimeline.markers || [];
  const nextMarker = markers[markerIndex + 1];
  
  // Gebruik de duration uit audioTimeline
  const totalDuration = state.projectData.audioTimeline.duration || 0;
  
  return nextMarker !== undefined ? nextMarker : totalDuration;
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
    // Update scene audioMarkerTime
    scene.audioMarkerTime = newTime;
    state.isDirty = true;
  }
}

/**
 * Handle marker volgorde wijziging vanuit audio editor
 * Nieuwe architectuur: Markers worden altijd gegenereerd uit scenes
 * Bij drag moeten we scenes herschikken om volgorde te matchen
 */
function handleMarkerReorderFromEditor(oldIndex, newIndex) {
  if (!state.projectData || !state.projectData.prompts) return;
  
  // Vind de scene die verplaatst moet worden
  const sceneToMove = state.projectData.prompts.find(p => 
    p.isAudioLinked && p.audioMarkerIndex === oldIndex
  );
  
  if (!sceneToMove) {
    return;
  }
  
  // Vind de positie van deze scene in de prompts array
  const sceneIndexInArray = state.projectData.prompts.indexOf(sceneToMove);
  
  // Bepaal waar de scene naartoe moet in de prompts array
  // We moeten rekening houden met niet-linked scenes die tussen markers zitten
  let targetPosition;
  
  if (newIndex === 0) {
    // Naar het begin
    targetPosition = 0;
  } else {
    // Zoek de scene met audioMarkerIndex = newIndex - 1
    const previousMarkerScene = state.projectData.prompts.find(p => 
      p.isAudioLinked && p.audioMarkerIndex === newIndex - 1
    );
    
    if (previousMarkerScene) {
      targetPosition = state.projectData.prompts.indexOf(previousMarkerScene) + 1;
    } else {
      targetPosition = newIndex;
    }
  }
  
  // Verplaats de scene in de prompts array
  if (sceneIndexInArray !== targetPosition) {
    state.projectData.prompts.splice(sceneIndexInArray, 1);
    
    // Herbereken target position als scene voor de nieuwe positie stond
    if (sceneIndexInArray < targetPosition) {
      targetPosition--;
    }
    
    state.projectData.prompts.splice(targetPosition, 0, sceneToMove);
  }
  
  // Regenereer markers uit scenes (dit update automatisch alle audioMarkerIndex waarden)
  const regenerateEvent = new CustomEvent('regenerateMarkersFromScenes', {
    detail: { projectData: state.projectData }
  });
  document.dispatchEvent(regenerateEvent);
  
  // renderProjectEditor() wordt automatisch getriggerd via renderProjectEditorRequest event
  // na regenerateMarkersFromScenes (zie event listener in audio-video-editor.js)
  state.isDirty = true;
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
  if (!state.projectData || !state.projectData.prompts) {
    return;
  }
  
  // Check of er audio timeline data is
  if (!state.projectData.audioTimeline || !state.projectData.audioTimeline.markers) {
    return;
  }
  
  const markers = state.projectData.audioTimeline.markers; // Deze zijn al gesorteerd op tijd
  
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
  
  // Markers display wordt automatisch bijgewerkt via audio-video-editor.js
  
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
  
  if (!scene) {
    console.warn('Scene not found at index:', sceneIndex);
    return;
  }
  
  // Check of deze scene niet al gekoppeld is
  if (scene.isAudioLinked) {
    console.warn('Scene is al gekoppeld aan een marker');
    return;
  }
  
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
    
    // Haal audio data op van audio-video-editor module
    const audioData = getAudioTimelineData(state.projectData);
    
    // Update audioTimeline metadata in project.json (ZONDER markers array!)
    if (audioData && audioData.fileName) {
      // Initialiseer audioTimeline als die niet bestaat
      if (!state.projectData.audioTimeline) {
        state.projectData.audioTimeline = {
          fileName: audioData.fileName || '',
          markers: [], // Blijft leeg - markers zitten in scenes
          duration: audioData.duration || 0,
          isActive: true,
          audioBuffer: true
        };
      } else {
        // Update bestaande audioTimeline (markers blijven leeg)
        state.projectData.audioTimeline.fileName = audioData.fileName;
        state.projectData.audioTimeline.duration = audioData.duration;
        state.projectData.audioTimeline.isActive = true;
        state.projectData.audioTimeline.audioBuffer = true;
        state.projectData.audioTimeline.markers = []; // Expliciet leeg
      }
      
    }
    
    // Sla audio bestand op in project map (ALLEEN bij nieuwe upload!)
    if (audioData?.isNewUpload && audioData.audioFile && state.projectDirHandle) {
      try {
        console.log('📁 Nieuwe audio upload - bestand opslaan:', audioData.fileName);
        
        // Lees het File object als ArrayBuffer
        const arrayBuffer = await audioData.audioFile.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: audioData.audioFile.type || 'audio/wav' });
        
        const audioFileHandle = await state.projectDirHandle.getFileHandle(audioData.fileName, { create: true });
        const writable = await audioFileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        
        console.log('✅ Audio bestand opgeslagen:', audioData.fileName);
        
        // BELANGRIJK: Clear het File object in de editor module
        clearAudioFileReference();
        
      } catch (err) {
        console.error('❌ Fout bij opslaan audio bestand:', err);
        showError(t("errors.audioSaveFailed"), err);
      }
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

    localState.pendingExportText = lines.join("\n\n");
    localState.pendingExportCount = lines.length;
    state.pendingExportMode = mode;
    if (elements.exportPreviewText) {
      elements.exportPreviewText.value = localState.pendingExportText;
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

// copyToClipboard is nu geïmporteerd uit modules/dialogs.js

async function finalizePromptExport() {
  if (!localState.pendingExportText || !state.projectHandle) return;
  const text = localState.pendingExportText;
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

  localState.pendingExportText = null;
  localState.pendingExportCount = 0;
  updateExportPreviewInfo();
}

async function handleExportPreviewCopy() {
  if (!localState.pendingExportText) return;
  try {
    await copyToClipboard(localState.pendingExportText);
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
    localState.pendingExportText = null;
    localState.pendingExportCount = 0;
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
  if (localState.dialogImageUrl) {
    URL.revokeObjectURL(localState.dialogImageUrl);
    localState.dialogImageUrl = null;
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
    localState.dialogImageUrl = blobUrl;
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
  localState.dialogPromptId = promptId;

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
    // Bereken automatisch duration op basis van audio timeline markers
    const calculatedDuration = calculatePromptDuration(prompt.id);
    elements.dialogDuration.value = calculatedDuration !== null ? calculatedDuration.toFixed(2) : (prompt.duration ?? "");
    
    // Maak read-only als er een audio timeline is (auto-calculated)
    if (state.projectData?.audioTimeline?.markers && calculatedDuration !== null) {
      elements.dialogDuration.disabled = true;
      elements.dialogDuration.title = "Automatisch berekend uit audio timeline markers";
    } else {
      elements.dialogDuration.disabled = false;
      elements.dialogDuration.title = "";
    }
  }
  
  elements.dialogOpenImage.disabled = !prompt.imagePath;

  // Pas workflow mode toe op dialog
  applyWorkflowModeToDialog();
  
  // Laad rating widget
  if (elements.dialogRating) {
    renderStarWidget(elements.dialogRating, prompt.rating ?? 0, (val) => {
      if (prompt) {
        prompt.rating = val;
        state.isDirty = true;
      }
    });
  }
  
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
  if (!state.projectData || !localState.dialogPromptId) return;
  
  const currentPrompt = state.projectData.prompts.find(p => p.id === localState.dialogPromptId);
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
    
    // Rating wordt al direct opgeslagen via renderStarWidget callback
    
    flagProjectDirty();
  }
  
  // Open new scene
  const newPrompt = state.projectData.prompts[newIndex];
  openPromptDialog(newPrompt.id);
}

function handlePromptDialogClose() {
  const wasSaved = elements.promptDialog.returnValue === "save";
  if (!state.projectData || !localState.dialogPromptId) {
    resetDialogImageState();
    localState.dialogPromptId = null;
    return;
  }
  const prompt = state.projectData.prompts.find((item) => item.id === localState.dialogPromptId);
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

  localState.dialogPromptId = null;
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
  if (!state.projectData || !localState.dialogPromptId) {
    showError(t("errors.noSceneSelected"));
    return;
  }
  const prompt = state.projectData.prompts.find((item) => item.id === localState.dialogPromptId);
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

// ============================================================================
// LLM SETTINGS HANDLERS
// ============================================================================

/**
 * Update status indicator kleur op basis van LLM configuratie.
 * Groen = actief, Rood = inactief.
 */
function updateLLMStatusIndicator() {
  const indicator = elements.llmStatusIndicator;
  if (!indicator) return;
  
  const config = state.projectData?.llmSettings;
  if (isLLMServiceActive(config)) {
    indicator.classList.add('active');
  } else {
    indicator.classList.remove('active');
  }
}

/**
 * Laad LLM configuratie vanuit project.json en vul formulier.
 */
function loadLLMSettings() {
  if (!state.projectData) return;
  
  // Zorg ervoor dat llmSettings bestaat (voor oude projecten)
  if (!state.projectData.llmSettings) {
    state.projectData.llmSettings = { ...PROJECT_DEFAULTS.llmSettings };
  }
  
  const config = state.projectData.llmSettings;
  
  // Vul formulier met opgeslagen waarden
  if (elements.llmEnabled) elements.llmEnabled.checked = config.enabled || false;
  if (elements.llmOllamaUrl) elements.llmOllamaUrl.value = config.ollamaUrl || 'http://localhost:11434';
  if (elements.llmImageModel) elements.llmImageModel.value = config.imageAnalysisModel || 'llava:latest';
  if (elements.llmPromptModel) elements.llmPromptModel.value = config.promptGenerationModel || 'llama3.2:latest';
  // OPMERKING: instructies worden NIET meer geladen - altijd DEFAULT_CONFIG gebruiken
  
  // Update status indicator
  updateLLMStatusIndicator();
}

/**
 * Sla LLM configuratie op in project.json.
 */
function saveLLMSettings() {
  if (!state.projectData) {
    showError("Geen project geopend");
    return;
  }
  
  // Sla alleen model selectie en URL op - instructies komen altijd uit DEFAULT_CONFIG
  const config = {
    enabled: elements.llmEnabled?.checked || false,
    ollamaUrl: elements.llmOllamaUrl?.value || 'http://localhost:11434',
    imageAnalysisModel: elements.llmImageModel?.value || 'llava:latest',
    promptGenerationModel: elements.llmPromptModel?.value || 'llama3.2:latest',
    // OPMERKING: imageAnalysisInstruction en promptGenerationInstruction
    // worden NIET opgeslagen - altijd DEFAULT_CONFIG uit llm-service.js gebruiken
  };
  
  state.projectData.llmSettings = config;
  
  // Mark project als dirty en sla op
  flagProjectDirty();
  
  // Update status indicator
  updateLLMStatusIndicator();
  
  // Sluit dialoog
  if (elements.llmSettingsDialog) {
    elements.llmSettingsDialog.close();
  }
  
  showSuccess(t("llm.settingsSaved"));
}

/**
 * Test Ollama connectie en haal beschikbare models op.
 */
async function testLLMConnection() {
  const statusEl = elements.llmConnectionStatus;
  if (!statusEl) return;
  
  const url = elements.llmOllamaUrl?.value || 'http://localhost:11434';
  
  try {
    statusEl.textContent = 'Testen en modellen ophalen...';
    statusEl.className = 'status-text';
    
    // Test connectie EN haal models op
    const models = await testOllamaConnection(url);
    
    statusEl.textContent = t("llm.connectionSuccess") + ` (${models.length} models)`;
    statusEl.className = 'status-text success';
    
    // Vul direct de dropdowns met gefilterde models
    await refreshLLMModels();
  } catch (error) {
    statusEl.textContent = t("llm.connectionFailed");
    statusEl.className = 'status-text error';
    console.error('Ollama connectie test mislukt:', error);
  }
}

/**
 * Ververs beschikbare models in dropdowns.
 */
async function refreshLLMModels() {
  const url = elements.llmOllamaUrl?.value || 'http://localhost:11434';
  
  try {
    // Haal vision models op voor image analysis
    const visionModels = await getAvailableModels(url, 'vision');
    
    // Haal text models op voor prompt generation
    const textModels = await getAvailableModels(url, 'text');
    
    // Update image model dropdown (vision models)
    if (elements.llmImageModel) {
      const currentValue = elements.llmImageModel.value;
      elements.llmImageModel.innerHTML = '';
      
      if (visionModels.length === 0) {
        const option = document.createElement('option');
        option.value = 'llava:latest';
        option.textContent = 'llava:latest (niet geïnstalleerd)';
        elements.llmImageModel.appendChild(option);
      } else {
        visionModels.forEach(model => {
          const option = document.createElement('option');
          option.value = model.name;
          option.textContent = model.name;
          elements.llmImageModel.appendChild(option);
        });
        
        // Herstel vorige selectie als mogelijk
        if (visionModels.find(m => m.name === currentValue)) {
          elements.llmImageModel.value = currentValue;
        }
      }
    }
    
    // Update prompt model dropdown (text models)
    if (elements.llmPromptModel) {
      const currentValue = elements.llmPromptModel.value;
      elements.llmPromptModel.innerHTML = '';
      
      if (textModels.length === 0) {
        const option = document.createElement('option');
        option.value = 'llama3.2:latest';
        option.textContent = 'llama3.2:latest (niet geïnstalleerd)';
        elements.llmPromptModel.appendChild(option);
      } else {
        textModels.forEach(model => {
          const option = document.createElement('option');
          option.value = model.name;
          option.textContent = model.name;
          elements.llmPromptModel.appendChild(option);
        });
        
        // Herstel vorige selectie als mogelijk
        if (textModels.find(m => m.name === currentValue)) {
          elements.llmPromptModel.value = currentValue;
        }
      }
    }
  } catch (error) {
    console.error('Models ophalen mislukt:', error);
  }
}

/**
 * Initialiseer LLM voor nieuw geopend project.
 * Test connectie en laad beschikbare models in achtergrond.
 */
async function initializeLLMForProject() {
  if (!state.projectData?.llmSettings) {
    return;
  }
  
  const config = state.projectData.llmSettings;
  
  // Skip als LLM niet enabled is
  if (!config.enabled) {
    return;
  }
  
  // Test connectie in achtergrond (geen await - non-blocking)
  testLLMConnection().catch(err => {
    console.warn('LLM connectie test bij project open mislukt:', err);
  });
  
  // Laad models in achtergrond (geen await - non-blocking)
  refreshLLMModels().then(() => {
    // Na models laden: herstel geselecteerde models uit project config
    if (config.imageAnalysisModel && elements.llmImageModel) {
      // Check of model bestaat in dropdown
      const options = Array.from(elements.llmImageModel.options);
      if (options.find(opt => opt.value === config.imageAnalysisModel)) {
        elements.llmImageModel.value = config.imageAnalysisModel;
      }
    }
    
    if (config.promptGenerationModel && elements.llmPromptModel) {
      // Check of model bestaat in dropdown
      const options = Array.from(elements.llmPromptModel.options);
      if (options.find(opt => opt.value === config.promptGenerationModel)) {
        elements.llmPromptModel.value = config.promptGenerationModel;
      }
    }
  }).catch(err => {
    console.warn('LLM models laden bij project open mislukt:', err);
  });
}

/**
 * Reset LLM configuratie naar defaults.
 */
function resetLLMSettings() {
  if (!state.projectData) {
    showError("Geen project geopend");
    return;
  }
  
  state.projectData.llmSettings = { ...PROJECT_DEFAULTS.llmSettings };
  loadLLMSettings();
  flagProjectDirty();
  showSuccess("LLM instellingen gereset naar standaard");
}

/**
 * Open LLM settings dialoog.
 */
function openLLMSettings() {
  if (!state.projectData) {
    showError("Open eerst een project om LLM instellingen te wijzigen");
    return;
  }
  
  if (elements.llmSettingsDialog) {
    // Laad huidige settings
    loadLLMSettings();
    
    // Update status indicator in dialog header
    const dialogStatus = document.getElementById('llm-dialog-status');
    if (dialogStatus) {
      const isActive = isLLMServiceActive(state.projectData.llmSettings);
      dialogStatus.className = `llm-dialog-status-indicator ${isActive ? 'active' : 'inactive'}`;
    }
    
    elements.llmSettingsDialog.showModal();
  }
}

/**
 * Sluit LLM settings dialoog.
 */
function closeLLMSettings() {
  if (elements.llmSettingsDialog) {
    elements.llmSettingsDialog.close();
  }
}

/**
 * Wissel tussen tabs in LLM settings dialoog.
 */
function switchLLMTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    if (content.id === `${tabName}-tab`) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });
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

  setLanguage(getCurrentLanguage(), { reRender: false });
  
  // Initialiseer help systeem (laadt ook opgeslagen workflow mode)
  initializeHelpSystem(getCurrentLanguage());

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

  // LLM Settings event listeners
  if (elements.llmSettingsBtn) {
    elements.llmSettingsBtn.addEventListener("click", openLLMSettings);
  }
  if (elements.llmSettingsClose) {
    elements.llmSettingsClose.addEventListener("click", closeLLMSettings);
  }
  if (elements.llmSaveSettings) {
    elements.llmSaveSettings.addEventListener("click", saveLLMSettings);
  }
  if (elements.llmTestConnection) {
    elements.llmTestConnection.addEventListener("click", testLLMConnection);
  }
  if (elements.llmRefreshModels) {
    elements.llmRefreshModels.addEventListener("click", refreshLLMModels);
  }
  
  // Tab switching in LLM dialog
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabName = e.currentTarget.dataset.tab;
      if (tabName) switchLLMTab(tabName);
    });
  });
  
  // AI Prompt Generator event listeners
  if (elements.aiPromptClose) {
    elements.aiPromptClose.addEventListener('click', closeAIPromptDialog);
  }
  if (elements.aiModeSingle) {
    elements.aiModeSingle.addEventListener('click', () => handleAIPromptModeChange('single'));
  }
  if (elements.aiModeSequence) {
    elements.aiModeSequence.addEventListener('click', () => handleAIPromptModeChange('sequence'));
  }
  if (elements.aiPromptGenerate) {
    elements.aiPromptGenerate.addEventListener('click', generateAIPrompt);
  }
  if (elements.aiPromptToggleReasoning) {
    elements.aiPromptToggleReasoning.addEventListener('click', toggleReasoningDisplay);
  }
  if (elements.aiPromptUse) {
    elements.aiPromptUse.addEventListener('click', useGeneratedPrompts);
  }
  if (elements.aiPromptRegenerate) {
    elements.aiPromptRegenerate.addEventListener('click', generateAIPrompt);
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
  elements.addPrompt.addEventListener("click", handleAddScene);
  
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
      // Audio is al geladen bij project open
      openAudioVideoEditor();
    });
  }
  
  // Initialiseer audio video editor
  initializeAudioVideoEditor();
  
  // Event: Nieuwe audio geladen - verwijder alle oude marker koppelingen
  document.addEventListener('newAudioLoaded', (e) => {
    if (!state.projectData || !state.projectData.prompts) return;
    
    
    // Ontkoppel alle audio-linked scenes en maak ALLE scenes beschikbaar
    state.projectData.prompts.forEach(scene => {
      if (scene.isAudioLinked) {
        scene.isAudioLinked = false;
        delete scene.audioMarkerIndex;
        // BEHOUD audioMarkerTime - scene blijft beschikbaar
        delete scene.timeline;
        delete scene.duration;
      } else if (!scene.audioMarkerTime) {
        // Scene was nooit gekoppeld - maak beschikbaar (zonder media check)
        scene.audioMarkerTime = 0; // Dummy waarde om scene zichtbaar te maken
      }
    });
    
    // Verwijder oude audioTimeline data
    if (state.projectData.audioTimeline) {
      delete state.projectData.audioTimeline;
    }
    
    state.isDirty = true;
    renderProjectEditor();
  });
  
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

  document.addEventListener('markersReindexed', (e) => {
    const { markers } = e.detail;
    handleMarkersReindexed(markers);
  });

  document.addEventListener('deleteMarkerRequest', (e) => {
    const { markerIndex } = e.detail;
    deleteMarkerFromProject(markerIndex);
  });
  
  // Event listener voor UI refresh na marker/scene reorganisatie
  document.addEventListener('renderProjectEditorRequest', () => {
    if (state.projectData) {
      renderProjectEditor();
    }
  });

  document.addEventListener('deleteAudioFromProject', async () => {
    if (!state.projectData) return;
    
    // Verwijder audio timeline data uit project
    delete state.projectData.audioTimeline;
    
    // Ontkoppel alle scenes van audio markers
    if (state.projectData.prompts) {
      state.projectData.prompts.forEach(scene => {
        if (scene.isAudioLinked) {
          scene.isAudioLinked = false;
          scene.audioMarkerIndex = null;
          scene.audioMarkerTime = null;
          delete scene.timeline;
          delete scene.duration;
        }
      });
    }
    
    // Verwijder audio bestand uit project directory
    if (state.projectDirHandle && state.projectData.audioTimeline?.fileName) {
      try {
        await state.projectDirHandle.removeEntry(state.projectData.audioTimeline.fileName);
      } catch (err) {
        console.warn('Audio bestand verwijderen mislukt:', err);
      }
    }
    
    // Mark project dirty en re-render
    state.isDirty = true;
    renderProjectEditor();
    
    // Toon melding
    showSuccess('Audio timeline verwijderd. Project is nu een gewoon project.');
  });

  // Event voor scene data ophalen (voor thumbnails in audio editor)
  document.addEventListener('getSceneData', (e) => {
    if (!state.projectData || e.detail.markerIndex === undefined) return;
    
    const scene = state.projectData.prompts.find(p => 
      p.isAudioLinked && p.audioMarkerIndex === e.detail.markerIndex
    );
    
    e.detail.sceneData = scene || null;
  });

  // Event voor scene thumbnail laden
  document.addEventListener('loadSceneThumbnail', async (e) => {
    const { sceneId, img } = e.detail;
    if (!sceneId || !img) return;
    
    const scene = state.projectData?.prompts.find(p => p.id === sceneId);
    if (!scene || !scene.imagePath) return;
    
    try {
      await loadImagePreview(scene.imagePath, img, state.projectImagesHandle);
    } catch (error) {
      console.warn('Thumbnail laden mislukt:', error);
      img.style.display = 'none';
    }
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
        if (!targetId || !localState.copyingPromptId) return;
        await handleCopySceneToProject(localState.copyingPromptId, targetId);
      } catch (error) {
        showError(t("errors.exportPrompts"), error);
      } finally {
        if (elements.copyDialog) elements.copyDialog.close();
        localState.copyingPromptId = null;
      }
    });
  }
  if (elements.copyDuplicate) {
    elements.copyDuplicate.addEventListener("click", async (event) => {
      event.preventDefault();
      try {
        if (!localState.copyingPromptId) return;
        await handleDuplicateScene(localState.copyingPromptId);
      } catch (error) {
        showError(t("errors.exportPrompts"), error);
      } finally {
        if (elements.copyDialog) elements.copyDialog.close();
        localState.copyingPromptId = null;
      }
    });
  }
  if (elements.copyCancel && elements.copyDialog) {
    elements.copyCancel.addEventListener("click", () => {
      localState.copyingPromptId = null;
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
      handlePresentationLanguageChange(event.target.value);
    });
  }
  if (elements.presentationWorkflow) {
    elements.presentationWorkflow.addEventListener("change", (event) => {
      setPresentationWorkflowMode(event.target.value, localState, elements);
      // Update de slide om nieuwe velden te tonen
      if (localState.presentationMode.videoMode) {
        updateVideoPresentationSlide(state, localState, elements, t, () => nextSlide(state, localState));
      } else {
        updatePresentationSlide(state, localState, elements, t);
      }
    });
  }
  if (elements.presentationMode) {
    elements.presentationMode.addEventListener("change", async (event) => {
      const mode = event.target.value; // "image", "video", "audio-image", "audio-video"
      const wasVideoMode = localState.presentationMode.videoMode;
      const wasAudioMode = localState.presentationMode.audioMode || false;
      
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
      
      localState.presentationMode.videoMode = (mode === "video");
      localState.presentationMode.audioMode = (mode === "audio-image" || mode === "audio-video" || mode === "audio-mixed");
      localState.presentationMode.showVideoInAudio = (mode === "audio-video");
      
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
            const timeline = await initializeCombinedVideoPresentation(state, localState, elements, t);
            localState.presentationMode.videoTimeline = timeline;
            
            if (!timeline || timeline.segments.length === 0) {
              showError("Geen video's gevonden in dit project");
              localState.presentationMode.videoMode = false;
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
            const currentPrompt = state.projectData.prompts[localState.presentationMode.currentSlide];
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
          
          // NIEUWE CHECK: Kijk of er scenes zijn met isAudioLinked (niet of markers array bestaat)
          const linkedScenes = state.projectData.prompts.filter(p => p.isAudioLinked && p.audioMarkerTime !== undefined);
          const hasAudioTimeline = state.projectData.audioTimeline && linkedScenes.length > 0;
          
          if (hasAudioTimeline) {
            await initializeAudioPresentation(
              state,
              localState,
              elements,
              state.projectDirHandle,
              getSceneIndexAtTime,
              getAllScenes,
              handlePresentationSlideUpdate
            );
          } else {
            console.warn("Kan niet naar audio mode: project heeft geen audio timeline of markers");
            // Fallback naar image mode
            event.target.value = "image";
            localState.presentationMode.audioMode = false;
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
      await handlePresentationSlideUpdate();
    });
  }
  if (elements.presentationNext) {
    elements.presentationNext.addEventListener("click", handleNextSlide);
  }
  if (elements.presentationPrev) {
    elements.presentationPrev.addEventListener("click", handlePrevSlide);
  }
  if (elements.videoTimelineSlider) {
    elements.videoTimelineSlider.addEventListener("input", (event) => {
      if (localState.presentationMode.videoMode && localState.presentationMode.videoTimeline) {
        const percentage = parseFloat(event.target.value);
        seekCombinedVideoTimeline(percentage, state, localState, elements, t);
      }
    });
  }
  if (elements.presentationClose) {
    elements.presentationClose.addEventListener("click", handlePresentationClose);
  }
  if (elements.presentationDialog) {
    elements.presentationDialog.addEventListener("close", handlePresentationClose);
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
  
  // Keyboard shortcuts voor presentatie
  document.addEventListener("keydown", (event) => {
    if (!elements.presentationDialog || !elements.presentationDialog.open) return;
    if (event.key === "ArrowRight" || event.key === " ") {
      event.preventDefault();
      handleNextSlide();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      handlePrevSlide();
    } else if (event.key === "Escape") {
      event.preventDefault();
      handlePresentationClose();
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
  
  // Initialiseer auto-save systeem
  const autoSave = initializeAutoSave(
    () => saveProject(), // Save callback
    () => state.isDirty && state.projectData && state.projectHandle // isDirty check
  );
  
  // Setup auto-save toggle button
  setupAutoSaveButton(
    () => saveProject(),
    () => state.isDirty && state.projectData && state.projectHandle
  );
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

// Header minimize/maximize toggle
const headerToggleBtn = document.querySelector("#toggle-header-minimize");
const appHeader = document.querySelector(".app-header");

if (headerToggleBtn && appHeader) {
  // Laad opgeslagen state uit localStorage
  const savedMinimized = localStorage.getItem("headerMinimized") === "true";
  if (savedMinimized) {
    appHeader.classList.add("minimized");
    localState.headerMinimized = true;
    headerToggleBtn.textContent = "⬇️";
    headerToggleBtn.title = "Maximaliseer header";
  }

  headerToggleBtn.addEventListener("click", () => {
    localState.headerMinimized = !localState.headerMinimized;
    
    if (localState.headerMinimized) {
      appHeader.classList.add("minimized");
      headerToggleBtn.textContent = "⬇️";
      headerToggleBtn.title = "Maximaliseer header";
    } else {
      appHeader.classList.remove("minimized");
      headerToggleBtn.textContent = "⬆️";
      headerToggleBtn.title = "Minimaliseer header";
    }
    
    // Bewaar state in localStorage
    localStorage.setItem("headerMinimized", localState.headerMinimized);
  });
}

// Sidebar collapse/expand toggle
const sidebarToggleBtn = document.querySelector("#toggle-sidebar");
const sidebarInlineBtn = document.querySelector("#toggle-sidebar-inline");
const sidebar = document.querySelector(".sidebar");
const layout = document.querySelector(".layout");

if (sidebarToggleBtn && sidebar && layout) {
  // Laad opgeslagen state uit localStorage
  const savedCollapsed = localStorage.getItem("sidebarCollapsed") === "true";
  if (savedCollapsed) {
    sidebar.classList.add("collapsed");
    layout.classList.add("sidebar-collapsed");
    localState.sidebarCollapsed = true;
    sidebarToggleBtn.textContent = "▶️";
    sidebarToggleBtn.title = "Toon projectenlijst";
  }

  const toggleSidebar = () => {
    localState.sidebarCollapsed = !localState.sidebarCollapsed;
    
    if (localState.sidebarCollapsed) {
      sidebar.classList.add("collapsed");
      layout.classList.add("sidebar-collapsed");
      sidebarToggleBtn.textContent = "▶️";
      sidebarToggleBtn.title = "Toon projectenlijst";
    } else {
      sidebar.classList.remove("collapsed");
      layout.classList.remove("sidebar-collapsed");
      sidebarToggleBtn.textContent = "◀️";
      sidebarToggleBtn.title = "Verberg projectenlijst";
    }
    
    // Bewaar state in localStorage
    localStorage.setItem("sidebarCollapsed", localState.sidebarCollapsed);
  };

  sidebarToggleBtn.addEventListener("click", toggleSidebar);
  
  // Inline button in de sidebar zelf (zichtbaar als collapsed)
  if (sidebarInlineBtn) {
    sidebarInlineBtn.addEventListener("click", toggleSidebar);
  }
}

// Project header collapse/expand toggle
const projectHeaderToggleBtn = document.querySelector("#toggle-project-header");
const projectHeaderToggleHeaderBtn = document.querySelector("#toggle-project-header-header");
const projectHeader = document.querySelector(".project-header");
const headerSaveBtn = document.querySelector("#header-save-project");
const projectSaveBtn = document.querySelector("#save-project");

if (projectHeaderToggleBtn && projectHeader) {
  // Laad opgeslagen state uit localStorage
  const savedMinimized = localStorage.getItem("projectHeaderMinimized") === "true";
  if (savedMinimized) {
    projectHeader.classList.add("minimized");
    localState.projectHeaderMinimized = true;
    projectHeaderToggleBtn.textContent = "⬇️";
    projectHeaderToggleBtn.title = "Maximaliseer project info";
    if (headerSaveBtn) headerSaveBtn.classList.add("visible");
    if (projectHeaderToggleHeaderBtn) projectHeaderToggleHeaderBtn.style.display = "inline-flex";
  }

  const toggleProjectHeader = () => {
    localState.projectHeaderMinimized = !localState.projectHeaderMinimized;
    
    if (localState.projectHeaderMinimized) {
      projectHeader.classList.add("minimized");
      projectHeaderToggleBtn.textContent = "⬇️";
      projectHeaderToggleBtn.title = "Maximaliseer project info";
      if (headerSaveBtn) headerSaveBtn.classList.add("visible");
      if (projectHeaderToggleHeaderBtn) {
        projectHeaderToggleHeaderBtn.style.display = "inline-flex";
        projectHeaderToggleHeaderBtn.textContent = "⬇️";
        projectHeaderToggleHeaderBtn.title = "Maximaliseer project info";
      }
    } else {
      projectHeader.classList.remove("minimized");
      projectHeaderToggleBtn.textContent = "⬆️";
      projectHeaderToggleBtn.title = "Minimaliseer project info";
      if (headerSaveBtn) headerSaveBtn.classList.remove("visible");
      if (projectHeaderToggleHeaderBtn) projectHeaderToggleHeaderBtn.style.display = "none";
    }
    
    // Bewaar state in localStorage
    localStorage.setItem("projectHeaderMinimized", localState.projectHeaderMinimized);
  };

  projectHeaderToggleBtn.addEventListener("click", toggleProjectHeader);
  
  // Toggle ook vanuit header
  if (projectHeaderToggleHeaderBtn) {
    projectHeaderToggleHeaderBtn.addEventListener("click", toggleProjectHeader);
  }
  
  // Koppel header save button aan echte save functie
  if (headerSaveBtn && projectSaveBtn) {
    headerSaveBtn.addEventListener("click", () => {
      projectSaveBtn.click();
    });
  }
}

// Master toggle - minimaliseer ALLES tegelijk
const masterToggleBtn = document.querySelector("#toggle-all-minimize");

if (masterToggleBtn) {
  // Laad opgeslagen master state
  const savedAllMinimized = localStorage.getItem("allMinimized") === "true";
  if (savedAllMinimized) {
    localState.allMinimized = true;
    masterToggleBtn.textContent = "⚡";
    masterToggleBtn.title = "Alles maximaliseren";
  }

  masterToggleBtn.addEventListener("click", () => {
    localState.allMinimized = !localState.allMinimized;
    
    const targetState = localState.allMinimized;
    
    // Toggle app header
    if (appHeader) {
      if (targetState) {
        appHeader.classList.add("minimized");
      } else {
        appHeader.classList.remove("minimized");
      }
      localState.headerMinimized = targetState;
      localStorage.setItem("headerMinimized", targetState);
      if (headerToggleBtn) {
        headerToggleBtn.textContent = targetState ? "⬇️" : "⬆️";
        headerToggleBtn.title = targetState ? "Maximaliseer header" : "Minimaliseer header";
      }
    }
    
    // Toggle sidebar
    if (sidebar && layout) {
      if (targetState) {
        sidebar.classList.add("collapsed");
        layout.classList.add("sidebar-collapsed");
      } else {
        sidebar.classList.remove("collapsed");
        layout.classList.remove("sidebar-collapsed");
      }
      localState.sidebarCollapsed = targetState;
      localStorage.setItem("sidebarCollapsed", targetState);
      if (sidebarToggleBtn) {
        sidebarToggleBtn.textContent = targetState ? "▶️" : "◀️";
        sidebarToggleBtn.title = targetState ? "Toon projectenlijst" : "Verberg projectenlijst";
      }
    }
    
    // Toggle project header
    if (projectHeader) {
      if (targetState) {
        projectHeader.classList.add("minimized");
        // Toon save button in header
        if (headerSaveBtn) headerSaveBtn.classList.add("visible");
        if (projectHeaderToggleHeaderBtn) {
          projectHeaderToggleHeaderBtn.style.display = "inline-flex";
          projectHeaderToggleHeaderBtn.textContent = "⬇️";
          projectHeaderToggleHeaderBtn.title = "Maximaliseer project info";
        }
      } else {
        projectHeader.classList.remove("minimized");
        // Verberg save button in header
        if (headerSaveBtn) headerSaveBtn.classList.remove("visible");
        if (projectHeaderToggleHeaderBtn) projectHeaderToggleHeaderBtn.style.display = "none";
      }
      localState.projectHeaderMinimized = targetState;
      localStorage.setItem("projectHeaderMinimized", targetState);
      if (projectHeaderToggleBtn) {
        projectHeaderToggleBtn.textContent = targetState ? "⬇️" : "⬆️";
        projectHeaderToggleBtn.title = targetState ? "Maximaliseer project info" : "Minimaliseer project info";
      }
    }
    
    // Update master button
    masterToggleBtn.textContent = targetState ? "⚡" : "⚡";
    masterToggleBtn.title = targetState ? "Alles maximaliseren" : "Alles minimaliseren";
    masterToggleBtn.style.opacity = targetState ? "1" : "0.6";
    
    // Bewaar master state
    localStorage.setItem("allMinimized", targetState);
  });
}

// =====================================================
// AI Prompt Generator Functies
// =====================================================

/**
 * Render AI Prompt Generator button tussen twee scenes.
 * Simpele button met alleen AI icoon, onder de transitie button.
 * 
 * @param {number} sceneIndex - Index van de scene (button verschijnt na deze scene)
 * @returns {HTMLElement} Button element
 */
function renderAIPromptButton(sceneIndex) {
  const button = document.createElement("button");
  button.className = "ai-prompt-button";
  button.title = `AI Prompt voor Scene ${sceneIndex + 1} → Scene ${sceneIndex + 2}`;
  
  // Check of LLM actief is voor status indicator
  const isActive = isLLMServiceActive(state.projectData?.llmSettings);
  const statusClass = isActive ? 'active' : 'inactive';
  
  button.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      <path d="M2 17l10 5 10-5"/>
      <path d="M2 12l10 5 10-5"/>
    </svg>
    <span class="ai-status-indicator ${statusClass}"></span>
  `;
  
  button.addEventListener("click", () => {
    openAIPromptDialog(sceneIndex);
  });
  
  return button;
}

/**
 * Open AI Prompt Generator dialog voor een specifieke scene.
 * Laad de benodigde scene afbeeldingen en toont de dialog.
 * 
 * @param {number} sceneIndex - Index van de scene
 */
async function openAIPromptDialog(sceneIndex) {
  if (!state.projectData) return;
  
  // Check of LLM service actief is
  if (!isLLMServiceActive(state.projectData.llmSettings)) {
    showError(t("aiPrompt.errorNoLLMService") || "LLM service is niet actief. Configureer eerst de Ollama instellingen.");
    return;
  }
  
  const prompts = state.projectData.prompts;
  if (sceneIndex < 0 || sceneIndex >= prompts.length) return;
  
  // Bewaar context
  localState.aiPromptContext = {
    sceneIndex,
    mode: 'single'
  };
  
  // Reset dialog
  handleAIPromptModeChange('single');
  elements.aiPromptTranslationLang.value = 'nl';
  elements.aiPromptExtraInstructions.value = '';
  elements.aiPromptResult.style.display = 'none';
  elements.aiResultPlaceholder.style.display = 'block';
  elements.aiResultPlaceholder.classList.remove('generating');
  
  // Laad afbeeldingen
  await loadAIPromptImages(sceneIndex);
  
  // Toon dialog
  elements.aiPromptDialog.showModal();
}

/**
 * Sluit AI Prompt Generator dialog.
 */
function closeAIPromptDialog() {
  elements.aiPromptDialog.close();
  localState.aiPromptContext = null;
  
  // Clear image previews
  elements.aiPromptImage1.innerHTML = '';
  elements.aiPromptImage2.innerHTML = '';
}

/**
 * Laad afbeeldingen voor AI prompt generator.
 * Voor single mode: huidige scene afbeelding
 * Voor sequence mode: huidige + volgende scene afbeelding
 * 
 * @param {number} sceneIndex - Index van de scene
 */
async function loadAIPromptImages(sceneIndex) {
  const prompts = state.projectData.prompts;
  if (!prompts || sceneIndex >= prompts.length) return;
  
  // Update scene nummers
  const scene1Number = document.getElementById('ai-prompt-scene-1-number');
  const scene2Number = document.getElementById('ai-prompt-scene-2-number');
  if (scene1Number) scene1Number.textContent = sceneIndex + 1;
  if (scene2Number) scene2Number.textContent = sceneIndex + 2;
  
  // Laad image 1 (huidige scene)
  const prompt1 = prompts[sceneIndex];
  elements.aiPromptImage1.innerHTML = '';
  
  if (prompt1.imagePath) {
    try {
      const file = await state.projectImagesHandle.getFileHandle(prompt1.imagePath);
      const blob = await file.getFile();
      const url = URL.createObjectURL(blob);
      
      const img = document.createElement('img');
      img.src = url;
      img.alt = `Scene ${sceneIndex + 1}`;
      elements.aiPromptImage1.appendChild(img);
    } catch (error) {
      console.error('Error loading image 1:', error);
      elements.aiPromptImage1.innerHTML = `<div class="no-image">📷<br>${t("aiPrompt.noImage") || "Afbeelding niet gevonden"}</div>`;
    }
  } else {
    elements.aiPromptImage1.innerHTML = `<div class="no-image">📷<br>${t("aiPrompt.noImage") || "Afbeelding niet gevonden"}</div>`;
  }
  
  // Laad image 2 (volgende scene) - alleen voor sequence mode
  if (sceneIndex < prompts.length - 1) {
    const prompt2 = prompts[sceneIndex + 1];
    elements.aiPromptImage2.innerHTML = '';
    
    if (prompt2.imagePath) {
      try {
        const file = await state.projectImagesHandle.getFileHandle(prompt2.imagePath);
        const blob = await file.getFile();
        const url = URL.createObjectURL(blob);
        
        const img = document.createElement('img');
        img.src = url;
        img.alt = `Scene ${sceneIndex + 2}`;
        elements.aiPromptImage2.appendChild(img);
      } catch (error) {
        console.error('Error loading image 2:', error);
        elements.aiPromptImage2.innerHTML = `<div class="no-image">${t("aiPrompt.noImage")}</div>`;
      }
    } else {
      elements.aiPromptImage2.innerHTML = `<div class="no-image">${t("aiPrompt.noImage")}</div>`;
    }
  }
}

/**
 * Handle mode wijziging in AI Prompt Generator.
 * Toont/verbergt de tweede afbeelding op basis van single vs sequence mode.
 */
function handleAIPromptModeChange(mode) {
  const image2Container = elements.aiPromptImage2.closest('.image-preview-container');
  
  if (localState.aiPromptContext) {
    localState.aiPromptContext.mode = mode;
  }
  
  // Toggle active class op buttons
  if (mode === 'single') {
    elements.aiModeSingle.classList.add('active');
    elements.aiModeSequence.classList.remove('active');
    image2Container.style.display = 'none';
  } else {
    elements.aiModeSingle.classList.remove('active');
    elements.aiModeSequence.classList.add('active');
    image2Container.style.display = 'block';
  }
}

/**
 * Toggle redenatie & analyse weergave in AI Prompt Generator.
 */
function toggleReasoningDisplay() {
  const isExpanded = elements.aiPromptToggleReasoning.classList.contains('expanded');
  
  if (isExpanded) {
    // Verberg redenatie
    elements.aiPromptReasoning.style.display = 'none';
    elements.aiPromptToggleReasoning.classList.remove('expanded');
    elements.aiPromptToggleReasoning.querySelector('.toggle-icon').textContent = '▶';
    elements.aiPromptToggleReasoning.querySelector('[data-i18n]').textContent = t("aiPrompt.showReasoning");
  } else {
    // Toon redenatie
    elements.aiPromptReasoning.style.display = 'block';
    elements.aiPromptToggleReasoning.classList.add('expanded');
    elements.aiPromptToggleReasoning.querySelector('.toggle-icon').textContent = '▼';
    elements.aiPromptToggleReasoning.querySelector('[data-i18n]').textContent = t("aiPrompt.hideReasoning");
  }
}

/**
 * Genereer AI prompts op basis van geselecteerde mode.
 * Minimale wrapper - alle LLM logica zit in llm-service.js
 */
async function generateAIPrompt() {
  if (!localState.aiPromptContext || !state.projectData) return;
  
  const { sceneIndex, mode } = localState.aiPromptContext;
  const llmSettings = state.projectData.llmSettings;
  
  if (!isLLMServiceActive(llmSettings)) {
    showError(t("aiPrompt.errorNoLLMService"));
    return;
  }
  
  // Valideer dat extra instructies zijn ingevuld
  const extraInstructions = elements.aiPromptExtraInstructions.value.trim();
  if (!extraInstructions) {
    showError(t("aiPrompt.errorNoInstructions") || "Vul eerst instructies in voor de AI (bijvoorbeeld: 'de maan moet bewegen')");
    return;
  }
  
  // UI feedback: disable button tijdens processing
  elements.aiPromptGenerate.disabled = true;
  elements.aiPromptGenerate.textContent = t("aiPrompt.generating") || "Genereren...";
  elements.aiPromptStatus.style.display = 'flex';
  elements.aiPromptResult.style.display = 'none';
  // Toon placeholder met draaiend icoon (geen tekst)
  elements.aiResultPlaceholder.style.display = 'block';
  elements.aiResultPlaceholder.classList.add('generating');
  
  try {
    // Roep llm-service aan met callback voor status updates
    const result = await generateAIPromptWithStatus({
      mode,
      sceneIndex,
      prompts: state.projectData.prompts,
      llmSettings,
      imagesHandle: state.projectImagesHandle,
      extraInstructions,
      translationLang: elements.aiPromptTranslationLang.value,
      onStatus: (statusText) => {
        elements.aiPromptStatusText.textContent = statusText;
      }
    });
    
    // Toon "Klaar!" status
    elements.aiPromptStatusText.textContent = `✅ Klaar!`;
    await new Promise(resolve => setTimeout(resolve, 500));
    elements.aiPromptStatus.style.display = 'none';
    
    // Update UI met resultaat
    elements.aiPromptResultEn.textContent = result.prompt;
    
    // Sla reasoning op in localState voor toggle functie
    localState.aiPromptContext.reasoning = result.reasoning;
    if (result.imageAnalysis) {
      localState.aiPromptContext.imageAnalysis = result.imageAnalysis;
    } else if (result.imageAnalysis1 && result.imageAnalysis2) {
      localState.aiPromptContext.imageAnalysis1 = result.imageAnalysis1;
      localState.aiPromptContext.imageAnalysis2 = result.imageAnalysis2;
    }
    
    // Update reasoning textarea (maar toon het nog niet)
    const reasoningText = mode === 'single'
      ? `=== IMAGE ANALYSE ===\n${result.imageAnalysis}\n\n=== VOLLEDIGE LLM RESPONSE ===\n${result.reasoning}`
      : `=== IMAGE ANALYSE 1 ===\n${result.imageAnalysis1}\n\n=== IMAGE ANALYSE 2 ===\n${result.imageAnalysis2}\n\n=== VOLLEDIGE LLM RESPONSE ===\n${result.reasoning}`;
    
    elements.aiPromptReasoningText.textContent = reasoningText;
    
    // Reset reasoning toggle naar collapsed state
    elements.aiPromptReasoning.style.display = 'none';
    elements.aiPromptToggleReasoning.classList.remove('expanded');
    elements.aiPromptToggleReasoning.querySelector('.toggle-icon').textContent = '▶';
    elements.aiPromptToggleReasoning.querySelector('[data-i18n]').textContent = t("aiPrompt.showReasoning");
    
    // Toon vertaling indien beschikbaar
    if (result.translation) {
      elements.aiPromptResultTranslation.parentElement.style.display = 'block';
      elements.aiPromptResultTranslation.textContent = result.translation;
    } else {
      elements.aiPromptResultTranslation.parentElement.style.display = 'none';
    }
    
    elements.aiPromptResult.style.display = 'block';
    elements.aiResultPlaceholder.style.display = 'none';
    elements.aiResultPlaceholder.classList.remove('generating');
    
  } catch (error) {
    console.error('AI prompt generation error:', error);
    
    // Verwijder generating state bij error
    elements.aiResultPlaceholder.classList.remove('generating');
    
    // Error handling: toon gebruiksvriendelijke foutmelding
    if (error === 'NO_IMAGE') {
      showError(t("aiPrompt.errorNoImage") || "Geen afbeelding beschikbaar voor deze scene.");
    } else if (error === 'NO_IMAGES') {
      showError(t("aiPrompt.errorNoImages") || "Beide scenes moeten een afbeelding hebben.");
    } else {
      showError(t("aiPrompt.errorGeneration") || "Fout bij genereren van prompts", error);
    }
    
    elements.aiPromptStatus.style.display = 'none';
    // Toon placeholder terug bij error (zonder generating state)
    elements.aiResultPlaceholder.style.display = 'block';
  } finally {
    // UI cleanup: reset button state
    elements.aiPromptGenerate.disabled = false;
    elements.aiPromptGenerate.textContent = t("aiPrompt.generate");
  }
}

/**
 * Pas gegenereerde prompts toe op de scene(s).
 * Voor single mode: update huidige scene
 * Voor sequence mode: update huidige en volgende scene
 */
function useGeneratedPrompts() {
  if (!localState.aiPromptContext || !state.projectData) return;
  
  const { sceneIndex, mode } = localState.aiPromptContext;
  const prompts = state.projectData.prompts;
  
  // Haal BEIDE teksten op (Engels en vertaling)
  const englishPrompt = elements.aiPromptResultEn.textContent;
  const translationText = elements.aiPromptResultTranslation.textContent;
  const translationLang = elements.aiPromptTranslationLang.value;
  
  if (!englishPrompt) return;
  
  if (mode === 'single') {
    // Update huidige scene met BEIDE: Engels in text, vertaling in translation
    prompts[sceneIndex].text = englishPrompt;
    
    if (translationLang && translationText) {
      prompts[sceneIndex].translation = translationText;
    }
  } else {
    // Sequence mode: probeer te splitsen op markers of nummering
    
    // Split Engels prompt
    const englishParts = englishPrompt.split(/Scene \d+:|Prompt \d+:|\d+\./i).filter(p => p.trim());
    
    if (englishParts.length >= 2) {
      prompts[sceneIndex].text = englishParts[0].trim();
      prompts[sceneIndex + 1].text = englishParts[1].trim();
    } else {
      prompts[sceneIndex].text = englishPrompt;
    }
    
    // Split vertaling (indien beschikbaar)
    if (translationLang && translationText) {
      const translationParts = translationText.split(/Scene \d+:|Prompt \d+:|\d+\./i).filter(p => p.trim());
      
      if (translationParts.length >= 2) {
        prompts[sceneIndex].translation = translationParts[0].trim();
        prompts[sceneIndex + 1].translation = translationParts[1].trim();
      } else {
        prompts[sceneIndex].translation = translationText;
      }
    }
  }
  
  // Mark project as dirty en re-render
  state.isDirty = true;
  renderProjectEditor();
  
  // Sluit dialog
  closeAIPromptDialog();
  
  showSuccess(t("aiPrompt.successApplied") || "Prompts succesvol toegepast!");
}

// Laad auto-save preference uit localStorage (gebeurt nu in auto-save module)

// Start applicatie, verdere logica verloopt via eventlisteners hierboven.
init();
