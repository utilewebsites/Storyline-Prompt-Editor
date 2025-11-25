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
import { showError, showSuccess } from "./modules/dialogs.js";
import { getState, resetState, setRootHandle, setProjectenHandle, setIndexData, loadProject, setProjectDirty, isProjectDirty, updateScene, getScene, getImageCache, getVideoCache, updateProjectInIndex, removeProjectFromIndex, addProjectToIndex } from "./modules/state.js";
import { formatTime, debounce, toggleVisibility } from "./modules/dom-helpers.js";
import { FILE_NAMES, DIR_NAMES, MIME_TYPES, SCENE_DEFAULTS, CSS_CLASSES, LIMITS, DEFAULT_WORKFLOW_MODE } from "./modules/constants.js";

// Bestaande imports
import translations from "./translations.js";
import { uuid, slugify, formatDateTime, readJsonFile, writeJsonFile, writeTextFile } from "./modules/utils.js";
import { addPrompt, deletePrompt, movePrompt, assignImageToPrompt, assignVideoToPrompt, removeImageFromPrompt, removeVideoFromPrompt } from "./modules/scenes.js";
import { initializeHelpSystem, setHelpLanguage, toggleHelpMode, handleWorkflowModeChange, applyWorkflowModeToDialog, getWorkflowMode, updateHelpTexts } from "./modules/help.js";
import { deleteMarker as deleteEditorMarker } from "./modules/audio-video-editor.js";
import { initializeAttachments, clearAttachmentCache, clearAllAttachmentCaches } from "./modules/attachments.js";
import { initializeSceneNotes } from "./modules/scene-notes.js";
import { renderTransitionButton, showTransitionDialog, cleanupTransitions, reindexTransitions } from "./modules/transitions.js";
import { initializeAudioVideoEditor, openEditor as openAudioVideoEditor, resetAudioVideoEditor, getAudioTimelineData, restoreAudioTimelineFromData, clearAudioFileReference, loadAudioFromProjectDir } from "./modules/audio-video-editor.js";
// import { initLogger, log, logSection } from "./modules/logger.js"; // DEBUG: Uncomment om logging aan te zetten

// Nieuwe refactoring modules (nov 2024)
import { loadImagePreview, loadVideoPreview, uploadImage, uploadVideo, removeImage, removeVideo, renderStarWidget, validateMediaFile, cleanupMediaMemory } from "./modules/media-handlers.js";
import { handleCardDragStart, handleContainerDragOver, handleContainerDrop, handleCardDragEnd, movePromptToIndex as movePromptToIndexDnD, moveScene as moveSceneDnD } from "./modules/drag-drop.js";
import { renderProjectList as renderProjectListUI } from "./modules/project-manager.js";
import { copySceneToProject, duplicateSceneInProject } from "./modules/scene-copy.js";
import { createProjectListItem, updateProjectListItem, renderProjectMeta, renderSceneIndex, renderPromptsInBatches } from "./modules/ui-rendering.js";
import { addNewScene, duplicateScene, deleteScene, moveScene, updateSceneText, updateSceneMedia, updateSceneTransition, findSceneById, findSceneIndexById, validateScene } from "./modules/scene-actions.js";
import { createNewProject, openProjectById, saveProjectData, deleteProject as deleteProjectOp, duplicateProject as duplicateProjectOp } from "./modules/project-operations.js";
import { handleImageUpload as handleImageUploadOp, handleImageRemove as handleImageRemoveOp, handleVideoUpload as handleVideoUploadOp, handleVideoRemove as handleVideoRemoveOp } from "./modules/upload-handlers.js";
import { createLLMSettingsController } from "./modules/llm-settings.js";
import { initializeAutoSave, setupAutoSaveButton } from "./modules/auto-save.js";
import { createAIPromptController } from "./modules/ai-prompt.js";
import { createRootManager } from "./modules/root-manager.js";
import { createProjectListController } from "./modules/project-list-controller.js";
import { createPromptDialogController } from "./modules/prompt-dialog.js";
import { createPresentationController } from "./modules/presentation-controller.js";
import { createExportDialogsController } from "./modules/export-dialogs.js";
import { createLayoutWorkflowController } from "./modules/layout-workflow.js";

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
 * Controllers & Features:
 * - modules/layout-workflow.js: UI toggles voor header/sidebar/project info + workflow/help modes
 * - modules/presentation-controller.js: volledige presentatie dialoogbesturing
 * - modules/export-dialogs.js: prompt/notes export keuzes + preview
 * - modules/llm-settings.js en modules/ai-prompt.js: LLM instellingen & AI prompt generator
 * - modules/prompt-dialog.js: scene dialoog navigatie
 * - modules/transitions.js: scene transitions management
 * - modules/audio-video-editor.js: audio timeline met waveform (vervangt audio-timeline.js)
 * - modules/drag-drop.js: drag & drop card reordering
 * - modules/export-handlers.js: export prompts, images, notes
 * 
 * Support:
 * - modules/help.js: help system en workflow hulpteksten
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
  dialogImageWrapper: document.querySelector(".dialog-image-preview"), // Selects the first one (current scene)
  dialogVideo: document.querySelector("#dialog-video"),
  dialogVideoPlaceholder: document.querySelector("#dialog-video-placeholder"),
  dialogVideoWrapper: document.querySelector(".dialog-video-preview"), // Selects the first one (current scene)
  
  // Next Scene Preview Elements
  dialogShowNextScene: document.querySelector("#dialog-show-next-scene"),
  dialogShowVideo: document.querySelector("#dialog-show-video"),
  dialogMediaContainer: document.querySelector("#dialog-media-container"),
  dialogNextSceneMedia: document.querySelector("#dialog-next-scene-media"),
  dialogNextImage: document.querySelector("#dialog-next-image"),
  dialogNextImagePlaceholder: document.querySelector("#dialog-next-image-placeholder"),
  dialogNextImageWrapper: document.querySelector("#dialog-next-image-wrapper"),
  dialogNextVideo: document.querySelector("#dialog-next-video"),
  dialogNextVideoPlaceholder: document.querySelector("#dialog-next-video-placeholder"),
  dialogNextVideoWrapper: document.querySelector("#dialog-next-video-wrapper"),

  // Dialog Workflow Toggle
  dialogWorkflowMode: document.querySelector("#dialog-workflow-mode"),

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
  aiPromptDialog: document.querySelector("#ai-prompt-generator-dialog"),
  aiPromptClose: document.querySelector("#ai-prompt-close"),
  aiModeSingle: document.querySelector("#ai-mode-single"),
  aiModeSequence: document.querySelector("#ai-mode-sequence"),
  aiModeCamera: document.querySelector("#ai-mode-camera"),
  aiModeOvi: document.querySelector("#ai-mode-ovi"),
  aiModeHelpText: document.querySelector("#ai-mode-help-text"),
  aiModeHelpToggle: document.querySelector("#ai-mode-help-toggle"),
  aiModeHelpDetails: document.querySelector("#ai-mode-help-details"),
  aiPromptTranslationLang: document.querySelector("#ai-prompt-translation-lang"),
  aiPromptImage1: document.querySelector("#ai-prompt-image-1"),
  aiPromptFrame1Label: document.querySelector("#ai-prompt-frame-1-label"),
  aiPromptImage2: document.querySelector("#ai-prompt-image-2"),
  aiPromptExtraInstructions: document.querySelector("#ai-prompt-extra-instructions"),
  aiQuickInsertContainer: document.querySelector("#ai-quick-inserts"),
  aiQuickCameraGroup: document.querySelector("#ai-quick-camera"),
  aiQuickOviGroup: document.querySelector("#ai-quick-ovi"),
  aiPromptDuration: document.querySelector("#ai-prompt-duration"),
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
  aiPromptContext: null, // { sceneIndex, mode: 'wan-single' | 'wan-sequence' | 'wan-camera' | 'ovi-10s' }
  aiPromptDetailsExpanded: false,
  presentationMode: {
    currentSlide: 0,
    languageMode: "both",
    workflowMode: "both",
    videoMode: false,
    videoTimeline: null,
    audioMode: false,
    audioMarkers: null,
    audioDuration: null,
    audioBuffer: null,
    showVideoInAudio: false,
  },
};

// Module controller voor alle LLM instellingen
const llmController = createLLMSettingsController({
  state,
  elements,
  flagProjectDirty,
});

// Module controller voor AI Prompt Generator dialoog
const aiPromptController = createAIPromptController({
  state,
  elements,
  localState,
  renderProjectEditor,
});

// Root controller houdt filesystem keuze en lijstverversingen bij
const {
  handleChooseRoot,
  tryRestoreLastRoot,
  refreshProjectsList,
  updateRootUi,
} = createRootManager({
  state,
  elements,
  renderProjectList,
  openProject,
  showError,
  t,
});

const projectListController = createProjectListController({
  state,
  elements,
  renderProjectList,
  openProject,
  refreshProjectsList,
  flagProjectDirty,
  showError,
  showSuccess,
  applyTranslations,
  updateRootUi,
  t,
});

const promptDialogController = createPromptDialogController({
  state,
  localState,
  elements,
  t,
  showError,
  applyTranslations,
  flagProjectDirty,
  calculatePromptDuration,
  renderStarWidget,
  applyWorkflowModeToDialog,
  updateHelpTexts,
  initializeSceneNotes,
});

const presentationController = createPresentationController({
  state,
  localState,
  elements,
  t,
  showError,
  saveProject,
});

const exportDialogsController = createExportDialogsController({
  state,
  localState,
  elements,
  t,
  showError,
  applyTranslations,
  getCurrentProjectDir,
});

const layoutWorkflowController = createLayoutWorkflowController({
  elements,
  localState,
  onWorkflowModeChange: handleWorkflowModeChange,
  onToggleHelpMode: toggleHelpMode,
});

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
    exportDialogsController.updatePreviewInfo();
    
    if (reRender) {
      renderProjectList();
      renderProjectEditor();
    } else {
      refreshProjectMetaDisplay();
    }

    if (aiPromptController?.refreshExtraInstructionsPlaceholder) {
      aiPromptController.refreshExtraInstructionsPlaceholder();
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
  llmController.updateLLMStatusIndicator();

  // elements.promptsContainer.innerHTML = ""; // Wordt nu gedaan door renderPromptsInBatches
  
  const createCardWithExtras = (prompt, index) => {
    const fragment = document.createDocumentFragment();
    const card = createPromptCard(prompt, index);
    fragment.appendChild(card);

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
      const aiPromptBtn = aiPromptController.renderAIPromptButton(index);
      buttonContainer.appendChild(aiPromptBtn);
      
      fragment.appendChild(buttonContainer);
    }
    return fragment;
  };

  renderPromptsInBatches(prompts, elements.promptsContainer, createCardWithExtras);
  
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
    // AANGEPAST: Nu ook scene nummer tonen naast de tijd
    indexElement.innerHTML = `🎵 ${timeStr} <span style="margin-left: 8px; color: var(--text-muted); font-size: 0.9em;">Scene ${index + 1}</span>`;
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
    loadImagePreview(prompt.imagePath, previewImg, state.projectImagesHandle, prompt.id).catch((error) => {
      console.warn("Afbeelding voorvertoning mislukt", error);
      uploader.dataset.hasImage = "false";
      placeholder.textContent = t("prompt.placeholderImage");
    });
  } else {
    placeholder.textContent = t("prompt.placeholderImage");
  }

  const dialogButton = card.querySelector(".open-prompt");
  dialogButton.addEventListener("click", () =>
    promptDialogController.openPromptDialoog(prompt.id).catch((error) => showError(t("errors.openPrompt"), error))
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
      promptDialogController.openPromptDialoog(prompt.id).catch((error) => showError(t("errors.openPrompt"), error))
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
      videoPlaceholder.textContent = t("prompt.placeholderVideo");
    });
  } else {
    videoPlaceholder.textContent = t("prompt.placeholderVideo");
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

  // Initialize Scene Notes
  try {
    initializeSceneNotes(card, prompt, () => {
      flagProjectDirty({ refreshEditor: false, refreshList: false });
    });
  } catch (error) {
    console.error("Fout bij initialiseren notities:", error);
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
  
  // Populate select with projects except the current one
  elements.copyTargetSelect.innerHTML = "";
  
  // Gebruik state.projectData.id als huidige ID, of fallback naar state.selectedProjectId
  const currentId = state.projectData ? state.projectData.id : state.selectedProjectId;
  
  const options = (state.indexData.projects || []).filter((p) => p.id !== currentId);
  
  for (const p of options) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.projectName;
    elements.copyTargetSelect.appendChild(opt);
  }

  // Beheer status van controls afhankelijk van of er andere projecten zijn
  const hasOtherProjects = options.length > 0;
  elements.copyTargetSelect.disabled = !hasOtherProjects;
  if (elements.copyConfirm) {
    elements.copyConfirm.disabled = !hasOtherProjects;
    // Visuele feedback voor disabled state
    elements.copyConfirm.style.opacity = hasOtherProjects ? "1" : "0.5";
    elements.copyConfirm.style.cursor = hasOtherProjects ? "pointer" : "not-allowed";
  }

  // Als er geen andere projecten zijn, toon een informatieve optie
  if (!hasOtherProjects) {
    const opt = document.createElement("option");
    opt.textContent = "(Geen andere projecten beschikbaar)";
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
 * Opent een project en laadt alle data.
 */
async function openProject(projectId) {
  cleanupMediaMemory();
  clearAllAttachmentCaches();
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

  // Start elke projectload in de verborgen workflowmodus zodat velden pas zichtbaar worden na expliciete keuze
  handleWorkflowModeChange(DEFAULT_WORKFLOW_MODE, { persist: false });

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
  await llmController.initializeLLMForProject();
  
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
    if ((markerTime === undefined || markerTime === null) && scene.timeline && scene.isAudioLinked) {
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
    
    if (markerTime !== undefined && markerTime >= 0) {
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
    if (scene.isAudioLinked && scene.audioMarkerTime !== undefined && scene.audioMarkerTime >= 0) {
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
  
  // Markeer project als gewijzigd zodat auto-save het oppikt
  flagProjectDirty({ refreshEditor: false, refreshList: false });
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
  flagProjectDirty({ refreshEditor: true, refreshList: false });
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
  promptDialogController.openPromptDialoog(scene.id).catch((error) => {
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
    
    // Direct sorteren en renderen om UI consistent te houden
    sortScenesByAudioMarkers();
    renderProjectEditor();
    
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
  
  // We gebruiken nu de centrale sorteerfunctie die alles op tijd sorteert.
  // Dit is robuuster dan handmatig splicen en werkt altijd correct omdat
  // de tijden al geupdate zijn via updateMarkerPositionFromEditor.
  sortScenesByAudioMarkers();
  
  // Render de editor opnieuw
  renderProjectEditor();
  
  // Regenereer markers uit scenes om zeker te zijn van sync
  const regenerateEvent = new CustomEvent('regenerateMarkersFromScenes', {
    detail: { projectData: state.projectData }
  });
  document.dispatchEvent(regenerateEvent);
  
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
 * Sorteer scenes in prompts array op basis van audio marker tijd
 * NIEUWE STRATEGIE: Sorteer op audioMarkerTime (niet op index!)
 * en ken dan audioMarkerIndex toe op basis van positie in gesorteerde array
 */
function sortScenesByAudioMarkers() {
  if (!state.projectData || !state.projectData.prompts) {
    return;
  }
  
  const prompts = state.projectData.prompts;
  
  // Splits scenes in gekoppeld en ongekoppeld
  const linkedScenes = [];
  const unlinkedScenes = [];
  
  prompts.forEach((prompt) => {
    if (prompt.isAudioLinked && prompt.audioMarkerTime !== undefined && prompt.audioMarkerTime !== null) {
      linkedScenes.push(prompt);
    } else {
      unlinkedScenes.push(prompt);
    }
  });
  
  // Sorteer gekoppelde scenes op basis van audioMarkerTime (de marker tijd zelf!)
  linkedScenes.sort((a, b) => {
    const timeA = a.audioMarkerTime ?? Infinity;
    const timeB = b.audioMarkerTime ?? Infinity;
    return timeA - timeB;
  });
  
  // Nu pas audioMarkerIndex toekennen op basis van positie in gesorteerde array
  linkedScenes.forEach((scene, index) => {
    scene.audioMarkerIndex = index;
  });
  
  // Combineer: eerst gekoppelde scenes (gesorteerd op tijd), dan ongekoppelde
  state.projectData.prompts = [...linkedScenes, ...unlinkedScenes];
  
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
 * @param {boolean} isAutoSave - Indien true, wordt de UI niet volledig herladen
 */
async function saveProject(isAutoSave = false) {
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
    
    if (!isAutoSave) {
      renderProjectList();
      renderProjectEditor();
    } else {
      // Bij auto-save alleen de lijst updaten (tijdstip) en niet de hele editor herladen
      refreshActiveProjectListItem();
    }
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
  layoutWorkflowController.initialize();

  if (elements.languageSwitch) {
    elements.languageSwitch.addEventListener("change", (event) => {
      setLanguage(event.target.value);
    });
  }

  // LLM Settings event listeners
  if (elements.llmSettingsBtn) {
    elements.llmSettingsBtn.addEventListener("click", () => llmController.openLLMSettings());
  }
  if (elements.llmSettingsClose) {
    elements.llmSettingsClose.addEventListener("click", () => llmController.closeLLMSettings());
  }
  if (elements.llmSaveSettings) {
    elements.llmSaveSettings.addEventListener("click", () => llmController.saveLLMSettings());
  }
  if (elements.llmTestConnection) {
    elements.llmTestConnection.addEventListener("click", () => llmController.testLLMConnection());
  }
  if (elements.llmRefreshModels) {
    elements.llmRefreshModels.addEventListener("click", () => llmController.refreshLLMModels());
  }
  
  // Tab switching in LLM dialog
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabName = e.currentTarget.dataset.tab;
      if (tabName) llmController.switchLLMTab(tabName);
    });
  });
  
  // AI Prompt Generator event listeners
  if (elements.aiPromptClose) {
    elements.aiPromptClose.addEventListener('click', () => aiPromptController.closeAIPromptDialog());
  }
  const modeButtons = [
    { element: elements.aiModeSingle, mode: 'wan-single' },
    { element: elements.aiModeSequence, mode: 'wan-sequence' },
    { element: elements.aiModeCamera, mode: 'wan-camera' },
    { element: elements.aiModeOvi, mode: 'ovi-10s' }
  ];
  modeButtons.forEach(({ element, mode }) => {
    if (element) {
      element.addEventListener('click', () => aiPromptController.handleAIPromptModeChange(mode));
    }
  });
  if (elements.aiModeHelpToggle) {
    elements.aiModeHelpToggle.addEventListener('click', () => aiPromptController.toggleModeDetails());
  }
  if (elements.aiPromptGenerate) {
    elements.aiPromptGenerate.addEventListener('click', () => aiPromptController.generateAIPrompt());
  }
  if (elements.aiPromptToggleReasoning) {
    elements.aiPromptToggleReasoning.addEventListener('click', () => aiPromptController.toggleReasoningDisplay());
  }
  if (elements.aiPromptUse) {
    elements.aiPromptUse.addEventListener('click', () => aiPromptController.useGeneratedPrompts());
  }
  if (elements.aiPromptRegenerate) {
    elements.aiPromptRegenerate.addEventListener('click', () => aiPromptController.generateAIPrompt());
  }
  document.querySelectorAll('[data-quick-template]').forEach((button) => {
    button.addEventListener('click', () => {
      const templateKey = button.dataset.quickTemplate;
      aiPromptController.insertQuickTemplate(templateKey);
    });
  });

  elements.chooseRoot.addEventListener("click", handleChooseRoot);
  elements.projectForm.addEventListener("submit", (event) =>
    projectListController.handleProjectFormSubmit(event)
  );
  elements.sortProjects.addEventListener("change", (event) =>
    projectListController.handleSortChange(event)
  );
  elements.refreshProjects.addEventListener("click", () =>
    projectListController.handleRefreshClick()
  );
  if (elements.duplicateProject) {
    elements.duplicateProject.addEventListener("click", () =>
      projectListController.openCopyProjectDialog()
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
  elements.exportPrompts.addEventListener("click", (event) => {
    event.preventDefault();
    exportDialogsController.startPromptExport("prompts");
  });
  elements.exportImages.addEventListener("click", (event) => {
    event.preventDefault();
    exportDialogsController.handleExportImages();
  });
  elements.editGenerator.addEventListener("input", () => projectListController.handleMetaChange());
  elements.editNotes.addEventListener("input", () => projectListController.handleMetaChange());
  elements.promptsContainer.addEventListener("dragover", handlePromptContainerDragOver);
  elements.promptsContainer.addEventListener("drop", handlePromptContainerDrop);
  if (elements.promptDialog) {
    elements.promptDialog.addEventListener("close", () => promptDialogController.verwerkPromptDialoogSluiting());
    
    // Keyboard shortcuts voor scene navigatie in dialog
    elements.promptDialog.addEventListener("keydown", (event) => {
      // Alleen als we NIET in een textarea zijn
      if (event.target.tagName === "TEXTAREA") return;
      
      promptDialogController.verwerkPromptDialoogKeydown(event);
    });
  }
  if (elements.dialogPrevScene) {
    elements.dialogPrevScene.addEventListener("click", () => promptDialogController.navigeerPromptDialoogScene(-1));
  }
  if (elements.dialogNextScene) {
    elements.dialogNextScene.addEventListener("click", () => promptDialogController.navigeerPromptDialoogScene(1));
  }
  if (elements.dialogOpenImage) {
    elements.dialogOpenImage.addEventListener("click", () => {
      promptDialogController.openDialoogAfbeelding().catch((error) => showError(t("errors.loadImage"), error));
    });
    elements.dialogOpenImage.disabled = true;
  }
  if (elements.dialogShowNextScene) {
    elements.dialogShowNextScene.addEventListener("change", () => {
      promptDialogController.updateTransitionView().catch(error => console.warn("Transition view update failed", error));
    });
  }
  if (elements.exportPromptsDropdown && elements.exportChoiceDialog) {
    elements.exportPromptsDropdown.addEventListener("click", (event) => {
      event.preventDefault();
      exportDialogsController.openChoiceDialog();
    });
  }
  if (elements.exportChoicePrompts) {
    elements.exportChoicePrompts.addEventListener("click", (event) => {
      event.preventDefault();
      exportDialogsController.startPromptExport("prompts");
      elements.exportChoiceDialog?.close();
    });
  }
  if (elements.exportChoiceNotes) {
    elements.exportChoiceNotes.addEventListener("click", (event) => {
      event.preventDefault();
      exportDialogsController.startPromptExport("notes");
      elements.exportChoiceDialog?.close();
    });
  }
  if (elements.exportPreviewCopy) {
    elements.exportPreviewCopy.addEventListener("click", () => {
      exportDialogsController.handlePreviewCopy();
    });
  }
  if (elements.exportPreviewDialog) {
    elements.exportPreviewDialog.addEventListener("close", () => {
      exportDialogsController.handlePreviewClose();
    });
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
  if (elements.imagesExportedCopy) {
    elements.imagesExportedCopy.addEventListener("click", () => {
      exportDialogsController.handleExportedCopy();
    });
  }
  if (elements.imagesExportedClose && elements.imagesExportedDialog) {
    elements.imagesExportedClose.addEventListener("click", () => {
      exportDialogsController.handleExportedClose();
    });
  }

  // Copy project dialog handlers (duplicate project)
  if (elements.copyProjectConfirm) {
    elements.copyProjectConfirm.addEventListener("click", (event) => {
      projectListController.handleCopyProjectConfirm(event);
    });
  }
  if (elements.copyProjectCancel && elements.copyProjectDialog) {
    elements.copyProjectCancel.addEventListener("click", () => {
      projectListController.handleCopyProjectCancel();
    });
  }
  if (elements.startPresentation) {
    elements.startPresentation.addEventListener("click", () => {
      presentationController.startPresentation();
    });
  }
  if (elements.presentationLanguage) {
    elements.presentationLanguage.addEventListener("change", (event) => {
      presentationController.handleLanguageChange(event.target.value);
    });
  }
  if (elements.presentationWorkflow) {
    elements.presentationWorkflow.addEventListener("change", (event) => {
      presentationController.handleWorkflowChange(event.target.value);
    });
  }
  if (elements.presentationMode) {
    elements.presentationMode.addEventListener("change", (event) => {
      presentationController.handleModeChange(event.target.value);
    });
  }
  if (elements.presentationNext) {
    elements.presentationNext.addEventListener("click", () => {
      presentationController.handleNextSlide();
    });
  }
  if (elements.presentationPrev) {
    elements.presentationPrev.addEventListener("click", () => {
      presentationController.handlePrevSlide();
    });
  }
  if (elements.videoTimelineSlider) {
    elements.videoTimelineSlider.addEventListener("input", (event) => {
      presentationController.handleVideoTimelineInput(event.target.value);
    });
  }
  if (elements.presentationClose) {
    elements.presentationClose.addEventListener("click", () => {
      presentationController.handleClose();
    });
  }
  if (elements.presentationDialog) {
    elements.presentationDialog.addEventListener("close", () => {
      presentationController.handleClose();
    });
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
    presentationController.handlePresentationKeydown(event);
  });
  if (elements.deleteProject) {
    elements.deleteProject.addEventListener("click", () => {
      projectListController.openDeleteProjectDialog();
    });
  }
  if (elements.deleteConfirm) {
    elements.deleteConfirm.addEventListener("click", (event) => {
      projectListController.handleDeleteProjectConfirm(event);
    });
  }
  if (elements.deleteCancel && elements.deleteProjectDialog) {
    elements.deleteCancel.addEventListener("click", () => {
      projectListController.handleDeleteProjectCancel();
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
    () => saveProject(true), // Save callback met isAutoSave=true
    () => state.isDirty && state.projectData && state.projectHandle // isDirty check
  );
  
  // Setup auto-save toggle button
  setupAutoSaveButton(
    () => saveProject(true), // Ook hier true voor consistentie
    () => state.isDirty && state.projectData && state.projectHandle
  );
}

// Laad auto-save preference uit localStorage (gebeurt nu in auto-save module)

// Start applicatie, verdere logica verloopt via eventlisteners hierboven.
init();
