/**
 * modules/project-actions.js
 * 
 * Project CRUD operaties
 * Afgesplitst uit app.js voor betere organisatie
 */

import { uuid, slugify, readJsonFile, writeJsonFile } from "./utils.js";
import { showError } from "./dialogs.js";
import { t } from "./i18n.js";
import { FILE_NAMES, DIR_NAMES, SCENE_DEFAULTS } from "./constants.js";

/**
 * Maak een nieuw project aan in de projectenmap
 * 
 * @param {Object} params - Parameters
 * @param {FileSystemDirectoryHandle} params.projectenHandle - Projecten directory
 * @param {FileSystemHandle} params.indexHandle - Index file handle
 * @param {Object} params.indexData - Huidige index data
 * @param {string} params.projectName - Naam van het nieuwe project
 * @param {string} params.videoGenerator - Video generator naam
 * @param {string} params.notes - Project notities
 * @returns {Promise<{projectId: string, projectData: Object}>} - Nieuw project data
 */
export async function createNewProject({ 
  projectenHandle, 
  indexHandle, 
  indexData, 
  projectName, 
  videoGenerator = "", 
  notes = "" 
}) {
  if (!projectenHandle || !indexHandle) {
    throw new Error("Projectenmap of index niet beschikbaar");
  }

  const rawSlug = slugify(projectName);
  let slug = rawSlug;
  let counter = 1;
  const existingSlugs = new Set(indexData.projects.map((project) => project.slug));
  while (existingSlugs.has(slug)) {
    slug = `${rawSlug}-${counter++}`;
  }

  const createdAt = new Date().toISOString();
  const projectDir = await projectenHandle.getDirectoryHandle(slug, { create: true });
  const imagesDir = await projectDir.getDirectoryHandle(DIR_NAMES.IMAGES, { create: true });
  await imagesDir; // Ensure it's created

  const projectJsonHandle = await projectDir.getFileHandle(FILE_NAMES.PROJECT, { create: true });
  const projectId = uuid();
  
  const projectData = {
    id: projectId,
    projectName,
    videoGenerator,
    notes,
    createdAt,
    updatedAt: createdAt,
    prompts: [],
    transitions: [],
  };

  await writeJsonFile(projectJsonHandle, projectData);

  // Update index
  indexData.projects.push({
    id: projectId,
    projectName,
    slug,
    createdAt,
    updatedAt: createdAt,
    promptCount: 0,
    videoGenerator,
    notes,
  });
  
  await writeJsonFile(indexHandle, indexData);

  return { projectId, projectData, slug };
}

/**
 * Dupliceer een bestaand project
 * 
 * @param {Object} params - Parameters
 * @param {FileSystemDirectoryHandle} params.projectenHandle - Projecten directory
 * @param {FileSystemDirectoryHandle} params.sourceProjectDirHandle - Source project directory
 * @param {FileSystemDirectoryHandle} params.sourceImagesHandle - Source images directory
 * @param {FileSystemDirectoryHandle} params.sourceVideosHandle - Source videos directory
 * @param {FileSystemDirectoryHandle} params.sourceAttachmentsHandle - Source attachments directory
 * @param {FileSystemHandle} params.indexHandle - Index file handle
 * @param {Object} params.indexData - Huidige index data
 * @param {Object} params.sourceProjectData - Source project data
 * @param {string} params.newName - Naam voor de kopie
 * @returns {Promise<{projectId: string, projectData: Object}>} - Nieuw project data
 */
export async function duplicateProject({
  projectenHandle,
  sourceProjectDirHandle,
  sourceImagesHandle,
  sourceVideosHandle,
  sourceAttachmentsHandle,
  indexHandle,
  indexData,
  sourceProjectData,
  newName
}) {
  const slugBase = slugify(newName);
  const existing = new Set(indexData.projects.map((p) => p.slug));
  let slug = slugBase;
  let i = 1;
  while (existing.has(slug)) {
    slug = `${slugBase}-${i++}`;
  }

  const projectDir = await projectenHandle.getDirectoryHandle(slug, { create: true });
  const imagesDir = await projectDir.getDirectoryHandle(DIR_NAMES.IMAGES, { create: true });
  const videosDir = await projectDir.getDirectoryHandle(DIR_NAMES.VIDEOS, { create: true });
  const attachmentsDir = await projectDir.getDirectoryHandle(DIR_NAMES.ATTACHMENTS, { create: true });
  
  const newProjectId = uuid();
  const createdAt = new Date().toISOString();
  
  const newProjectData = {
    id: newProjectId,
    projectName: newName,
    videoGenerator: sourceProjectData.videoGenerator ?? "",
    notes: sourceProjectData.notes ?? "",
    createdAt,
    updatedAt: createdAt,
    prompts: [],
    transitions: sourceProjectData.transitions ? JSON.parse(JSON.stringify(sourceProjectData.transitions)) : [],
    audioTimeline: sourceProjectData.audioTimeline ? JSON.parse(JSON.stringify(sourceProjectData.audioTimeline)) : undefined,
  };

  // Kopieer prompts
  for (const oldPrompt of sourceProjectData.prompts || []) {
    const newPrompt = {
      ...oldPrompt,
      id: uuid(),
    };
    newProjectData.prompts.push(newPrompt);
  }

  // Kopieer afbeeldingen
  if (sourceImagesHandle) {
    for await (const entry of sourceImagesHandle.values()) {
      if (entry.kind === "file") {
        const sourceFile = await sourceImagesHandle.getFileHandle(entry.name);
        const file = await sourceFile.getFile();
        const destFile = await imagesDir.getFileHandle(entry.name, { create: true });
        const writable = await destFile.createWritable();
        await writable.write(file);
        await writable.close();
      }
    }
  }

  // Kopieer videos
  if (sourceVideosHandle) {
    for await (const entry of sourceVideosHandle.values()) {
      if (entry.kind === "file") {
        const sourceFile = await sourceVideosHandle.getFileHandle(entry.name);
        const file = await sourceFile.getFile();
        const destFile = await videosDir.getFileHandle(entry.name, { create: true });
        const writable = await destFile.createWritable();
        await writable.write(file);
        await writable.close();
      }
    }
  }

  // Kopieer attachments
  if (sourceAttachmentsHandle) {
    for await (const entry of sourceAttachmentsHandle.values()) {
      if (entry.kind === "file") {
        const sourceFile = await sourceAttachmentsHandle.getFileHandle(entry.name);
        const file = await sourceFile.getFile();
        const destFile = await attachmentsDir.getFileHandle(entry.name, { create: true });
        const writable = await destFile.createWritable();
        await writable.write(file);
        await writable.close();
      }
    }
  }

  // Sla nieuw project op
  const projectJsonHandle = await projectDir.getFileHandle(FILE_NAMES.PROJECT, { create: true });
  await writeJsonFile(projectJsonHandle, newProjectData);

  // Update index
  indexData.projects.push({
    id: newProjectId,
    projectName: newName,
    slug,
    createdAt,
    updatedAt: createdAt,
    promptCount: newProjectData.prompts.length,
    videoGenerator: newProjectData.videoGenerator,
    notes: newProjectData.notes,
    hasAudioTimeline: !!newProjectData.audioTimeline,
  });
  
  await writeJsonFile(indexHandle, indexData);

  return { projectId: newProjectId, projectData: newProjectData, slug };
}

/**
 * Verwijder een project
 * 
 * @param {Object} params - Parameters
 * @param {FileSystemDirectoryHandle} params.projectenHandle - Projecten directory
 * @param {FileSystemHandle} params.indexHandle - Index file handle
 * @param {Object} params.indexData - Huidige index data
 * @param {string} params.projectId - ID van project om te verwijderen
 * @returns {Promise<void>}
 */
export async function deleteProject({
  projectenHandle,
  indexHandle,
  indexData,
  projectId
}) {
  const projectEntry = indexData.projects.find((p) => p.id === projectId);
  if (!projectEntry) {
    throw new Error("Project niet gevonden");
  }

  try {
    await projectenHandle.removeEntry(projectEntry.slug, { recursive: true });
  } catch (error) {
    console.warn("Project map verwijderen mislukt:", error);
    // Continue anyway to remove from index
  }

  // Update index
  indexData.projects = indexData.projects.filter((p) => p.id !== projectId);
  await writeJsonFile(indexHandle, indexData);
}

/**
 * Update project metadata in index
 * 
 * @param {Object} params - Parameters
 * @param {FileSystemHandle} params.indexHandle - Index file handle
 * @param {Object} params.indexData - Index data
 * @param {string} params.projectId - Project ID
 * @param {Object} params.updates - Velden om te updaten
 * @returns {Promise<void>}
 */
export async function updateProjectMetadata({
  indexHandle,
  indexData,
  projectId,
  updates
}) {
  const project = indexData.projects.find((p) => p.id === projectId);
  if (!project) {
    throw new Error("Project niet gevonden in index");
  }

  Object.assign(project, updates, {
    updatedAt: new Date().toISOString()
  });

  await writeJsonFile(indexHandle, indexData);
}
