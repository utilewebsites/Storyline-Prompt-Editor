/**
 * modules/upload-handlers.js
 * 
 * Upload handlers voor afbeeldingen, video's en audio
 * Afgesplitst uit app.js voor betere organisatie
 */

import { showError } from "./dialogs.js";
import { t } from "./i18n.js";
import { uploadImage, uploadVideo, removeImage, removeVideo, loadImagePreview, loadVideoPreview } from "./media-handlers.js";

/**
 * Handle image upload voor een prompt
 * 
 * @param {string} promptId - Prompt ID
 * @param {File} file - Uploaded file
 * @param {HTMLElement} uploader - Uploader element
 * @param {Object} state - Application state
 * @param {Map} imageMap - Image cache
 * @param {Function} onDirty - Callback om project dirty te markeren
 */
export async function handleImageUpload(promptId, file, uploader, state, imageMap, onDirty) {
  const prompt = state.projectData.prompts.find((p) => p.id === promptId);
  if (!prompt) {
    throw new Error(t("errors.noSceneSelected"));
  }

  try {
    const filename = await uploadImage(prompt, file, state.projectImagesHandle, imageMap);
    
    // Update UI
    const placeholder = uploader.querySelector(".placeholder");
    const img = uploader.querySelector("img");
    
    uploader.dataset.hasImage = "true";
    placeholder.textContent = file.name;
    
    await loadImagePreview(filename, img, state.projectImagesHandle, promptId);
    
    onDirty();
  } catch (error) {
    console.error("Image upload failed:", error);
    throw error;
  }
}

/**
 * Handle image removal voor een prompt
 * 
 * @param {string} promptId - Prompt ID
 * @param {HTMLElement} uploader - Uploader element
 * @param {Object} state - Application state
 * @param {Map} imageMap - Image cache
 * @param {Function} onDirty - Callback om project dirty te markeren
 */
export async function handleImageRemove(promptId, uploader, state, imageMap, onDirty) {
  const prompt = state.projectData.prompts.find((p) => p.id === promptId);
  if (!prompt) {
    throw new Error(t("errors.noSceneSelected"));
  }

  try {
    await removeImage(prompt, state.projectImagesHandle, imageMap);
    
    // Update UI
    const placeholder = uploader.querySelector(".placeholder");
    const img = uploader.querySelector("img");
    
    uploader.dataset.hasImage = "false";
    placeholder.textContent = t("prompt.placeholderImage");
    img.removeAttribute("src");
    
    onDirty();
  } catch (error) {
    console.error("Image removal failed:", error);
    throw error;
  }
}

/**
 * Handle video upload voor een prompt
 * 
 * @param {string} promptId - Prompt ID
 * @param {File} file - Uploaded file
 * @param {HTMLElement} uploader - Uploader element
 * @param {Object} state - Application state
 * @param {Map} videoMap - Video cache
 * @param {Function} onDirty - Callback om project dirty te markeren
 */
export async function handleVideoUpload(promptId, file, uploader, state, videoMap, onDirty) {
  const prompt = state.projectData.prompts.find((p) => p.id === promptId);
  if (!prompt) {
    throw new Error(t("errors.noSceneSelected"));
  }

  try {
    const filename = await uploadVideo(prompt, file, state.projectVideosHandle, videoMap);
    
    // Update UI
    const placeholder = uploader.querySelector(".placeholder");
    const video = uploader.querySelector("video");
    
    uploader.dataset.hasVideo = "true";
    placeholder.textContent = file.name;
    
    await loadVideoPreview(filename, video, state.projectVideosHandle, promptId);
    
    onDirty();
  } catch (error) {
    console.error("Video upload failed:", error);
    throw error;
  }
}

/**
 * Handle video removal voor een prompt
 * 
 * @param {string} promptId - Prompt ID
 * @param {HTMLElement} uploader - Uploader element
 * @param {Object} state - Application state
 * @param {Map} videoMap - Video cache
 * @param {Function} onDirty - Callback om project dirty te markeren
 */
export async function handleVideoRemove(promptId, uploader, state, videoMap, onDirty) {
  const prompt = state.projectData.prompts.find((p) => p.id === promptId);
  if (!prompt) {
    throw new Error(t("errors.noSceneSelected"));
  }

  try {
    await removeVideo(prompt, state.projectVideosHandle, videoMap);
    
    // Update UI
    const placeholder = uploader.querySelector(".placeholder");
    const video = uploader.querySelector("video");
    
    uploader.dataset.hasVideo = "false";
    placeholder.textContent = t("prompt.placeholderVideo");
    video.removeAttribute("src");
    
    onDirty();
  } catch (error) {
    console.error("Video removal failed:", error);
    throw error;
  }
}
