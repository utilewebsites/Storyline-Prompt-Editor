/**
 * modules/scene-actions.js
 * 
 * Scene/prompt CRUD operaties
 * Afgesplitst uit app.js voor betere organisatie
 */

import { uuid } from "./utils.js";
import { showError } from "./dialogs.js";
import { t } from "./i18n.js";
import { FILE_NAMES, DIR_NAMES, LIMITS } from "./constants.js";

/**
 * Voeg een nieuwe scene toe aan de prompts array
 * 
 * @param {Array} prompts - Huidige prompts array
 * @param {number} insertAfter - Index na waar de scene ingevoegd moet worden (-1 voor begin)
 * @returns {Object} - Nieuwe prompt object
 */
export function addNewScene(prompts, insertAfter = -1) {
  const newPrompt = {
    id: uuid(),
    text: "",
    translation: "",
    notes: "",
    imagePath: null,
    videoPath: null,
    audioPath: null,
    audioDuration: 0,
    audioMarkers: [],
    transitionType: "fade",
    transitionDuration: 1000
  };

  if (insertAfter === -1) {
    // Voeg toe aan begin
    prompts.unshift(newPrompt);
  } else {
    // Voeg toe na specifieke index
    prompts.splice(insertAfter + 1, 0, newPrompt);
  }

  return newPrompt;
}

/**
 * Dupliceer een bestaande scene
 * 
 * @param {Array} prompts - Huidige prompts array
 * @param {number} index - Index van te dupliceren scene
 * @returns {Object|null} - Gedupliceerde prompt of null bij fout
 */
export function duplicateScene(prompts, index) {
  if (index < 0 || index >= prompts.length) {
    console.error("Ongeldige scene index voor duplicatie");
    return null;
  }

  const original = prompts[index];
  const duplicate = {
    id: uuid(),
    text: original.text,
    translation: original.translation,
    notes: original.notes,
    imagePath: original.imagePath, // Hergebruik dezelfde afbeelding
    videoPath: original.videoPath,
    audioPath: original.audioPath,
    audioDuration: original.audioDuration,
    audioMarkers: original.audioMarkers ? [...original.audioMarkers] : [],
    transitionType: original.transitionType || "fade",
    transitionDuration: original.transitionDuration || 1000
  };

  prompts.splice(index + 1, 0, duplicate);
  return duplicate;
}

/**
 * Verwijder een scene
 * 
 * @param {Array} prompts - Huidige prompts array
 * @param {number} index - Index van te verwijderen scene
 * @returns {Object|null} - Verwijderde prompt of null bij fout
 */
export function deleteScene(prompts, index) {
  if (index < 0 || index >= prompts.length) {
    console.error("Ongeldige scene index voor verwijderen");
    return null;
  }

  if (prompts.length === 1) {
    showError(t("errors.cannotDeleteLastScene"));
    return null;
  }

  const deleted = prompts.splice(index, 1)[0];
  return deleted;
}

/**
 * Verplaats een scene naar een nieuwe positie
 * 
 * @param {Array} prompts - Huidige prompts array
 * @param {number} fromIndex - Huidige index
 * @param {number} toIndex - Nieuwe index
 * @returns {boolean} - Success status
 */
export function moveScene(prompts, fromIndex, toIndex) {
  if (fromIndex < 0 || fromIndex >= prompts.length ||
      toIndex < 0 || toIndex >= prompts.length) {
    console.error("Ongeldige scene indices voor verplaatsen");
    return false;
  }

  const [moved] = prompts.splice(fromIndex, 1);
  prompts.splice(toIndex, 0, moved);
  return true;
}

/**
 * Update een scene's tekst velden
 * 
 * @param {Object} prompt - Prompt object
 * @param {Object} updates - Updates object met text/translation/notes
 */
export function updateSceneText(prompt, updates) {
  if (updates.text !== undefined) {
    prompt.text = updates.text.substring(0, LIMITS.MAX_PROMPT_LENGTH);
  }
  if (updates.translation !== undefined) {
    prompt.translation = updates.translation.substring(0, LIMITS.MAX_PROMPT_LENGTH);
  }
  if (updates.notes !== undefined) {
    prompt.notes = updates.notes;
  }
}

/**
 * Update een scene's media pad
 * 
 * @param {Object} prompt - Prompt object
 * @param {string} mediaType - "image", "video", of "audio"
 * @param {string|null} path - Pad naar media bestand of null om te verwijderen
 */
export function updateSceneMedia(prompt, mediaType, path) {
  switch (mediaType) {
    case "image":
      prompt.imagePath = path;
      break;
    case "video":
      prompt.videoPath = path;
      break;
    case "audio":
      prompt.audioPath = path;
      if (path === null) {
        prompt.audioDuration = 0;
        prompt.audioMarkers = [];
      }
      break;
    default:
      console.error("Onbekend media type:", mediaType);
  }
}

/**
 * Update een scene's transitie instellingen
 * 
 * @param {Object} prompt - Prompt object
 * @param {string} type - Transitie type ("fade", "slide", etc.)
 * @param {number} duration - Transitie duur in ms
 */
export function updateSceneTransition(prompt, type, duration) {
  prompt.transitionType = type || "fade";
  prompt.transitionDuration = duration || 1000;
}

/**
 * Update audio markers voor een scene
 * 
 * @param {Object} prompt - Prompt object
 * @param {Array} markers - Array van marker objecten
 */
export function updateSceneAudioMarkers(prompt, markers) {
  prompt.audioMarkers = markers || [];
}

/**
 * Zoek een scene op ID
 * 
 * @param {Array} prompts - Prompts array
 * @param {string} id - Scene ID
 * @returns {Object|null} - Gevonden prompt of null
 */
export function findSceneById(prompts, id) {
  return prompts.find(p => p.id === id) || null;
}

/**
 * Zoek scene index op ID
 * 
 * @param {Array} prompts - Prompts array
 * @param {string} id - Scene ID
 * @returns {number} - Index of -1 als niet gevonden
 */
export function findSceneIndexById(prompts, id) {
  return prompts.findIndex(p => p.id === id);
}

/**
 * Valideer of een scene compleet is
 * 
 * @param {Object} prompt - Prompt object
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
export function validateScene(prompt) {
  const errors = [];

  if (!prompt.text || prompt.text.trim() === "") {
    errors.push(t("validation.emptyPrompt"));
  }

  if (!prompt.translation || prompt.translation.trim() === "") {
    errors.push(t("validation.emptyTranslation"));
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Tel verschillende statistieken van de scenes
 * 
 * @param {Array} prompts - Prompts array
 * @returns {Object} - Statistieken object
 */
export function getSceneStats(prompts) {
  return {
    total: prompts.length,
    withImages: prompts.filter(p => p.imagePath).length,
    withVideos: prompts.filter(p => p.videoPath).length,
    withAudio: prompts.filter(p => p.audioPath).length,
    withText: prompts.filter(p => p.text && p.text.trim()).length,
    withTranslation: prompts.filter(p => p.translation && p.translation.trim()).length,
    withNotes: prompts.filter(p => p.notes && p.notes.trim()).length
  };
}
