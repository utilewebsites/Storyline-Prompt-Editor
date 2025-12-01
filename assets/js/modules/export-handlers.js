/**
 * modules/export-handlers.js
 * 
 * Export functionaliteit voor prompts, notities en afbeeldingen
 * Afgesplitst uit app.js voor betere organisatie
 */

import { writeTextFile } from "./utils.js";
import { copyToClipboard } from "./dialogs.js";
import { FILE_NAMES } from "./constants.js";

function normaliseerPromptTekst(waarde) {
  if (typeof waarde !== "string") {
    return "";
  }
  return waarde.replace(/\s+/g, " ").trim();
}

function verzamelExportRegels(prompts = [], mode = "prompts") {
  return prompts
    .map((prompt) => {
      const bron = mode === "notes" ? prompt.translation : prompt.text;
      return normaliseerPromptTekst(bron ?? "");
    })
    .filter((regel) => regel.length > 0);
}

/**
 * Exporteer prompts naar tekstbestand en klembord
 * 
 * @param {Object} params - Parameters
 * @param {Array} params.prompts - Array van prompts om te exporteren
 * @param {FileSystemDirectoryHandle} params.projectDirHandle - Project directory
 * @param {string} params.mode - "prompts" of "notes"
 * @returns {Promise<string>} - Geëxporteerde tekst
 */
export async function exportPromptsToText({ prompts, projectDirHandle, mode = "prompts", fileName } = {}) {
  const regels = verzamelExportRegels(prompts, mode);
  if (!regels.length) {
    throw new Error("NO_PROMPTS_AVAILABLE");
  }
  const tekst = regels.join("\n\n");
  const bestand = fileName || (mode === "prompts" ? FILE_NAMES.EXPORTED_PROMPTS : FILE_NAMES.EXPORTED_NOTES);
  const fileHandle = await projectDirHandle.getFileHandle(bestand, { create: true });
  await writeTextFile(fileHandle, tekst);
  await copyToClipboard(tekst);
  return { text: tekst, count: regels.length, fileName: bestand };
}

/**
 * Exporteer alle scene afbeeldingen naar een aparte map
 * 
 * @param {Object} params - Parameters
 * @param {Array} params.prompts - Array van prompts
 * @param {string} params.projectName - Project naam
 * @param {FileSystemDirectoryHandle} params.projectDirHandle - Project directory
 * @param {FileSystemDirectoryHandle} params.imagesHandle - Images directory
 * @returns {Promise<{exportPath: string, count: number}>} - Export resultaat
 */
export async function exportSceneImages({
  prompts = [],
  projectName,
  slug,
  projectDirHandle,
  imagesHandle,
}) {
  if (!projectDirHandle) {
    throw new Error("PROJECT_DIR_HANDLE_MISSING");
  }
  if (!imagesHandle) {
    throw new Error("IMAGES_HANDLE_MISSING");
  }

  const basisNaam = slug || (projectName ? projectName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() : "project");
  const exportDirName = `scene_images_${basisNaam}`;
  const exportDir = await projectDirHandle.getDirectoryHandle(exportDirName, { create: true });

  const nieuweBestanden = new Set();
  let teller = 1;
  for (const prompt of prompts) {
    if (prompt?.imagePath) {
      try {
        await imagesHandle.getFileHandle(prompt.imagePath);
        nieuweBestanden.add(teller);
      } catch (error) {
        console.warn(`Afbeelding ${prompt.imagePath} niet beschikbaar`, error);
      }
    }
    teller += 1;
  }

  for await (const entry of exportDir.values()) {
    if (entry.kind === "file") {
      const nummer = parseInt(entry.name.split('.')[0], 10);
      if (!Number.isNaN(nummer) && !nieuweBestanden.has(nummer)) {
        try {
          await exportDir.removeEntry(entry.name);
        } catch (error) {
          console.warn(`Verwijderen van ${entry.name} mislukt`, error);
        }
      }
    }
  }

  teller = 1;
  let exportedCount = 0;
  for (const prompt of prompts) {
    if (!prompt?.imagePath) {
      teller += 1;
      continue;
    }
    try {
      const sourceHandle = await imagesHandle.getFileHandle(prompt.imagePath);
      const sourceFile = await sourceHandle.getFile();
      const extension = prompt.imagePath.split('.').pop();
      const targetName = `${teller}.${extension}`;
      const targetHandle = await exportDir.getFileHandle(targetName, { create: true });
      const writable = await targetHandle.createWritable();
      await writable.write(await sourceFile.arrayBuffer());
      await writable.close();
      exportedCount += 1;
    } catch (error) {
      console.warn(`Afbeelding ${prompt.imagePath} exporteren mislukt`, error);
    }
    teller += 1;
  }

  return {
    exportDirName,
    exportedCount,
  };
}

/**
 * Exporteer alle scene video's naar een aparte map
 * 
 * @param {Object} params - Parameters
 * @param {Array} params.prompts - Array van prompts
 * @param {string} params.projectName - Project naam
 * @param {FileSystemDirectoryHandle} params.projectDirHandle - Project directory
 * @param {FileSystemDirectoryHandle} params.videosHandle - Videos directory
 * @returns {Promise<{exportPath: string, count: number}>} - Export resultaat
 */
export async function exportSceneVideos({
  prompts = [],
  projectName,
  slug,
  projectDirHandle,
  videosHandle,
}) {
  if (!projectDirHandle) {
    throw new Error("PROJECT_DIR_HANDLE_MISSING");
  }
  if (!videosHandle) {
    throw new Error("VIDEOS_HANDLE_MISSING");
  }

  const basisNaam = slug || (projectName ? projectName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() : "project");
  const exportDirName = `scene_videos_${basisNaam}`;
  const exportDir = await projectDirHandle.getDirectoryHandle(exportDirName, { create: true });

  const nieuweBestanden = new Set();
  let teller = 1;
  for (const prompt of prompts) {
    if (prompt?.videoPath) {
      try {
        await videosHandle.getFileHandle(prompt.videoPath);
        nieuweBestanden.add(teller);
      } catch (error) {
        console.warn(`Video ${prompt.videoPath} niet beschikbaar`, error);
      }
    }
    teller += 1;
  }

  for await (const entry of exportDir.values()) {
    if (entry.kind === "file") {
      const nummer = parseInt(entry.name.split('.')[0], 10);
      if (!Number.isNaN(nummer) && !nieuweBestanden.has(nummer)) {
        try {
          await exportDir.removeEntry(entry.name);
        } catch (error) {
          console.warn(`Verwijderen van ${entry.name} mislukt`, error);
        }
      }
    }
  }

  teller = 1;
  let exportedCount = 0;
  for (const prompt of prompts) {
    if (!prompt?.videoPath) {
      teller += 1;
      continue;
    }
    try {
      const sourceHandle = await videosHandle.getFileHandle(prompt.videoPath);
      const sourceFile = await sourceHandle.getFile();
      const extension = prompt.videoPath.split('.').pop();
      const targetName = `${teller}.${extension}`;
      const targetHandle = await exportDir.getFileHandle(targetName, { create: true });
      const writable = await targetHandle.createWritable();
      await writable.write(await sourceFile.arrayBuffer());
      await writable.close();
      exportedCount += 1;
    } catch (error) {
      console.warn(`Video ${prompt.videoPath} exporteren mislukt`, error);
    }
    teller += 1;
  }

  return {
    exportDirName,
    exportedCount,
  };
}

/**
 * Genereer een tekst preview van de prompts
 * 
 * @param {Array} prompts - Array van prompts
 * @param {string} mode - "prompts" of "notes"
 * @returns {string} - Preview tekst
 */
export function generatePromptsPreview(prompts, mode = "prompts") {
  const regels = verzamelExportRegels(prompts, mode);
  return {
    text: regels.join("\n\n"),
    count: regels.length,
  };
}
