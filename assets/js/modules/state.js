/**
 * modules/state.js
 * 
 * Centralized state management
 * Bevat alle applicatie state en state management logica
 */

/**
 * Centrale applicatie state
 * Alle wijzigingen aan deze state moeten via de exported functies gaan
 * zodat we kunnen tracken en debuggen waar state verandert
 */
const state = {
  rootHandle: null,
  projectenHandle: null,
  indexData: { projects: [] },
  projectData: null,
  projectImagesHandle: null,
  projectVideosHandle: null,
  projectAttachmentsHandle: null,
  sortOrder: "updated",
  currentProjectId: null,
  isDirty: false,
  currentMediaViewMode: "images", // "images" of "videos"
  currentDialogPromptId: null,
};

/**
 * Cache voor afbeeldingen en video's
 * Gebruikt om DOM updates te minimaliseren
 */
const caches = {
  images: new Map(), // Map<promptId, { path, url, type, originalName }>
  videos: new Map(), // Map<promptId, { path, url, type, originalName }>
};

/**
 * Haal de volledige state op
 * Gebruik alleen voor lezen, niet voor directe mutaties
 * 
 * @returns {Object} - Huidige applicatie state
 */
export function getState() {
  return state;
}

/**
 * Haal de image cache op
 * 
 * @returns {Map} - Image cache
 */
export function getImageCache() {
  return caches.images;
}

/**
 * Haal de video cache op
 * 
 * @returns {Map} - Video cache
 */
export function getVideoCache() {
  return caches.videos;
}

/**
 * Reset de state naar initiële waarden
 * Gebruikt bij het afsluiten van een project
 */
export function resetState() {
  state.projectData = null;
  state.projectImagesHandle = null;
  state.projectVideosHandle = null;
  state.projectAttachmentsHandle = null;
  state.currentProjectId = null;
  state.isDirty = false;
  state.currentDialogPromptId = null;
  caches.images.clear();
  caches.videos.clear();
}

/**
 * Zet de root directory handle
 * 
 * @param {FileSystemDirectoryHandle} handle - Root directory handle
 */
export function setRootHandle(handle) {
  state.rootHandle = handle;
}

/**
 * Zet de projecten directory handle
 * 
 * @param {FileSystemDirectoryHandle} handle - Projecten directory handle
 */
export function setProjectenHandle(handle) {
  state.projectenHandle = handle;
}

/**
 * Update de index data
 * 
 * @param {Object} indexData - Nieuwe index data
 */
export function setIndexData(indexData) {
  state.indexData = indexData;
}

/**
 * Voeg een project toe aan de index
 * 
 * @param {Object} projectEntry - Project entry om toe te voegen
 */
export function addProjectToIndex(projectEntry) {
  state.indexData.projects.push(projectEntry);
}

/**
 * Update een project in de index
 * 
 * @param {string} projectId - ID van het project
 * @param {Object} updates - Velden om te updaten
 */
export function updateProjectInIndex(projectId, updates) {
  const project = state.indexData.projects.find(p => p.id === projectId);
  if (project) {
    Object.assign(project, updates);
  }
}

/**
 * Verwijder een project uit de index
 * 
 * @param {string} projectId - ID van het project om te verwijderen
 */
export function removeProjectFromIndex(projectId) {
  const index = state.indexData.projects.findIndex(p => p.id === projectId);
  if (index !== -1) {
    state.indexData.projects.splice(index, 1);
  }
}

/**
 * Laad een project in de state
 * 
 * @param {Object} projectData - Project data om te laden
 * @param {FileSystemDirectoryHandle} imagesHandle - Images directory handle
 * @param {FileSystemDirectoryHandle} videosHandle - Videos directory handle
 * @param {FileSystemDirectoryHandle} attachmentsHandle - Attachments directory handle
 */
export function loadProject(projectData, imagesHandle, videosHandle, attachmentsHandle) {
  state.projectData = projectData;
  state.projectImagesHandle = imagesHandle;
  state.projectVideosHandle = videosHandle;
  state.projectAttachmentsHandle = attachmentsHandle;
  state.currentProjectId = projectData.id;
  state.isDirty = false;
}

/**
 * Markeer het huidige project als gewijzigd (dirty)
 * 
 * @param {boolean} dirty - True als project gewijzigd is
 */
export function setProjectDirty(dirty = true) {
  state.isDirty = dirty;
}

/**
 * Controleer of het huidige project gewijzigd is
 * 
 * @returns {boolean} - True als project gewijzigd is
 */
export function isProjectDirty() {
  return state.isDirty;
}

/**
 * Zet de sorteer volgorde voor projecten
 * 
 * @param {string} order - "updated", "created", "name-asc" of "name-desc"
 */
export function setSortOrder(order) {
  state.sortOrder = order;
}

/**
 * Zet de huidige media view mode
 * 
 * @param {string} mode - "images" of "videos"
 */
export function setMediaViewMode(mode) {
  state.currentMediaViewMode = mode;
}

/**
 * Haal huidige project data op
 * 
 * @returns {Object|null} - Huidige project data of null
 */
export function getCurrentProject() {
  return state.projectData;
}

/**
 * Haal project directory handles op
 * 
 * @returns {Object} - Object met images, videos en attachments handles
 */
export function getProjectHandles() {
  return {
    images: state.projectImagesHandle,
    videos: state.projectVideosHandle,
    attachments: state.projectAttachmentsHandle,
  };
}

/**
 * Update een scene in het huidige project
 * 
 * @param {string} promptId - ID van de scene
 * @param {Object} updates - Velden om te updaten
 * @returns {boolean} - True als scene gevonden en geupdate
 */
export function updateScene(promptId, updates) {
  if (!state.projectData || !state.projectData.prompts) {
    return false;
  }
  
  const scene = state.projectData.prompts.find(p => p.id === promptId);
  if (scene) {
    Object.assign(scene, updates);
    state.isDirty = true;
    return true;
  }
  
  return false;
}

/**
 * Haal een scene op uit het huidige project
 * 
 * @param {string} promptId - ID van de scene
 * @returns {Object|null} - Scene data of null
 */
export function getScene(promptId) {
  if (!state.projectData || !state.projectData.prompts) {
    return null;
  }
  
  return state.projectData.prompts.find(p => p.id === promptId) || null;
}

/**
 * Haal alle scenes op van het huidige project
 * 
 * @returns {Array} - Array van scenes
 */
export function getAllScenes() {
  if (!state.projectData || !state.projectData.prompts) {
    return [];
  }
  
  return state.projectData.prompts;
}

/**
 * Zet de huidige dialog prompt ID
 * Gebruikt om te tracken welke scene in de dialog wordt bewerkt
 * 
 * @param {string|null} promptId - Prompt ID of null
 */
export function setCurrentDialogPromptId(promptId) {
  state.currentDialogPromptId = promptId;
}

/**
 * Haal de huidige dialog prompt ID op
 * 
 * @returns {string|null} - Huidige dialog prompt ID
 */
export function getCurrentDialogPromptId() {
  return state.currentDialogPromptId;
}
