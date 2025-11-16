/**
 * modules/export-handlers.js
 * 
 * Export functionaliteit voor prompts, notities en afbeeldingen
 * Afgesplitst uit app.js voor betere organisatie
 */

import { writeTextFile } from "./utils.js";
import { copyToClipboard, showSuccess } from "./dialogs.js";
import { t } from "./i18n.js";
import { FILE_NAMES } from "./constants.js";

/**
 * Exporteer prompts naar tekstbestand en klembord
 * 
 * @param {Object} params - Parameters
 * @param {Array} params.prompts - Array van prompts om te exporteren
 * @param {FileSystemDirectoryHandle} params.projectDirHandle - Project directory
 * @param {string} params.mode - "prompts" of "notes"
 * @returns {Promise<string>} - Geëxporteerde tekst
 */
export async function exportPromptsToText({ prompts, projectDirHandle, mode = "prompts" }) {
  let text = "";
  
  if (mode === "prompts") {
    // Exporteer alleen prompts (Engels)
    text = prompts
      .map((prompt, index) => `${index + 1}. ${prompt.text || "(leeg)"}`)
      .join("\n\n");
  } else if (mode === "notes") {
    // Exporteer notities/vertalingen (Nederlands)
    text = prompts
      .map((prompt, index) => `${index + 1}. ${prompt.translation || "(leeg)"}`)
      .join("\n\n");
  }

  if (!text.trim()) {
    text = mode === "prompts" 
      ? t("export.noPrompts") 
      : t("export.noNotes");
  }

  // Schrijf naar bestand
  const filename = mode === "prompts" ? FILE_NAMES.EXPORTED_PROMPTS : FILE_NAMES.EXPORTED_NOTES;
  try {
    const fileHandle = await projectDirHandle.getFileHandle(filename, { create: true });
    await writeTextFile(fileHandle, text);
  } catch (error) {
    console.warn("Schrijven naar bestand mislukt:", error);
  }

  // Kopieer naar klembord
  try {
    await copyToClipboard(text);
  } catch (error) {
    console.warn("Kopiëren naar klembord mislukt:", error);
  }

  return text;
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
export async function exportSceneImages({ prompts, projectName, projectDirHandle, imagesHandle }) {
  // Maak export directory
  const exportDirName = `scene_images_${projectName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  let exportDir;
  
  try {
    exportDir = await projectDirHandle.getDirectoryHandle(exportDirName, { create: true });
  } catch (error) {
    throw new Error(t("errors.createExportDir"));
  }

  let exportedCount = 0;

  // Kopieer alle afbeeldingen
  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    if (!prompt.imagePath) continue;

    try {
      // Lees bron afbeelding
      const sourceFile = await imagesHandle.getFileHandle(prompt.imagePath);
      const file = await sourceFile.getFile();
      
      // Bepaal extensie
      const ext = prompt.imagePath.split('.').pop() || 'jpg';
      
      // Schrijf naar export directory met scene nummer
      const exportFilename = `scene_${(i + 1).toString().padStart(3, '0')}.${ext}`;
      const destFile = await exportDir.getFileHandle(exportFilename, { create: true });
      const writable = await destFile.createWritable();
      await writable.write(file);
      await writable.close();
      
      exportedCount++;
    } catch (error) {
      console.warn(`Afbeelding ${i + 1} exporteren mislukt:`, error);
    }
  }

  return {
    exportPath: exportDirName,
    count: exportedCount
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
  if (mode === "prompts") {
    return prompts
      .map((prompt, index) => `${index + 1}. ${prompt.text || "(leeg)"}`)
      .join("\n\n");
  } else {
    return prompts
      .map((prompt, index) => `${index + 1}. ${prompt.translation || "(leeg)"}`)
      .join("\n\n");
  }
}
