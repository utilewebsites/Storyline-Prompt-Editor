/**
 * modules/scenes.js
 * 
 * Scènemanagement:
 * - CRUD operaties op scenes (prompts)
 * - Afbeelding en video upload/verwijdering
 * - Sleep-to-reorder logica
 * 
 * Elke scene bevat:
 * - Text (Engelse prompt)
 * - Translation (Nederlandse vertaling/notities)
 * - ImagePath (optioneel, bijv. "uuid.jpg")
 * - VideoPath (optioneel, bijv. "uuid.mp4")
 */

import { uuid, writeJsonFile } from "./utils.js";

/**
 * Voeg een nieuwe lege scene toe aan het huidige project
 * Genereert unieke ID en initialiseer alle velden
 * 
 * @param {Object} state - App state
 * @param {Object} elements - DOM elements
 * @param {Function} flagProjectDirty - Callback om te markeren dat project gewijzigd is
 */
export function addPrompt(state, elements, flagProjectDirty) {
  if (!state.projectData) return null;
  const prompt = {
    id: uuid(),
    text: "",
    translation: "",
    imagePath: null,
    imageOriginalName: null,
    imageType: null,
    videoPath: null,
    videoOriginalName: null,
    videoType: null,
    rating: null,
    // Traditional video storyline fields
    whatDoWeSee: "",
    howDoWeMake: "",
    timeline: "",
    duration: "",
  };
  state.projectData.prompts.push(prompt);
  flagProjectDirty();
  return prompt;
}

/**
 * Verwijder een scene en alle bijbehorende bestanden
 * - Verwijdert de afbeelding (indien aanwezig)
 * - Verwijdert de video (indien aanwezig)
 * 
 * @param {string} promptId - ID van de te verwijderen scene
 * @param {Object} state - App state
 * @param {Object} elements - DOM elements
 * @returns {Promise<void>}
 */
export async function deletePrompt(promptId, state, elements) {
  if (!state.projectData) return;
  const idx = state.projectData.prompts.findIndex((p) => p.id === promptId);
  if (idx === -1) return;

  const prompt = state.projectData.prompts[idx];

  // Verwijder bijbehorende afbeelding
  if (prompt.imagePath && state.projectImagesHandle) {
    try {
      await state.projectImagesHandle.removeEntry(prompt.imagePath);
    } catch (error) {
      console.warn("Afbeelding verwijderen mislukt", error);
    }
  }

  // Verwijder bijbehorende video
  if (prompt.videoPath && state.projectVideosHandle) {
    try {
      await state.projectVideosHandle.removeEntry(prompt.videoPath);
    } catch (error) {
      console.warn("Video verwijderen mislukt", error);
    }
  }

  state.projectData.prompts.splice(idx, 1);
  state.isDirty = true;
}

/**
 * Verplaats een scene omhoog of omlaag in de reeks
 * Gebruikt sleepbare drag-handle interactie in UI
 * 
 * @param {string} promptId - ID van te verplaatsen scene
 * @param {number} direction - -1 (omhoog) of +1 (omlaag)
 * @param {Object} state - App state
 */
export function movePrompt(promptId, direction, state) {
  if (!state.projectData) return;
  const idx = state.projectData.prompts.findIndex((p) => p.id === promptId);
  if (idx === -1) return;

  if (direction === -1 && idx > 0) {
    // Swap met vorige scene
    [state.projectData.prompts[idx], state.projectData.prompts[idx - 1]] = [
      state.projectData.prompts[idx - 1],
      state.projectData.prompts[idx],
    ];
    state.isDirty = true;
  } else if (direction === 1 && idx < state.projectData.prompts.length - 1) {
    // Swap met volgende scene
    [state.projectData.prompts[idx], state.projectData.prompts[idx + 1]] = [
      state.projectData.prompts[idx + 1],
      state.projectData.prompts[idx],
    ];
    state.isDirty = true;
  }
}

/**
 * Wijs een afbeelding toe aan een scene
 * - Slaat bestand op in projectImagesHandle
 * - Hernoemt vorige afbeelding (als aanwezig)
 * - Registreert pad in prompt.imagePath
 * 
 * @param {string} promptId - ID van de scene
 * @param {File} file - Gekozen afbeeldingsbestand
 * @param {Object} state - App state
 * @param {Element} uploader - UI element (voor feedback)
 * @param {Map} imageMap - Cache van afbeelding-metadata
 * @returns {Promise<void>}
 * @throws {Error} - Bij bestandsschrijf-fouten
 */
export async function assignImageToPrompt(promptId, file, state, uploader, imageMap) {
  if (!file) return;
  if (!state.projectData || !state.projectImagesHandle) return;

  const prompt = state.projectData.prompts.find((p) => p.id === promptId);
  if (!prompt) return;

  try {
    const extension = file.name.split(".").pop();
    const filename = `${promptId}.${extension}`;
    const fileHandle = await state.projectImagesHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();

    // Verwijder vorige afbeelding (als dat anders heette)
    if (prompt.imagePath && prompt.imagePath !== filename) {
      try {
        await state.projectImagesHandle.removeEntry(prompt.imagePath);
      } catch (error) {
        console.warn("Oude afbeelding verwijderen mislukt", error);
      }
    }

    prompt.imagePath = filename;
    prompt.imageOriginalName = file.name;
    prompt.imageType = file.type;
    imageMap.set(promptId, { filename });

    if (uploader) {
      uploader.dataset.hasImage = "true";
    }
    state.isDirty = true;
  } catch (error) {
    console.error("Afbeelding opslaan mislukt", error);
    throw error;
  }
}

/**
 * Wijs een video toe aan een scene
 * - Slaat bestand op in projectVideosHandle (aparte map)
 * - Steunt MP4 en WebM formaten
 * - Hernoemt vorige video (als aanwezig)
 * 
 * @param {string} promptId - ID van de scene
 * @param {File} file - Gekozen videobestand
 * @param {Object} state - App state
 * @param {Map} videoMap - Cache van video-metadata
 * @returns {Promise<void>}
 * @throws {Error} - Bij bestandsschrijf-fouten
 */
export async function assignVideoToPrompt(promptId, file, state, videoMap) {
  if (!file) return;
  if (!state.projectData || !state.projectVideosHandle) return;

  const prompt = state.projectData.prompts.find((p) => p.id === promptId);
  if (!prompt) return;

  try {
    const extension = file.name.split(".").pop();
    const filename = `${promptId}.${extension}`;
    const fileHandle = await state.projectVideosHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();

    // Verwijder vorige video (als dat anders heette)
    if (prompt.videoPath && prompt.videoPath !== filename) {
      try {
        await state.projectVideosHandle.removeEntry(prompt.videoPath);
      } catch (error) {
        console.warn("Oude video verwijderen mislukt", error);
      }
    }

    prompt.videoPath = filename;
    prompt.videoOriginalName = file.name;
    prompt.videoType = file.type;
    videoMap.set(promptId, { filename });

    state.isDirty = true;
  } catch (error) {
    console.error("Video opslaan mislukt", error);
    throw error;
  }
}

/**
 * Verwijder de afbeelding van een scene
 * - Verwijdert het bestand uit projectImagesHandle
 * - Wist de referentie uit prompt object
 * 
 * @param {string} promptId - ID van de scene
 * @param {Object} state - App state
 * @param {Element} uploader - UI element (voor feedback)
 * @param {Map} imageMap - Cache om bij te werken
 * @returns {Promise<void>}
 */
export async function removeImageFromPrompt(promptId, state, uploader, imageMap) {
  if (!state.projectData) return;
  const prompt = state.projectData.prompts.find((p) => p.id === promptId);
  if (!prompt) return;

  if (prompt.imagePath && state.projectImagesHandle) {
    try {
      await state.projectImagesHandle.removeEntry(prompt.imagePath);
    } catch (error) {
      console.warn("Afbeelding verwijderen mislukt", error);
    }
  }

  prompt.imagePath = null;
  prompt.imageOriginalName = null;
  prompt.imageType = null;
  imageMap.delete(promptId);

  if (uploader) {
    uploader.dataset.hasImage = "false";
  }
  state.isDirty = true;
}

/**
 * Verwijder de video van een scene
 * - Verwijdert het bestand uit projectVideosHandle
 * - Wist de referentie uit prompt object
 * 
 * @param {string} promptId - ID van de scene
 * @param {Object} state - App state
 * @param {Map} videoMap - Cache om bij te werken
 * @returns {Promise<void>}
 */
export async function removeVideoFromPrompt(promptId, state, videoMap) {
  if (!state.projectData) return;
  const prompt = state.projectData.prompts.find((p) => p.id === promptId);
  if (!prompt) return;

  if (prompt.videoPath && state.projectVideosHandle) {
    try {
      await state.projectVideosHandle.removeEntry(prompt.videoPath);
    } catch (error) {
      console.warn("Video verwijderen mislukt", error);
    }
  }

  prompt.videoPath = null;
  prompt.videoOriginalName = null;
  prompt.videoType = null;
  videoMap.delete(promptId);

  state.isDirty = true;
}
