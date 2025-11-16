/**
 * modules/media-handlers.js
 * 
 * Media upload, preview en handling functionaliteit
 * Afgesplitst uit app.js voor betere organisatie
 */

import { showError, showSuccess } from "./dialogs.js";
import { t } from "./i18n.js";
import { MIME_TYPES, LIMITS } from "./constants.js";
import { uuid } from "./utils.js";

/**
 * Laad image preview uit project directory
 * 
 * @param {string} imagePath - Pad naar afbeelding
 * @param {HTMLImageElement} imgElement - Image element
 * @param {FileSystemDirectoryHandle} imagesHandle - Images directory handle
 */
export async function loadImagePreview(imagePath, imgElement, imagesHandle) {
  if (!imagesHandle) return;
  try {
    const fileHandle = await imagesHandle.getFileHandle(imagePath);
    const file = await fileHandle.getFile();
    const blobUrl = URL.createObjectURL(file);
    imgElement.src = blobUrl;
  } catch (error) {
    console.warn("Voorvertoning laden mislukt", error);
  }
}

/**
 * Laad video preview uit project directory
 * 
 * @param {string} videoPath - Pad naar video
 * @param {HTMLVideoElement} videoElement - Video element
 * @param {FileSystemDirectoryHandle} videosHandle - Videos directory handle
 */
export async function loadVideoPreview(videoPath, videoElement, videosHandle) {
  if (!videosHandle) return;
  try {
    const fileHandle = await videosHandle.getFileHandle(videoPath);
    const file = await fileHandle.getFile();
    const blobUrl = URL.createObjectURL(file);
    videoElement.src = blobUrl;
    videoElement.load(); // Belangrijk: herlaad video element
  } catch (error) {
    console.warn("Video voorvertoning laden mislukt", error);
  }
}

/**
 * Upload afbeelding voor een prompt
 * 
 * @param {Object} prompt - Prompt object
 * @param {File} file - Te uploaden file
 * @param {FileSystemDirectoryHandle} imagesHandle - Images directory
 * @param {Map} imageMap - Image cache map
 * @returns {Promise<string>} - Filename van geüploade afbeelding
 */
export async function uploadImage(prompt, file, imagesHandle, imageMap) {
  if (!file.type.startsWith(MIME_TYPES.IMAGE_PREFIX)) {
    throw new Error(t("errors.invalidImageType"));
  }

  if (file.size > LIMITS.MAX_IMAGE_SIZE) {
    throw new Error(t("errors.imageTooLarge"));
  }

  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${uuid()}.${ext}`;

  try {
    const fileHandle = await imagesHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();

    // Update prompt
    prompt.imagePath = filename;
    prompt.imageOriginalName = file.name;
    prompt.imageType = file.type;

    // Update cache
    imageMap.set(prompt.id, { filename });

    return filename;
  } catch (error) {
    console.error("Afbeelding uploaden mislukt:", error);
    throw error;
  }
}

/**
 * Upload video voor een prompt
 * 
 * @param {Object} prompt - Prompt object
 * @param {File} file - Te uploaden file
 * @param {FileSystemDirectoryHandle} videosHandle - Videos directory
 * @param {Map} videoMap - Video cache map
 * @returns {Promise<string>} - Filename van geüploade video
 */
export async function uploadVideo(prompt, file, videosHandle, videoMap) {
  if (!file.type.startsWith(MIME_TYPES.VIDEO_PREFIX)) {
    throw new Error(t("errors.invalidVideoType"));
  }

  if (file.size > LIMITS.MAX_VIDEO_SIZE) {
    throw new Error(t("errors.videoTooLarge"));
  }

  const ext = file.name.split(".").pop() || "mp4";
  const filename = `${uuid()}.${ext}`;

  try {
    const fileHandle = await videosHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();

    // Update prompt
    prompt.videoPath = filename;
    prompt.videoOriginalName = file.name;
    prompt.videoType = file.type;

    // Update cache
    videoMap.set(prompt.id, { filename });

    return filename;
  } catch (error) {
    console.error("Video uploaden mislukt:", error);
    throw error;
  }
}

/**
 * Verwijder afbeelding van een prompt
 * 
 * @param {Object} prompt - Prompt object
 * @param {FileSystemDirectoryHandle} imagesHandle - Images directory
 * @param {Map} imageMap - Image cache map
 */
export async function removeImage(prompt, imagesHandle, imageMap) {
  if (!prompt.imagePath) return;

  try {
    // Verwijder bestand
    await imagesHandle.removeEntry(prompt.imagePath);
  } catch (error) {
    console.warn("Afbeelding verwijderen mislukt:", error);
  }

  // Update prompt
  prompt.imagePath = null;
  prompt.imageOriginalName = null;
  prompt.imageType = null;

  // Update cache
  imageMap.delete(prompt.id);
}

/**
 * Verwijder video van een prompt
 * 
 * @param {Object} prompt - Prompt object
 * @param {FileSystemDirectoryHandle} videosHandle - Videos directory
 * @param {Map} videoMap - Video cache map
 */
export async function removeVideo(prompt, videosHandle, videoMap) {
  if (!prompt.videoPath) return;

  try {
    // Verwijder bestand
    await videosHandle.removeEntry(prompt.videoPath);
  } catch (error) {
    console.warn("Video verwijderen mislukt:", error);
  }

  // Update prompt
  prompt.videoPath = null;
  prompt.videoOriginalName = null;
  prompt.videoType = null;

  // Update cache
  videoMap.delete(prompt.id);
}

/**
 * Kopieer afbeelding bestand van ene naar andere directory
 * 
 * @param {string} sourcePath - Bron bestandsnaam
 * @param {FileSystemDirectoryHandle} sourceHandle - Bron directory
 * @param {FileSystemDirectoryHandle} targetHandle - Doel directory
 * @param {string} targetFilename - Doel bestandsnaam
 */
export async function copyImageFile(sourcePath, sourceHandle, targetHandle, targetFilename) {
  const sourceFile = await sourceHandle.getFileHandle(sourcePath);
  const file = await sourceFile.getFile();
  
  const targetFile = await targetHandle.getFileHandle(targetFilename, { create: true });
  const writable = await targetFile.createWritable();
  await writable.write(await file.arrayBuffer());
  await writable.close();
}

/**
 * Kopieer video bestand van ene naar andere directory
 * 
 * @param {string} sourcePath - Bron bestandsnaam
 * @param {FileSystemDirectoryHandle} sourceHandle - Bron directory
 * @param {FileSystemDirectoryHandle} targetHandle - Doel directory
 * @param {string} targetFilename - Doel bestandsnaam
 */
export async function copyVideoFile(sourcePath, sourceHandle, targetHandle, targetFilename) {
  const sourceFile = await sourceHandle.getFileHandle(sourcePath);
  const file = await sourceFile.getFile();
  
  const targetFile = await targetHandle.getFileHandle(targetFilename, { create: true });
  const writable = await targetFile.createWritable();
  await writable.write(await file.arrayBuffer());
  await writable.close();
}

/**
 * Render star widget voor rating
 * 
 * @param {HTMLElement} container - Container element
 * @param {number} currentValue - Huidige rating (0-5)
 * @param {Function} onChange - Callback bij wijziging
 */
export function renderStarWidget(container, currentValue = 0, onChange = () => {}) {
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
      // Re-render
      renderStarWidget(container, val, onChange);
    });
    
    container.appendChild(star);
  }
}

/**
 * Valideer media bestand type en grootte
 * 
 * @param {File} file - Te valideren file
 * @param {string} mediaType - "image" of "video"
 * @returns {{valid: boolean, error?: string}}
 */
export function validateMediaFile(file, mediaType) {
  if (mediaType === "image") {
    if (!file.type.startsWith(MIME_TYPES.IMAGE_PREFIX)) {
      return { valid: false, error: t("errors.invalidImageType") };
    }
    if (file.size > LIMITS.MAX_IMAGE_SIZE) {
      return { valid: false, error: t("errors.imageTooLarge") };
    }
  } else if (mediaType === "video") {
    if (!file.type.startsWith(MIME_TYPES.VIDEO_PREFIX)) {
      return { valid: false, error: t("errors.invalidVideoType") };
    }
    if (file.size > LIMITS.MAX_VIDEO_SIZE) {
      return { valid: false, error: t("errors.videoTooLarge") };
    }
  }
  
  return { valid: true };
}
