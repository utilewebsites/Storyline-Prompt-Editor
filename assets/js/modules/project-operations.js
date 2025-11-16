/**
 * modules/project-operations.js
 * 
 * Project CRUD operaties: create, open, save, delete, duplicate
 * Afgesplitst uit app.js voor betere organisatie
 */

import { readJsonFile, writeJsonFile, uuid, slugify } from "./utils.js";
import { showError, showSuccess } from "./dialogs.js";
import { t } from "./i18n.js";
import { FILE_NAMES, DIR_NAMES, PROJECT_DEFAULTS } from "./constants.js";
import { copyImageFile, copyVideoFile } from "./media-handlers.js";

/**
 * Maak een nieuw project
 * 
 * @param {string} projectName - Project naam
 * @param {string} videoGenerator - Video generator naam
 * @param {string} notes - Project notities
 * @param {FileSystemDirectoryHandle} projectenHandle - Projecten directory
 * @param {FileSystemFileHandle} indexHandle - Index file
 * @param {Object} indexData - Index data
 * @returns {Promise<{projectId, slug, projectData}>}
 */
export async function createNewProject(projectName, videoGenerator, notes, projectenHandle, indexHandle, indexData) {
  const slug = slugify(projectName);
  const existing = indexData.projects.find((p) => p.slug === slug);
  
  if (existing) {
    throw new Error(t("errors.projectExists"));
  }

  const projectId = uuid();
  const createdAt = new Date().toISOString();

  const projectDir = await projectenHandle.getDirectoryHandle(slug, { create: true });
  await projectDir.getDirectoryHandle(DIR_NAMES.IMAGES, { create: true });
  await projectDir.getDirectoryHandle(DIR_NAMES.VIDEOS, { create: true });
  await projectDir.getDirectoryHandle(DIR_NAMES.ATTACHMENTS, { create: true });

  const projectData = {
    id: projectId,
    projectName,
    videoGenerator: videoGenerator ?? "",
    notes: notes ?? "",
    createdAt,
    updatedAt: createdAt,
    prompts: [],
    transitions: [],
  };

  const projectFile = await projectDir.getFileHandle(FILE_NAMES.PROJECT, { create: true });
  await writeJsonFile(projectFile, projectData);

  indexData.projects.push({
    id: projectId,
    projectName,
    slug,
    createdAt,
    updatedAt: createdAt,
    promptCount: 0,
    videoGenerator: videoGenerator ?? "",
    notes: notes ?? "",
  });

  await writeJsonFile(indexHandle, indexData);

  return { projectId, slug, projectData };
}

/**
 * Open een project en laad alle data
 * 
 * @param {string} projectId - Project ID
 * @param {FileSystemDirectoryHandle} projectenHandle - Projecten directory
 * @param {Object} indexData - Index data
 * @returns {Promise<{projectData, handles}>}
 */
export async function openProjectById(projectId, projectenHandle, indexData) {
  if (!projectenHandle) {
    throw new Error("Projectenmap niet beschikbaar");
  }

  const projectMeta = indexData.projects.find((project) => project.id === projectId);
  if (!projectMeta) {
    throw new Error("Project niet gevonden");
  }

  const projectDir = await projectenHandle.getDirectoryHandle(projectMeta.slug, { create: false });
  const imagesDir = await projectDir.getDirectoryHandle(DIR_NAMES.IMAGES, { create: true });
  const videosDir = await projectDir.getDirectoryHandle(DIR_NAMES.VIDEOS, { create: true });
  const attachmentsDir = await projectDir.getDirectoryHandle(DIR_NAMES.ATTACHMENTS, { create: true });
  const projectFile = await projectDir.getFileHandle(FILE_NAMES.PROJECT, { create: false });

  const projectData = await readJsonFile(projectFile);
  
  // Ensure required fields exist for backwards compatibility
  projectData.prompts ??= [];
  projectData.transitions ??= [];
  
  projectData.prompts.forEach((p) => {
    if (p.rating === undefined) p.rating = null;
    if (p.videoPath === undefined) p.videoPath = null;
    if (p.videoOriginalName === undefined) p.videoOriginalName = null;
    if (p.videoType === undefined) p.videoType = null;
    if (p.attachments === undefined) p.attachments = [];
    if (p.preferredMediaType === undefined) p.preferredMediaType = 'image';
  });
  
  projectData.createdAt ??= projectMeta.createdAt;
  projectData.updatedAt ??= projectMeta.updatedAt;
  projectData.videoGenerator ??= projectMeta.videoGenerator ?? "";
  projectData.notes ??= projectMeta.notes ?? "";

  return {
    projectData,
    handles: {
      projectFile,
      projectDir,
      imagesDir,
      videosDir,
      attachmentsDir
    },
    meta: projectMeta
  };
}

/**
 * Sla een project op
 * 
 * @param {Object} projectData - Project data
 * @param {FileSystemFileHandle} projectHandle - Project file handle
 * @param {FileSystemFileHandle} indexHandle - Index file handle
 * @param {Object} indexData - Index data
 */
export async function saveProjectData(projectData, projectHandle, indexHandle, indexData) {
  projectData.updatedAt = new Date().toISOString();
  await writeJsonFile(projectHandle, projectData);

  // Update index
  const entry = indexData.projects.find((p) => p.id === projectData.id);
  if (entry) {
    entry.projectName = projectData.projectName;
    entry.updatedAt = projectData.updatedAt;
    entry.promptCount = projectData.prompts.length;
    entry.videoGenerator = projectData.videoGenerator;
    entry.notes = projectData.notes;
    entry.hasAudioTimeline = Boolean(projectData.audioTimeline && projectData.audioTimeline.audioFileName);
    await writeJsonFile(indexHandle, indexData);
  }
}

/**
 * Verwijder een project
 * 
 * @param {string} projectId - Project ID
 * @param {FileSystemDirectoryHandle} projectenHandle - Projecten directory
 * @param {FileSystemFileHandle} indexHandle - Index file handle
 * @param {Object} indexData - Index data
 */
export async function deleteProject(projectId, projectenHandle, indexHandle, indexData) {
  const projectMeta = indexData.projects.find((p) => p.id === projectId);
  if (!projectMeta) {
    throw new Error("Project niet gevonden");
  }

  try {
    await projectenHandle.removeEntry(projectMeta.slug, { recursive: true });
  } catch (error) {
    console.warn("Project verwijderen mislukt:", error);
    throw error;
  }

  // Remove from index
  indexData.projects = indexData.projects.filter((p) => p.id !== projectId);
  await writeJsonFile(indexHandle, indexData);
}

/**
 * Dupliceer een project
 * 
 * @param {string} newName - Nieuwe project naam
 * @param {Object} currentProject - Huidige project data
 * @param {Object} handles - Project handles (dir, images, videos, attachments)
 * @param {FileSystemDirectoryHandle} projectenHandle - Projecten directory
 * @param {FileSystemFileHandle} indexHandle - Index file handle
 * @param {Object} indexData - Index data
 * @returns {Promise<string>} - Nieuw project ID
 */
export async function duplicateProject(newName, currentProject, handles, projectenHandle, indexHandle, indexData) {
  const slug = slugify(newName);
  const existing = indexData.projects.find((p) => p.slug === slug);
  
  if (existing) {
    throw new Error(t("errors.projectExists"));
  }

  const newProjectId = uuid();
  const createdAt = new Date().toISOString();

  // Create new project directories
  const projectDir = await projectenHandle.getDirectoryHandle(slug, { create: true });
  const imagesDir = await projectDir.getDirectoryHandle(DIR_NAMES.IMAGES, { create: true });
  const videosDir = await projectDir.getDirectoryHandle(DIR_NAMES.VIDEOS, { create: true });
  const attachmentsDir = await projectDir.getDirectoryHandle(DIR_NAMES.ATTACHMENTS, { create: true });
  const projectJsonHandle = await projectDir.getFileHandle(FILE_NAMES.PROJECT, { create: true });

  // Create new project data
  const newProjectData = {
    id: newProjectId,
    projectName: newName,
    videoGenerator: currentProject.videoGenerator ?? "",
    notes: currentProject.notes ?? "",
    createdAt,
    updatedAt: createdAt,
    prompts: [],
    transitions: [],
  };

  // Copy transitions
  if (currentProject.transitions && Array.isArray(currentProject.transitions)) {
    newProjectData.transitions = currentProject.transitions.map(t => ({
      sceneIndex: t.sceneIndex,
      description: t.description,
      updatedAt: createdAt
    }));
  }

  // Copy audio timeline
  if (currentProject.audioTimeline) {
    newProjectData.audioTimeline = {
      fileName: currentProject.audioTimeline.fileName,
      markers: [...(currentProject.audioTimeline.markers || [])],
      duration: currentProject.audioTimeline.duration,
      isActive: currentProject.audioTimeline.isActive
    };

    // Copy audio file
    if (currentProject.audioTimeline.fileName && handles.projectDir) {
      try {
        const audioFileHandle = await handles.projectDir.getFileHandle(currentProject.audioTimeline.fileName);
        const audioFile = await audioFileHandle.getFile();
        const targetAudioHandle = await projectDir.getFileHandle(currentProject.audioTimeline.fileName, { create: true });
        const writable = await targetAudioHandle.createWritable();
        await writable.write(await audioFile.arrayBuffer());
        await writable.close();
      } catch (error) {
        console.warn("Kopiëren van audio bestand mislukt", error);
      }
    }
  }

  // Copy prompts with media files
  for (const p of currentProject.prompts) {
    const newPrompt = {
      id: uuid(),
      text: p.text ?? "",
      translation: p.translation ?? "",
      imagePath: null,
      imageOriginalName: p.imageOriginalName ?? null,
      imageType: p.imageType ?? null,
      videoPath: null,
      videoOriginalName: p.videoOriginalName ?? null,
      videoType: p.videoType ?? null,
      rating: p.rating ?? null,
      isAudioLinked: p.isAudioLinked ?? false,
      audioMarkerIndex: p.audioMarkerIndex ?? undefined,
      audioMarkerTime: p.audioMarkerTime ?? undefined,
      timeline: p.timeline ?? undefined,
      duration: p.duration ?? undefined,
      whatDoWeSee: p.whatDoWeSee ?? "",
      howDoWeMake: p.howDoWeMake ?? "",
      preferredMediaType: p.preferredMediaType ?? undefined,
      attachments: p.attachments ? [...p.attachments] : undefined,
      transitions: p.transitions ? {...p.transitions} : undefined
    };

    // Copy image
    if (p.imagePath && handles.imagesDir) {
      try {
        const extension = p.imagePath.split('.').pop();
        const targetFilename = `${newPrompt.id}.${extension}`;
        await copyImageFile(p.imagePath, handles.imagesDir, imagesDir, targetFilename);
        newPrompt.imagePath = targetFilename;
      } catch (error) {
        console.warn("Kopiëren van afbeelding mislukt", error);
      }
    }

    // Copy video
    if (p.videoPath && handles.videosDir) {
      try {
        const extension = p.videoPath.split('.').pop();
        const targetFilename = `${newPrompt.id}.${extension}`;
        await copyVideoFile(p.videoPath, handles.videosDir, videosDir, targetFilename);
        newPrompt.videoPath = targetFilename;
      } catch (error) {
        console.warn("Kopiëren van video mislukt", error);
      }
    }

    // Copy attachments
    if (p.attachments && p.attachments.length > 0 && handles.attachmentsDir) {
      const copiedAttachments = [];
      for (const attachment of p.attachments) {
        const attachmentFilename = attachment.filename || attachment.fileName;
        if (!attachmentFilename) continue;

        try {
          const sourceHandle = await handles.attachmentsDir.getFileHandle(attachmentFilename);
          const sourceFile = await sourceHandle.getFile();
          const targetHandle = await attachmentsDir.getFileHandle(attachmentFilename, { create: true });
          const writable = await targetHandle.createWritable();
          await writable.write(await sourceFile.arrayBuffer());
          await writable.close();
          copiedAttachments.push({...attachment});
        } catch (error) {
          console.warn(`Kopiëren van attachment ${attachmentFilename} mislukt`, error);
        }
      }
      if (copiedAttachments.length > 0) {
        newPrompt.attachments = copiedAttachments;
      }
    }

    newProjectData.prompts.push(newPrompt);
  }

  await writeJsonFile(projectJsonHandle, newProjectData);

  // Add to index
  indexData.projects.push({
    id: newProjectId,
    projectName: newName,
    slug,
    createdAt,
    updatedAt: createdAt,
    promptCount: newProjectData.prompts.length,
    videoGenerator: newProjectData.videoGenerator,
    notes: newProjectData.notes,
  });
  
  await writeJsonFile(indexHandle, indexData);

  return newProjectId;
}
