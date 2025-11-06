/* eslint-disable no-await-in-loop */

import translations from "./translations.js";
import { uuid, slugify, formatDateTime, readJsonFile, writeJsonFile, writeTextFile } from "./modules/utils.js";
import { addPrompt, deletePrompt, movePrompt, assignImageToPrompt, assignVideoToPrompt, removeImageFromPrompt, removeVideoFromPrompt } from "./modules/scenes.js";
import { updatePresentationSlide, updateVideoPresentationSlide, nextSlide, prevSlide, setPresentationLanguage, closePresentationMode, initializeCombinedVideoPresentation, updateCombinedVideoPresentation, seekCombinedVideoTimeline } from "./modules/presentation.js";

/**
 * Storyline Prompt Editor
 * In dit script regelen we het complete beheer van storylineprojecten:
 * - Structuur opzetten in de gekozen map
 * - Projecten laden, aanmaken, updaten en exporteren
 * - Promptvelden beheren inclusief afbeeldingen en video's
 * - Presentatiemodus met video-afspeeling
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
  presentationMode: document.querySelector("#presentation-mode"),
  presentationProjectName: document.querySelector("#presentation-project-name"),
  presentationSlideCounter: document.querySelector("#presentation-slide-counter"),
  presentationImage: document.querySelector("#presentation-image"),
  presentationVideo: document.querySelector("#presentation-video"),
  presentationNoImage: document.querySelector("#presentation-no-image"),
  presentationNoVideo: document.querySelector("#presentation-no-video"),
  videoTimelineSlider: document.querySelector("#video-timeline-slider"),
  videoTimelineMarkers: document.querySelector("#video-timeline-markers"),
  presentationTextEn: document.querySelector("#presentation-text-en"),
  presentationTextNl: document.querySelector("#presentation-text-nl"),
  presentationPromptEn: document.querySelector("#presentation-prompt-en"),
  presentationPromptNl: document.querySelector("#presentation-prompt-nl"),
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
  projectImagesHandle: null,
  projectVideosHandle: null, // ⭐ NIEUW: handle naar videos/ folder in project
  projectData: null,
  isDirty: false,
  sortOrder: "updated",
  dialogPromptId: null,
  draggedPromptId: null,
  dialogImageUrl: null,
  pendingExportText: null,
  pendingExportCount: 0,
  copyingPromptId: null,
  presentationMode: {
    currentSlide: 0,
    languageMode: "both", // "prompts", "notes", "both"
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
  for await (const entry of state.projectenHandle.values()) {
    if (entry.kind !== "directory") continue;
    const slug = entry.name;
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

    const title = document.createElement("strong");
    title.textContent = project.projectName;
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
  });

  elements.projectEmptyState.classList.add("hidden");
  elements.projectEditor.classList.remove("hidden");
  updateRootUi();
  applyTranslations(elements.projectEditor);
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
  card.querySelector(".prompt-text").value = prompt.text ?? "";
  card.querySelector(".prompt-nl").value = prompt.translation ?? "";

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
  await deletePrompt(promptId, state, elements);
  imageMap.delete(promptId);
  videoMap.delete(promptId);
  flagProjectDirty();
}

/**
 * Wrapper: roept modules/scenes.js movePrompt aan
 */
function movePromptWrapper(promptId, direction) {
  movePrompt(promptId, direction, state);
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

  state.presentationMode.currentSlide = 0;
  state.presentationMode.languageMode = "both";

  if (elements.presentationLanguage) {
    elements.presentationLanguage.value = "both";
  }

  // Reset video mode en check of de mode selector op video staat
  const savedVideoMode = elements.presentationMode && elements.presentationMode.value === "video";
  state.presentationMode.videoMode = savedVideoMode;
  state.presentationMode.videoTimeline = null;

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

  if (elements.presentationDialog) {
    applyTranslations(elements.presentationDialog);
    
    // Set container visibility en footer class
    const imageContainer = elements.presentationDialog.querySelector(".slide-image-container");
    const videoContainer = elements.presentationDialog.querySelector(".slide-video-container");
    const footer = elements.presentationDialog.querySelector(".presentation-footer");
    
    if (imageContainer && videoContainer) {
      if (state.presentationMode.videoMode) {
        imageContainer.dataset.active = "false";
        videoContainer.dataset.active = "true";
        if (footer) footer.classList.add("video-mode");
      } else {
        imageContainer.dataset.active = "true";
        videoContainer.dataset.active = "false";
        if (footer) footer.classList.remove("video-mode");
      }
    }
    
    elements.presentationDialog.showModal();
  }

  // Laad eerste slide NA het openen van dialog
  await updatePresentationSlideWrapper();
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
  } else {
    // Image modus: gebruik standaard updatePresentationSlide
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
    }
  }
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
  await removeImageFromPrompt(promptId, state, imageMap);
  
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
  const projectFile = await projectDir.getFileHandle("project.json", { create: false });

  const projectData = await readJsonFile(projectFile);
  // Zorg dat verplichte velden bestaan voor oudere versies
  projectData.prompts ??= [];
  // Backwards compatibility: oudere projecten kunnen geen rating hebben
  projectData.prompts.forEach((p) => {
    if (p.rating === undefined) p.rating = null;
    if (p.videoPath === undefined) p.videoPath = null; // ⭐ NIEUW: video fields
    if (p.videoOriginalName === undefined) p.videoOriginalName = null;
    if (p.videoType === undefined) p.videoType = null;
  });
  projectData.createdAt ??= projectMeta.createdAt;
  projectData.updatedAt ??= projectMeta.updatedAt;
  projectData.videoGenerator ??= projectMeta.videoGenerator ?? "";
  projectData.notes ??= projectMeta.notes ?? "";

  state.selectedProjectId = projectId;
  state.projectHandle = projectFile;
  state.projectImagesHandle = imagesDir;
  state.projectVideosHandle = videosDir; // ⭐ NIEUW: stel videos handle in
  state.projectData = projectData;
  state.isDirty = false;

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

  renderProjectList();
  renderProjectEditor();
  updateRootUi();
}

/**
 * Prompt toevoegen aan huidige project.
 */
/**
 * Wrapper: roept modules/scenes.js addPrompt aan
 */
function addPromptWrapper() {
  addPrompt(state, elements, flagProjectDirty);
}

/**
 * Slaat de huidige projectdata op.
 */
async function saveProject() {
  if (!state.projectHandle || !state.projectData) return;
  try {
    state.projectData.updatedAt = new Date().toISOString();
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
  elements.dialogOpenImage.disabled = !prompt.imagePath;

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
    const changed = newText !== (prompt.text ?? "") || newTranslation !== (prompt.translation ?? "");
    if (changed) {
      prompt.text = newText;
      prompt.translation = newTranslation;
      const card = elements.promptsContainer.querySelector(`.prompt-card[data-id="${prompt.id}"]`);
      if (card) {
        card.querySelector(".prompt-text").value = newText;
        card.querySelector(".prompt-nl").value = newTranslation;
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

  if (elements.languageSwitch) {
    elements.languageSwitch.addEventListener("change", (event) => {
      setLanguage(event.target.value);
    });
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
    elements.startPresentation.addEventListener("click", () =>
      openPresentation().catch((error) => showError(t("errors.openPrompt"), error))
    );
  }
  if (elements.presentationLanguage) {
    elements.presentationLanguage.addEventListener("change", (event) => {
      setPresentationLanguageWrapper(event.target.value);
    });
  }
  if (elements.presentationMode) {
    elements.presentationMode.addEventListener("change", async (event) => {
      const mode = event.target.value; // "image" of "video"
      const wasVideoMode = state.presentationMode.videoMode;
      state.presentationMode.videoMode = (mode === "video");
      
      // Toggle image/video containers
      const imageContainer = elements.presentationDialog.querySelector(".slide-image-container");
      const videoContainer = elements.presentationDialog.querySelector(".slide-video-container");
      const footer = elements.presentationDialog.querySelector(".presentation-footer");
      
      if (imageContainer && videoContainer) {
        if (mode === "video") {
          imageContainer.dataset.active = "false";
          videoContainer.dataset.active = "true";
          if (footer) footer.classList.add("video-mode");
          
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
        } else {
          imageContainer.dataset.active = "true";
          videoContainer.dataset.active = "false";
          if (footer) footer.classList.remove("video-mode");
          
          // Stop video als we terug gaan naar image mode
          if (elements.presentationVideo) {
            elements.presentationVideo.pause();
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
