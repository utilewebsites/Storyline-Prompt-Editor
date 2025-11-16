/**
 * modules/scene-copy.js
 * 
 * Scene copy/duplicate functionaliteit
 * Afgesplitst uit app.js voor betere organisatie
 */

import { readJsonFile, writeJsonFile, uuid } from "./utils.js";
import { showError } from "./dialogs.js";
import { t } from "./i18n.js";
import { FILE_NAMES } from "./constants.js";
import { copyImageFile, copyVideoFile } from "./media-handlers.js";

/**
 * Kopieer een scene naar een ander project
 * 
 * @param {string} promptId - ID van te kopiëren scene
 * @param {string} targetProjectId - ID van doel project
 * @param {Object} state - Application state
 * @param {Map} imageMap - Image cache
 * @param {Map} videoMap - Video cache
 */
export async function copySceneToProject(promptId, targetProjectId, state, imageMap, videoMap) {
  if (!state.projectenHandle) {
    throw new Error("Geen project root");
  }

  const sourcePrompt = state.projectData.prompts.find((p) => p.id === promptId);
  if (!sourcePrompt) {
    throw new Error(t("errors.noSceneSelected"));
  }

  const targetMeta = state.indexData.projects.find((p) => p.id === targetProjectId);
  if (!targetMeta) {
    throw new Error("Target project not found");
  }

  // Open target project
  const targetDir = await state.projectenHandle.getDirectoryHandle(targetMeta.slug, { create: false });
  const targetProjectFile = await targetDir.getFileHandle(FILE_NAMES.PROJECT, { create: true });
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
    whatDoWeSee: sourcePrompt.whatDoWeSee ?? "",
    howDoWeMake: sourcePrompt.howDoWeMake ?? "",
    timeline: sourcePrompt.timeline ?? "",
  };

  // Copy image if exists
  if (sourcePrompt.imagePath && state.projectImagesHandle) {
    try {
      const extension = sourcePrompt.imagePath.split('.').pop();
      const targetFilename = `${newPrompt.id}.${extension}`;
      
      await copyImageFile(
        sourcePrompt.imagePath,
        state.projectImagesHandle,
        targetImagesDir,
        targetFilename
      );
      
      newPrompt.imagePath = targetFilename;
    } catch (error) {
      console.warn("Kopiëren afbeelding mislukt", error);
      newPrompt.imagePath = null;
    }
  }

  // Copy video if exists
  if (sourcePrompt.videoPath && state.projectVideosHandle) {
    try {
      const extension = sourcePrompt.videoPath.split('.').pop();
      const targetFilename = `${newPrompt.id}.${extension}`;
      
      await copyVideoFile(
        sourcePrompt.videoPath,
        state.projectVideosHandle,
        targetVideosDir,
        targetFilename
      );
      
      newPrompt.videoPath = targetFilename;
    } catch (error) {
      console.warn("Kopiëren video mislukt", error);
      newPrompt.videoPath = null;
    }
  }

  targetData.prompts.push(newPrompt);
  targetData.updatedAt = new Date().toISOString();
  await writeJsonFile(targetProjectFile, targetData);

  // If target project is currently open, update state
  if (state.selectedProjectId === targetProjectId) {
    state.projectData = targetData;
    
    // Rebuild image and video maps
    imageMap.clear();
    videoMap.clear();
    
    state.projectData.prompts.forEach((p) => {
      if (p.imagePath) imageMap.set(p.id, { filename: p.imagePath });
      if (p.videoPath) videoMap.set(p.id, { filename: p.videoPath });
    });
    
    return { needsRender: true };
  } else {
    // Update index entry for target project
    const entry = state.indexData.projects.find((p) => p.id === targetProjectId);
    if (entry) {
      entry.updatedAt = targetData.updatedAt;
      entry.promptCount = targetData.prompts.length;
      await writeJsonFile(state.indexHandle, state.indexData);
    }
    
    return { needsRender: false };
  }
}

/**
 * Dupliceer een scene binnen hetzelfde project
 * 
 * @param {string} promptId - ID van te dupliceren scene
 * @param {Object} state - Application state
 * @param {Map} imageMap - Image cache
 * @param {Map} videoMap - Video cache
 * @returns {Object} - New prompt object
 */
export async function duplicateSceneInProject(promptId, state, imageMap, videoMap) {
  const sourcePrompt = state.projectData.prompts.find((p) => p.id === promptId);
  if (!sourcePrompt) {
    throw new Error(t("errors.noSceneSelected"));
  }

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
    whatDoWeSee: sourcePrompt.whatDoWeSee ?? "",
    howDoWeMake: sourcePrompt.howDoWeMake ?? "",
    timeline: sourcePrompt.timeline ?? "",
  };

  // Copy image if exists (within same images directory)
  if (sourcePrompt.imagePath && state.projectImagesHandle) {
    try {
      const extension = sourcePrompt.imagePath.split('.').pop();
      const targetFilename = `${newPrompt.id}.${extension}`;
      
      await copyImageFile(
        sourcePrompt.imagePath,
        state.projectImagesHandle,
        state.projectImagesHandle,
        targetFilename
      );
      
      newPrompt.imagePath = targetFilename;
      imageMap.set(newPrompt.id, { filename: targetFilename });
    } catch (error) {
      console.warn("Dupliceren afbeelding mislukt", error);
    }
  }

  // Copy video if exists (within same videos directory)
  if (sourcePrompt.videoPath && state.projectVideosHandle) {
    try {
      const extension = sourcePrompt.videoPath.split('.').pop();
      const targetFilename = `${newPrompt.id}.${extension}`;
      
      await copyVideoFile(
        sourcePrompt.videoPath,
        state.projectVideosHandle,
        state.projectVideosHandle,
        targetFilename
      );
      
      newPrompt.videoPath = targetFilename;
      videoMap.set(newPrompt.id, { filename: targetFilename });
    } catch (error) {
      console.warn("Dupliceren video mislukt", error);
    }
  }

  // Insert after the original
  state.projectData.prompts.splice(index + 1, 0, newPrompt);
  
  return newPrompt;
}
