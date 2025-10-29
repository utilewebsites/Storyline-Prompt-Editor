/* eslint-disable no-await-in-loop */

/**
 * Storyline Prompt Editor
 * In dit script regelen we het complete beheer van storylineprojecten:
 * - Structuur opzetten in de gekozen map
 * - Projecten laden, aanmaken, updaten en exporteren
 * - Promptvelden beheren inclusief afbeeldingen en exportacties
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
  exportImages: document.querySelector("#export-images"),
  exportDialog: document.querySelector("#export-dialog"),
  exportPreviewDialog: document.querySelector("#export-preview-dialog"),
  exportPreviewText: document.querySelector("#export-preview-text"),
  exportPreviewCopy: document.querySelector("#export-preview-copy"),
  exportPreviewInfo: document.querySelector("#export-preview-info"),
  errorDialog: document.querySelector("#error-dialog"),
  errorMessage: document.querySelector("#error-message"),
  promptTemplate: document.querySelector("#prompt-template"),
  promptDialog: document.querySelector("#prompt-dialog"),
  dialogSceneIndex: document.querySelector("#dialog-scene-index"),
  dialogText: document.querySelector("#dialog-text"),
  dialogTranslation: document.querySelector("#dialog-translation"),
  dialogImage: document.querySelector("#dialog-image"),
  dialogImagePlaceholder: document.querySelector("#dialog-image-placeholder"),
  dialogImageWrapper: document.querySelector(".dialog-image-preview"),
  dialogOpenImage: document.querySelector("#dialog-open-image"),
  dialogSave: document.querySelector("#dialog-save"),
};

const state = {
  rootHandle: null,
  projectenHandle: null,
  indexHandle: null,
  indexData: { version: 1, projects: [] },
  selectedProjectId: null,
  projectHandle: null,
  projectImagesHandle: null,
  projectData: null,
  isDirty: false,
  sortOrder: "updated",
  dialogPromptId: null,
  draggedPromptId: null,
  dialogImageUrl: null,
  pendingExportText: null,
  pendingExportCount: 0,
};

const translations = {
  nl: {
    header: {
      title: "Storyline Prompt Editor",
      subtitle: "Beheer storylineprojecten, prompts en scene-afbeeldingen in één overzicht.",
      languageLabel: "Taal",
    },
    actions: {
      chooseRoot: "📁 Kies projectmap",
      cancel: "Annuleer",
    },
    projects: {
      title: "Projecten",
      refresh: "🔄",
      refreshTitle: "Projecten opnieuw inlezen",
      sortLabel: "Sorteer op",
      sort: {
        updated: "Laatst aangepast",
        created: "Aanmaakdatum",
        name: "Projectnaam",
      },
      empty: "Geen projecten gevonden. Maak een nieuw project aan.",
    },
    newProject: {
      title: "Nieuw project",
      name: "Projectnaam",
      generator: "Video generator",
      notes: "Notities",
      create: "➕ Maak project",
    },
    workspace: {
      emptyTitle: "Kies of maak een project",
      emptyDescription: "Selecteer een project links of maak een nieuw project aan om prompts te beheren.",
    },
    project: {
      save: "💾 Opslaan",
      exportPrompts: "🗒️ Exporteer prompts",
      exportImages: "🖼️ Exporteer afbeeldingen",
      lastUpdated: "Laatst aangepast: {{date}}",
      created: "Aangemaakt: {{date}}",
      promptCount: "Prompts: {{count}}",
      dirtySuffix: "(concept)",
    },
    metadata: {
      generator: "Video generator",
      notes: "Notities",
    },
    prompts: {
      title: "Prompts",
      add: "➕ Nieuwe prompt",
      help: "Sleep afbeeldingen op een kaart of gebruik de uploadknop. Bekijk per scene de afbeelding, de Engelse prompt en de vertaling naar het Nederlands.",
      scene: "Scene {{index}}",
    },
    prompt: {
      open: "🔍",
      openTitle: "Open scene groter bekijken",
      drag: "⠿",
      dragTitle: "Sleep scene",
      moveUp: "⬆️",
      moveUpTitle: "Verplaats scene omhoog",
      moveDown: "⬇️",
      moveDownTitle: "Verplaats scene omlaag",
      delete: "🗑️",
      deleteTitle: "Verwijder scene",
      placeholderImage: "Sleep hier een afbeelding",
      uploadButton: "📁 Kies afbeelding",
      removeImage: "Verwijder",
      removeImageTitle: "Verwijder afbeelding",
      labelPrompt: "Engelse prompt",
      promptPlaceholder: "Schrijf de Engelse prompt...",
      labelTranslation: "Vertaling",
      translationPlaceholder: "Schrijf hier de vertaling...",
      imageAddedFallback: "Afbeelding toegevoegd",
    },
    dialog: {
      export: {
        title: "Prompts exporteren",
        message: "De prompts zijn gekopieerd naar het klembord en opgeslagen als tekstbestand in de projectmap.",
        close: "Sluiten",
      },
      prompt: {
        title: "Scene",
      openImage: "Open afbeelding",
      cancel: "Annuleer",
      save: "Opslaan",
      promptLabel: "Engelse prompt",
      translationLabel: "Vertaling",
      noImage: "Nog geen afbeelding gekoppeld.",
      loadFailed: "Afbeelding laden mislukt.",
      loadingImage: "Afbeelding wordt geladen...",
    },
      error: {
        title: "Foutmelding",
        close: "Sluiten",
      },
    },
    exportPreview: {
      title: "Controleer prompts",
      description: "Bekijk de prompts hieronder. Je kunt ze kopiëren of opslaan vanuit deze dialoog.",
      copy: "Kopieer naar klembord",
      save: "Opslaan en kopiëren",
      copied: "Prompts gekopieerd naar het klembord.",
    },
    alerts: {
      imagesExported: "Afbeeldingen geëxporteerd naar map {{dir}}",
    },
    errors: {
      projectNameRequired: "Projectnaam is verplicht",
      createProject: "Project aanmaken mislukt",
      openProject: "Project openen mislukt",
      openPrompt: "Scene openen mislukt",
      saveProject: "Project opslaan mislukt",
      refreshProjects: "Projecten verversen mislukt",
      chooseRootPermission: "Geen schrijfrechten op de gekozen map",
      chooseRoot: "Map kiezen mislukt",
      noPrompts: "Er zijn geen prompts om te exporteren",
      exportPrompts: "Prompts exporteren mislukt",
      exportImages: "Afbeeldingen exporteren mislukt",
      saveImage: "Afbeelding opslaan mislukt",
      loadImage: "Afbeelding openen mislukt",
      assignImage: "Afbeelding opslaan mislukt",
      noSceneSelected: "Geen scene geselecteerd",
      noImageAvailable: "Geen afbeelding beschikbaar",
      copyFailed: "Kopiëren naar klembord mislukt",
      popupBlocked: "Sta pop-ups toe om de afbeelding te bekijken.",
      linkImageFirst: "Koppel eerst een afbeelding aan deze scene.",
    },
    info: {
      clipboardNotSupported: "Klembord niet beschikbaar in deze browser.",
      needsSecureContext: "Deze browser ondersteunt window.showDirectoryPicker niet. Gebruik Chrome of Edge en open via http://localhost.",
    },
  },
  en: {
    header: {
      title: "Storyline Prompt Editor",
      subtitle: "Manage storyline projects, prompts and scene images in one overview.",
      languageLabel: "Language",
    },
    actions: {
      chooseRoot: "📁 Choose project folder",
      cancel: "Cancel",
    },
    projects: {
      title: "Projects",
      refresh: "🔄",
      refreshTitle: "Reload projects",
      sortLabel: "Sort by",
      sort: {
        updated: "Last modified",
        created: "Creation date",
        name: "Project name",
      },
      empty: "No projects found. Create a new project.",
    },
    newProject: {
      title: "New project",
      name: "Project name",
      generator: "Video generator",
      notes: "Notes",
      create: "➕ Create project",
    },
    workspace: {
      emptyTitle: "Select or create a project",
      emptyDescription: "Select a project on the left or create a new one to manage prompts.",
    },
    project: {
      save: "💾 Save",
      exportPrompts: "🗒️ Export prompts",
      exportImages: "🖼️ Export images",
      lastUpdated: "Last modified: {{date}}",
      created: "Created: {{date}}",
      promptCount: "Prompts: {{count}}",
      dirtySuffix: "(draft)",
    },
    metadata: {
      generator: "Video generator",
      notes: "Notes",
    },
    prompts: {
      title: "Prompts",
      add: "➕ New prompt",
      help: "Drag images onto a card or use the upload button. See the image, English prompt and translation per scene.",
      scene: "Scene {{index}}",
    },
    prompt: {
      open: "🔍",
      openTitle: "Open scene in detail",
      drag: "⠿",
      dragTitle: "Drag scene",
      moveUp: "⬆️",
      moveUpTitle: "Move scene up",
      moveDown: "⬇️",
      moveDownTitle: "Move scene down",
      delete: "🗑️",
      deleteTitle: "Delete scene",
      placeholderImage: "Drop an image here",
      uploadButton: "📁 Choose image",
      removeImage: "Remove",
      removeImageTitle: "Remove image",
      labelPrompt: "English prompt",
      promptPlaceholder: "Write the English prompt...",
      labelTranslation: "Translation",
      translationPlaceholder: "Write the translated prompt...",
      imageAddedFallback: "Image added",
    },
    dialog: {
      export: {
        title: "Export prompts",
        message: "Prompts were copied to the clipboard and saved as a text file in the project folder.",
        close: "Close",
      },
      prompt: {
        title: "Scene",
      openImage: "Open image",
      cancel: "Cancel",
      save: "Save",
      promptLabel: "English prompt",
      translationLabel: "Translation",
      noImage: "No image linked yet.",
      loadFailed: "Failed to load image.",
      loadingImage: "Loading image...",
    },
      error: {
        title: "Error",
        close: "Close",
      },
    },
    exportPreview: {
      title: "Review prompts",
      description: "Review the prompts below. You can copy or save them from this dialog.",
      copy: "Copy to clipboard",
      save: "Save and copy",
      copied: "Prompts copied to the clipboard.",
    },
    alerts: {
      imagesExported: "Images exported to folder {{dir}}",
    },
    errors: {
      projectNameRequired: "Project name is required",
      createProject: "Failed to create project",
      openProject: "Failed to open project",
      openPrompt: "Failed to open scene",
      saveProject: "Failed to save project",
      refreshProjects: "Failed to refresh projects",
      chooseRootPermission: "No write permission on the selected folder",
      chooseRoot: "Choosing a folder failed",
      noPrompts: "There are no prompts to export",
      exportPrompts: "Failed to export prompts",
      exportImages: "Failed to export images",
      saveImage: "Failed to save image",
      loadImage: "Failed to open image",
      assignImage: "Failed to save image",
      noSceneSelected: "No scene selected",
      noImageAvailable: "No image available",
      copyFailed: "Copying to clipboard failed",
      popupBlocked: "Allow pop-ups to view the image.",
      linkImageFirst: "Link an image to this scene first.",
    },
    info: {
      clipboardNotSupported: "Clipboard is not available in this browser.",
      needsSecureContext: "This browser does not support window.showDirectoryPicker. Use Chrome or Edge and open via http://localhost.",
    },
  },
};

let currentLanguage = "nl";

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

const localeByLanguage = {
  nl: "nl-NL",
  en: "en-US",
};

const formatDateTime = (value) => {
  if (!value) return "";
  try {
    const locale = localeByLanguage[currentLanguage] ?? localeByLanguage.nl;
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const uuid = () => crypto.randomUUID();

const slugify = (text) =>
  text
    .toString()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .substring(0, 60) || "project";

/**
 * Map van promptId naar afbeeldingmetadata zodat we weten welk pad geschreven is.
 */
const imageMap = new Map();

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
 * Leest een bestand en geeft JSON terug.
 */
async function readJsonFile(fileHandle) {
  const file = await fileHandle.getFile();
  const text = await file.text();
  if (!text.trim()) {
    return {};
  }
  return JSON.parse(text);
}

/**
 * Schrijft JSON-gegevens naar een bestand.
 */
async function writeJsonFile(fileHandle, data) {
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

/**
 * Schrijft een string naar een bestand.
 */
async function writeTextFile(fileHandle, content) {
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

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
    deletePrompt(prompt.id);
  });
  card.querySelector(".move-up").addEventListener("click", () => {
    movePrompt(prompt.id, -1);
  });
  card.querySelector(".move-down").addEventListener("click", () => {
    movePrompt(prompt.id, 1);
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
      assignImageToPrompt(prompt.id, file, uploader).catch((error) => showError(t("errors.assignImage"), error));
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
    assignImageToPrompt(prompt.id, file, uploader).catch((error) => showError(t("errors.assignImage"), error));
  });

  card.querySelector(".remove-image").addEventListener("click", () => {
    removeImageFromPrompt(prompt.id, uploader);
  });

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
 * Past een veld aan binnen de prompt en markeert het project als gewijzigd.
 */
function updatePromptField(promptId, field, value) {
  const prompt = state.projectData.prompts.find((item) => item.id === promptId);
  if (!prompt) return;
  if (prompt[field] === value) return;
  prompt[field] = value;
  flagProjectDirty({ refreshEditor: false, refreshList: false });
}

function deletePrompt(promptId) {
  const index = state.projectData.prompts.findIndex((item) => item.id === promptId);
  if (index === -1) return;
  state.projectData.prompts.splice(index, 1);
  imageMap.delete(promptId);
  flagProjectDirty();
}

function movePrompt(promptId, direction) {
  const prompts = state.projectData.prompts;
  const index = prompts.findIndex((item) => item.id === promptId);
  if (index === -1) return;
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= prompts.length) return;
  const [moved] = prompts.splice(index, 1);
  prompts.splice(targetIndex, 0, moved);
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
 * Koppelt een afbeelding aan een prompt door het bestand naar de images-map te schrijven.
 */
async function assignImageToPrompt(promptId, file, uploader) {
  if (!file) return;
  if (!state.projectImagesHandle) throw new Error("Geen afbeeldingenmap gevonden");

  const extension = file.name.split(".").pop();
  const filename = `${promptId}.${extension}`;
  const fileHandle = await state.projectImagesHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(await file.arrayBuffer());
  await writable.close();

  const prompt = state.projectData.prompts.find((item) => item.id === promptId);
  if (!prompt) return;
  prompt.imagePath = filename;
  prompt.imageOriginalName = file.name;
  prompt.imageType = file.type;
  imageMap.set(promptId, { fileHandle, filename, extension });
  flagProjectDirty();

  uploader.dataset.hasImage = "true";
  const previewImg = uploader.querySelector("img");
  const placeholder = uploader.querySelector(".placeholder");
  placeholder.textContent = file.name || t("prompt.imageAddedFallback");
  const blobUrl = URL.createObjectURL(file);
  previewImg.src = blobUrl;
}

function removeImageFromPrompt(promptId, uploader) {
  const prompt = state.projectData.prompts.find((item) => item.id === promptId);
  if (!prompt) return;
  prompt.imagePath = null;
  prompt.imageOriginalName = null;
  prompt.imageType = null;
  imageMap.delete(promptId);
  uploader.dataset.hasImage = "false";
  const previewImg = uploader.querySelector("img");
  const placeholder = uploader.querySelector(".placeholder");
  placeholder.textContent = t("prompt.placeholderImage");
  previewImg.removeAttribute("src");
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
 * Opent een project en laadt alle data.
 */
async function openProject(projectId) {
  if (!state.projectenHandle) throw new Error("Projectenmap niet beschikbaar");
  const projectMeta = state.indexData.projects.find((project) => project.id === projectId);
  if (!projectMeta) throw new Error("Project niet gevonden");

  const projectDir = await state.projectenHandle.getDirectoryHandle(projectMeta.slug, { create: false });
  const imagesDir = await projectDir.getDirectoryHandle("images", { create: true });
  const projectFile = await projectDir.getFileHandle("project.json", { create: false });

  const projectData = await readJsonFile(projectFile);
  // Zorg dat verplichte velden bestaan voor oudere versies
  projectData.prompts ??= [];
  projectData.createdAt ??= projectMeta.createdAt;
  projectData.updatedAt ??= projectMeta.updatedAt;
  projectData.videoGenerator ??= projectMeta.videoGenerator ?? "";
  projectData.notes ??= projectMeta.notes ?? "";

  state.selectedProjectId = projectId;
  state.projectHandle = projectFile;
  state.projectImagesHandle = imagesDir;
  state.projectData = projectData;
  state.isDirty = false;

  imageMap.clear();
  projectData.prompts.forEach((prompt) => {
    if (prompt.imagePath) {
      imageMap.set(prompt.id, { filename: prompt.imagePath });
    }
  });

  renderProjectList();
  renderProjectEditor();
  updateRootUi();
}

/**
 * Prompt toevoegen aan huidige project.
 */
function addPrompt() {
  if (!state.projectData) return;
  const prompt = {
    id: uuid(),
    text: "",
    translation: "",
    imagePath: null,
    imageOriginalName: null,
    imageType: null,
  };
  state.projectData.prompts.push(prompt);
  flagProjectDirty();
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
  if (!state.projectData || !state.projectHandle) return;
  try {
    const prompts = state.projectData.prompts
      .map((prompt) => (prompt.text ?? "").replace(/\s+/g, " ").trim())
      .filter((line) => line.length > 0);

    if (!prompts.length) {
      showError(t("errors.noPrompts"));
      return;
    }

    state.pendingExportText = prompts.join("\n\n");
    state.pendingExportCount = prompts.length;
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

    // Eerst oude bestanden verwijderen zodat de volgorde schoon is.
    for await (const entry of exportDir.values()) {
      if (entry.kind === "file") {
        await exportDir.removeEntry(entry.name);
      }
    }

    let counter = 1;
    for (const prompt of state.projectData.prompts) {
      if (!prompt.imagePath) continue;
      const sourceHandle = await state.projectImagesHandle.getFileHandle(prompt.imagePath);
      const sourceFile = await sourceHandle.getFile();
      const extension = prompt.imagePath.split(".").pop();
      const targetName = `${counter}.${extension}`;
      const targetHandle = await exportDir.getFileHandle(targetName, { create: true });
      const writable = await targetHandle.createWritable();
      await writable.write(await sourceFile.arrayBuffer());
      await writable.close();
      counter += 1;
    }

    window.alert(t("alerts.imagesExported", { dir: exportDirName }));
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

async function openPromptDialog(promptId) {
  if (!elements.promptDialog) return;
  if (!state.projectData) return;
  const prompt = state.projectData.prompts.find((item) => item.id === promptId);
  if (!prompt) return;
  state.dialogPromptId = promptId;

  resetDialogImageState(prompt.imagePath ? t("dialog.prompt.loadingImage") : t("dialog.prompt.noImage"));

  const sceneIndex = state.projectData.prompts.indexOf(prompt) + 1;
  elements.dialogSceneIndex.textContent = sceneIndex;
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
  applyTranslations(elements.promptDialog);
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
  elements.addPrompt.addEventListener("click", addPrompt);
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
  updateRootUi();
  tryRestoreLastRoot().catch((error) => {
    console.warn("Projectmap herstellen mislukt", error);
  });
}

// Start applicatie, verdere logica verloopt via eventlisteners hierboven.
init();
