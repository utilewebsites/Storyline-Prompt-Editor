/**
 * modules/project-manager.js
 * 
 * Project lijst rendering, synchronisatie en structuur beheer
 * Afgesplitst uit app.js voor betere organisatie
 */

import { readJsonFile, writeJsonFile, uuid, formatDateTime } from "./utils.js";
import { showError } from "./dialogs.js";
import { t, applyTranslations } from "./i18n.js";
import { FILE_NAMES, DIR_NAMES } from "./constants.js";

/**
 * Synchroniseer index met daadwerkelijke projecten op filesystem
 * 
 * @param {FileSystemDirectoryHandle} projectenHandle - Projecten directory
 * @param {FileSystemFileHandle} indexHandle - Index file handle
 * @param {Object} indexData - Huidige index data
 * @returns {Promise<Array>} - Bijgewerkte projects array
 */
export async function syncIndexWithFilesystem(projectenHandle, indexHandle, indexData) {
  if (!projectenHandle) return [];

  const existingBySlug = new Map(indexData.projects.map((project) => [project.slug, project]));
  const projects = [];
  
  // Folders die we moeten overslaan (geen project folders)
  const skipFolders = ['audio', 'images', 'videos', 'projecten'];
  
  for await (const entry of projectenHandle.values()) {
    if (entry.kind !== "directory") continue;
    const slug = entry.name;
    
    // Skip system/media folders
    if (skipFolders.includes(slug) || slug.startsWith('scene_images_')) {
      continue;
    }
    
    try {
      const projectDir = await projectenHandle.getDirectoryHandle(slug, { create: false });
      const projectFile = await projectDir.getFileHandle(FILE_NAMES.PROJECT, { create: false });
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
        hasAudioTimeline: Boolean(projectData.audioTimeline && projectData.audioTimeline.audioFileName)
      });
    } catch (error) {
      console.warn(`Projectmap '${slug}' overslaan tijdens synchronisatie`, error);
    }
  }

  // Sort by most recent first
  projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  
  // Update index file
  indexData.projects = projects;
  if (indexHandle) {
    await writeJsonFile(indexHandle, indexData);
  }
  
  return projects;
}

/**
 * Zorg ervoor dat basisstructuur bestaat (projectenmap + index)
 * 
 * @param {FileSystemDirectoryHandle} rootHandle - Root directory
 * @returns {Promise<{projectenHandle, indexHandle, indexData}>}
 */
export async function ensureStructure(rootHandle) {
  if (!rootHandle) {
    throw new Error("Geen root directory handle");
  }

  const projectenHandle = await rootHandle.getDirectoryHandle(DIR_NAMES.PROJECTS, { create: true });
  const indexHandle = await rootHandle.getFileHandle(FILE_NAMES.INDEX, { create: true });
  
  let indexData;
  try {
    const existing = await readJsonFile(indexHandle);
    indexData = {
      version: 1,
      projects: Array.isArray(existing.projects) ? existing.projects : [],
    };
  } catch (error) {
    console.warn("Index lezen mislukt, maak nieuwe index.", error);
    indexData = { version: 1, projects: [] };
    await writeJsonFile(indexHandle, indexData);
  }

  return { projectenHandle, indexHandle, indexData };
}

/**
 * Render project list in UI
 * 
 * @param {HTMLElement} listElement - Project list container
 * @param {HTMLElement} noProjectsElement - No projects message
 * @param {Array} projects - Projects array
 * @param {string} selectedProjectId - Currently selected project ID
 * @param {string} sortOrder - Sort order ("name", "created", "updated")
 * @param {string} currentLanguage - Current language
 * @param {Function} onProjectClick - Callback when project clicked
 */
export function renderProjectList(listElement, noProjectsElement, projects, selectedProjectId, sortOrder, currentLanguage, onProjectClick) {
  const hasProjects = projects.length > 0;
  noProjectsElement.classList.toggle("hidden", hasProjects);
  listElement.innerHTML = "";
  
  if (!hasProjects) return;

  // Sort projects
  const sorted = [...projects];
  sorted.sort((a, b) => {
    switch (sortOrder) {
      case "name":
        return a.projectName.localeCompare(b.projectName, currentLanguage === "nl" ? "nl" : "en");
      case "created":
        return new Date(b.createdAt) - new Date(a.createdAt);
      case "updated":
      default:
        return new Date(b.updatedAt) - new Date(a.updatedAt);
    }
  });

  // Render each project
  for (const project of sorted) {
    const li = document.createElement("li");
    li.className = "project-item";
    li.dataset.id = project.id;
    
    if (project.id === selectedProjectId) {
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

    li.addEventListener("click", () => onProjectClick(project.id));
    listElement.appendChild(li);
  }
  
  applyTranslations(listElement.parentElement);
}

/**
 * Update UI elements voor root directory status
 * 
 * @param {Object} elements - UI elements object
 * @param {FileSystemDirectoryHandle} rootHandle - Root directory handle
 * @param {boolean} hasProjectData - Is er een project geladen
 */
export function updateRootUi(elements, rootHandle, hasProjectData) {
  elements.rootPath.textContent = rootHandle?.name ?? "";
  const enabled = Boolean(rootHandle);
  
  elements.createProjectBtn.disabled = !enabled;
  elements.projectName.disabled = !enabled;
  elements.projectGenerator.disabled = !enabled;
  elements.projectNotes.disabled = !enabled;
  elements.addPrompt.disabled = !enabled || !hasProjectData;
  elements.saveProject.disabled = !enabled || !hasProjectData;
  elements.exportPrompts.disabled = !enabled || !hasProjectData;
  elements.exportImages.disabled = !enabled || !hasProjectData;
  elements.refreshProjects.disabled = !enabled;
}

/**
 * Refresh project list en mogelijk re-open current project
 * 
 * @param {Object} state - Application state
 * @param {Function} syncCallback - Callback voor synchronisatie
 * @param {Function} openProjectCallback - Callback om project te openen
 * @param {Function} resetStateCallback - Callback om state te resetten
 * @param {Function} renderCallback - Callback om UI te renderen
 */
export async function refreshProjectsList(state, syncCallback, openProjectCallback, resetStateCallback, renderCallback) {
  if (!state.rootHandle) return;
  
  const currentId = state.selectedProjectId;
  await syncCallback();

  if (currentId && state.indexData.projects.some((project) => project.id === currentId)) {
    await openProjectCallback(currentId);
    return;
  }

  // Reset state if current project no longer exists
  resetStateCallback();
  renderCallback();
}
