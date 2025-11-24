/**
 * modules/ui-rendering.js
 * 
 * UI rendering functies voor project lijst en prompt cards
 * Afgesplitst uit app.js voor betere organisatie
 */

import { formatDateTime } from "./utils.js";
import { t } from "./i18n.js";
import { CSS_CLASSES } from "./constants.js";

/**
 * Render project meta informatie
 * 
 * @param {HTMLElement} metaElement - Meta display element
 * @param {Object} projectData - Project data
 * @param {boolean} isDirty - Dirty status
 */
export function renderProjectMeta(metaElement, projectData, isDirty) {
  if (!projectData) {
    metaElement.innerHTML = "";
    return;
  }

  const { createdAt, updatedAt, prompts } = projectData;
  const dirtySuffix = isDirty ? ` ${t("project.dirtySuffix")}` : "";
  
  metaElement.innerHTML = `
    <span>${t("project.created", { date: formatDateTime(createdAt) })}</span>
    <span>${t("project.lastUpdated", { date: formatDateTime(updatedAt) })}${dirtySuffix}</span>
    <span>${t("project.promptCount", { count: prompts.length })}</span>
  `;
}

/**
 * Render een project list item
 * 
 * @param {Object} project - Project data
 * @param {boolean} isSelected - Is dit project geselecteerd
 * @returns {HTMLElement} - Project list item element
 */
export function createProjectListItem(project, isSelected = false) {
  const div = document.createElement("div");
  div.className = `project-item ${isSelected ? CSS_CLASSES.SELECTED : ""}`;
  div.dataset.id = project.id;
  
  div.innerHTML = `
    <strong>${escapeHtml(project.projectName)}</strong>
    <span>${t("project.lastUpdated", { date: formatDateTime(project.updatedAt) })}</span>
    <span>${t("project.created", { date: formatDateTime(project.createdAt) })}</span>
    <span>${t("project.promptCount", { count: project.prompts ? project.prompts.length : 0 })}</span>
  `;
  
  return div;
}

/**
 * Update een bestaand project list item
 * 
 * @param {HTMLElement} listItem - List item element
 * @param {Object} projectData - Project data
 */
export function updateProjectListItem(listItem, projectData) {
  if (!listItem || !projectData) return;

  const title = listItem.querySelector("strong");
  if (title) {
    title.textContent = projectData.projectName;
  }

  const spans = listItem.querySelectorAll("span");
  if (spans[0]) {
    spans[0].textContent = t("project.lastUpdated", { date: formatDateTime(projectData.updatedAt) });
  }
  if (spans[1]) {
    spans[1].textContent = t("project.created", { date: formatDateTime(projectData.createdAt) });
  }
  if (spans[2]) {
    spans[2].textContent = t("project.promptCount", { count: projectData.prompts.length });
  }
}

/**
 * Render scene index label
 * 
 * @param {number} index - Scene index (0-based)
 * @returns {string} - Formatted scene label
 */
export function renderSceneIndex(index) {
  return t("prompts.scene", { index: index + 1 });
}

/**
 * Render afbeelding placeholder tekst
 * 
 * @param {Object} prompt - Prompt object
 * @returns {string} - Placeholder tekst
 */
export function renderImagePlaceholder(prompt) {
  if (prompt.imagePath) {
    return prompt.imageOriginalName ?? t("prompt.imageAddedFallback");
  }
  return t("prompt.placeholderImage");
}

/**
 * Render video placeholder tekst
 * 
 * @param {Object} prompt - Prompt object
 * @returns {string} - Placeholder tekst
 */
export function renderVideoPlaceholder(prompt) {
  if (prompt.videoPath) {
    return prompt.videoOriginalName ?? t("prompt.videoAddedFallback");
  }
  return t("prompt.placeholderVideo");
}

/**
 * Render audio placeholder tekst
 * 
 * @param {Object} prompt - Prompt object
 * @returns {string} - Placeholder tekst
 */
export function renderAudioPlaceholder(prompt) {
  if (prompt.audioPath) {
    return prompt.audioOriginalName ?? t("prompt.audioAddedFallback");
  }
  return t("prompt.placeholderAudio");
}

/**
 * Render transition button tekst
 * 
 * @param {string} type - Transition type
 * @param {number} duration - Duration in ms
 * @returns {string} - Button tekst
 */
export function renderTransitionButton(type, duration) {
  const typeLabel = t(`transitions.${type}`, type);
  const durationSec = (duration / 1000).toFixed(1);
  return `${typeLabel} (${durationSec}s)`;
}

/**
 * Render audio duration display
 * 
 * @param {number} duration - Duration in seconds
 * @returns {string} - Formatted duration
 */
export function renderAudioDuration(duration) {
  if (!duration || duration === 0) return "";
  
  const minutes = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Render marker count badge
 * 
 * @param {number} count - Aantal markers
 * @returns {string} - HTML voor badge
 */
export function renderMarkerCount(count) {
  if (!count || count === 0) return "";
  return `<span class="marker-count">${count} ${t("audio.markers")}</span>`;
}

/**
 * Render empty state message
 * 
 * @param {string} messageKey - Translation key voor bericht
 * @returns {string} - HTML voor empty state
 */
export function renderEmptyState(messageKey) {
  return `<div class="empty-state">${t(messageKey)}</div>`;
}

/**
 * Render error state message
 * 
 * @param {string} messageKey - Translation key voor bericht
 * @param {Error} [error] - Optional error object
 * @returns {string} - HTML voor error state
 */
export function renderErrorState(messageKey, error) {
  const message = t(messageKey);
  const details = error ? `<br><small>${escapeHtml(error.message)}</small>` : "";
  return `<div class="error-state">${message}${details}</div>`;
}

/**
 * Render loading state
 * 
 * @param {string} [messageKey] - Optional translation key
 * @returns {string} - HTML voor loading state
 */
export function renderLoadingState(messageKey) {
  const message = messageKey ? t(messageKey) : t("common.loading");
  return `<div class="loading-state">
    <div class="spinner"></div>
    <span>${message}</span>
  </div>`;
}

/**
 * Render scene stats summary
 * 
 * @param {Object} stats - Stats object from getSceneStats
 * @returns {string} - HTML voor stats
 */
export function renderSceneStats(stats) {
  return `
    <div class="scene-stats">
      <span>${t("stats.total")}: ${stats.total}</span>
      <span>${t("stats.withImages")}: ${stats.withImages}</span>
      <span>${t("stats.withVideos")}: ${stats.withVideos}</span>
      <span>${t("stats.withAudio")}: ${stats.withAudio}</span>
    </div>
  `;
}

/**
 * Escape HTML om XSS te voorkomen
 * 
 * @param {string} str - Te escapen string
 * @returns {string} - Escaped string
 */
function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Render scene card header
 * 
 * @param {number} index - Scene index
 * @param {string} sceneId - Scene ID
 * @returns {string} - HTML voor header
 */
export function renderSceneCardHeader(index, sceneId) {
  return `
    <div class="prompt-card-header">
      <span class="prompt-index">${renderSceneIndex(index)}</span>
      <div class="prompt-card-actions">
        <button class="duplicate-prompt" data-id="${sceneId}" title="${t("prompts.duplicate")}">📋</button>
        <button class="delete-prompt" data-id="${sceneId}" title="${t("prompts.delete")}">🗑️</button>
        <button class="open-prompt" data-id="${sceneId}" title="${t("prompts.editFull")}">${t("prompts.edit")}</button>
      </div>
    </div>
  `;
}

/**
 * Render media tabs voor scene card
 * 
 * @param {boolean} hasImage - Heeft scene een afbeelding
 * @param {boolean} hasVideo - Heeft scene een video
 * @returns {string} - HTML voor media tabs
 */
export function renderMediaTabs(hasImage, hasVideo) {
  const imageActive = !hasVideo ? "active" : "";
  const videoActive = hasVideo ? "active" : "";
  
  return `
    <div class="media-tabs">
      <button class="toggle-image ${imageActive}" title="${t("media.image")}">🖼️</button>
      <button class="toggle-video ${videoActive}" title="${t("media.video")}">🎬</button>
    </div>
  `;
}

/**
 * Rendert de prompts in batches (chunks) om de UI responsief te houden.
 * Dit voorkomt dat de browser bevriest bij grote projecten (bijv. 65+ scenes).
 * 
 * @param {Array} prompts - De lijst met prompt objecten
 * @param {HTMLElement} container - De container waar de kaarten in moeten
 * @param {Function} createCardFn - De functie die 1 kaart HTML element maakt (bijv. createPromptCard)
 */
export function renderPromptsInBatches(prompts, container, createCardFn) {
  // 1. Maak container eerst helemaal leeg
  container.innerHTML = '';

  if (!prompts || prompts.length === 0) return;

  // 2. Configuratie voor batching
  const BATCH_SIZE = 10; // Aantal kaarten per keer renderen
  let currentIndex = 0;

  // 3. De recursieve render functie
  function renderNextBatch() {
    const fragment = document.createDocumentFragment();
    const batchEnd = Math.min(currentIndex + BATCH_SIZE, prompts.length);

    // Render alleen dit blokje
    for (let i = currentIndex; i < batchEnd; i++) {
      const prompt = prompts[i];
      // Geef index mee (i) voor de nummering (createPromptCard verwacht 0-based index)
      const card = createCardFn(prompt, i); 
      if (card) {
        fragment.appendChild(card);
      }
    }

    // Voeg toe aan de DOM (slechts 1 "reflow" per batch)
    container.appendChild(fragment);
    
    currentIndex += BATCH_SIZE;

    // Als er nog prompts over zijn, plan de volgende batch
    if (currentIndex < prompts.length) {
      // requestAnimationFrame zorgt dat de UI niet bevriest tussen batches
      requestAnimationFrame(renderNextBatch);
    }
  }

  // Start de eerste batch
  renderNextBatch();
}
