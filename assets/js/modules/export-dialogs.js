/**
 * modules/export-dialogs.js
 *
 * Beheert alle UI interacties rond export keuzes, previews, kopie acties
 * en afbeeldings-export zodat app.js enkel event-wiring hoeft te doen.
 */

import { copyToClipboard } from "./dialogs.js";
import { exportPromptsToText, exportSceneImages, exportSceneVideos, generatePromptsPreview } from "./export-handlers.js";

/**
 * Maak een controller voor exportdialogen.
 *
 * @param {Object} options - Benodigde dependencies
 * @param {Object} options.state - Centrale state store
 * @param {Object} options.localState - UI state (buffer voor previews)
 * @param {Object} options.elements - Verwijzingen naar DOM nodes
 * @param {Function} options.t - Vertaalhelper
 * @param {Function} options.showError - UI error helper
 * @param {Function} options.applyTranslations - Vertalingen toepassen op dialogen
 * @param {Function} options.getCurrentProjectDir - Helper om huidige projectmap op te halen
 * @returns {Object} Controller API
 */
export function createExportDialogsController({
  state,
  localState,
  elements,
  t,
  showError,
  applyTranslations,
  getCurrentProjectDir,
}) {
  function openChoiceDialog() {
    if (!elements.exportChoiceDialog) return;
    applyTranslations(elements.exportChoiceDialog);
    elements.exportChoiceDialog.showModal();
  }

  function openMediaChoiceDialog() {
    if (!elements.exportMediaChoiceDialog) return;
    applyTranslations(elements.exportMediaChoiceDialog);
    elements.exportMediaChoiceDialog.showModal();
  }

  function updatePreviewInfo(customKey, vars = {}) {
    if (!elements.exportPreviewInfo) return;
    const key = customKey || "exportPreview.description";
    elements.exportPreviewInfo.textContent = t(key, vars);
  }

  function clearPendingExport() {
    localState.pendingExportText = null;
    localState.pendingExportCount = 0;
    updatePreviewInfo();
  }

  async function startPromptExport(mode = "prompts") {
    if (!state.projectData) {
      showError(t("errors.noProjectSelected"));
      return;
    }
    const { text, count } = generatePromptsPreview(state.projectData.prompts, mode);
    if (!count) {
      showError(t("errors.noPrompts"));
      return;
    }
    localState.pendingExportText = text;
    localState.pendingExportCount = count;
    state.pendingExportMode = mode;
    if (elements.exportPreviewText) {
      elements.exportPreviewText.value = text;
    }
    updatePreviewInfo();
    if (elements.exportPreviewDialog) {
      elements.exportPreviewDialog.returnValue = "";
      applyTranslations(elements.exportPreviewDialog);
      elements.exportPreviewDialog.showModal();
    }
  }

  async function finalizePromptExport() {
    if (!state.projectData || !localState.pendingExportText) {
      return;
    }
    try {
      const projectDir = await getCurrentProjectDir();
      const mode = state.pendingExportMode || "prompts";
      const fileName = mode === "prompts" ? "prompts_export.txt" : "notes_export.txt";
      await exportPromptsToText({
        prompts: state.projectData.prompts,
        projectDirHandle: projectDir,
        mode,
        fileName,
      });
      if (elements.exportDialog && !elements.exportDialog.open) {
        applyTranslations(elements.exportDialog);
        elements.exportDialog.showModal();
      }
    } catch (error) {
      showError(t("errors.exportPrompts"), error);
    } finally {
      clearPendingExport();
    }
  }

  async function handlePreviewCopy() {
    if (!localState.pendingExportText) {
      showError(t("errors.noPrompts"));
      return;
    }
    try {
      await copyToClipboard(localState.pendingExportText);
      updatePreviewInfo("exportPreview.copied");
    } catch (error) {
      showError(t("errors.copyFailed"), error);
    }
  }

  async function handlePreviewClose() {
    if (!elements.exportPreviewDialog) return;
    const { returnValue } = elements.exportPreviewDialog;
    if (returnValue === "save") {
      await finalizePromptExport();
    } else {
      clearPendingExport();
    }
  }

  async function handleExportImages() {
    if (!state.projectData) {
      showError(t("errors.noProjectSelected"));
      return;
    }
    try {
      const parentDir = await getCurrentProjectDir();
      const slug = state.indexData.projects.find((project) => project.id === state.projectData.id)?.slug;
      const { exportDirName, exportedCount } = await exportSceneImages({
        prompts: state.projectData.prompts,
        projectName: state.projectData.projectName,
        projectDirHandle: parentDir,
        imagesHandle: state.projectImagesHandle,
        slug,
      });
      if (elements.imagesExportedDialog) {
        const detail = t("alerts.imagesExportedDetail", { dir: exportDirName, count: exportedCount });
        if (elements.imagesExportedMessage) {
          elements.imagesExportedMessage.textContent = detail;
        }
        if (elements.imagesExportedPath) {
          elements.imagesExportedPath.textContent = exportDirName;
        }
        applyTranslations(elements.imagesExportedDialog);
        elements.imagesExportedDialog.showModal();
      } else {
        window.alert(t("alerts.imagesExported", { dir: exportDirName }));
      }
    } catch (error) {
      showError(t("errors.exportImages"), error);
    }
  }

  async function handleExportVideos() {
    if (!state.projectData) {
      showError(t("errors.noProjectSelected"));
      return;
    }
    try {
      const parentDir = await getCurrentProjectDir();
      const slug = state.indexData.projects.find((project) => project.id === state.projectData.id)?.slug;
      const { exportDirName, exportedCount } = await exportSceneVideos({
        prompts: state.projectData.prompts,
        projectName: state.projectData.projectName,
        projectDirHandle: parentDir,
        videosHandle: state.projectVideosHandle,
        slug,
      });
      if (elements.imagesExportedDialog) {
        const detail = t("alerts.videosExportedDetail", { dir: exportDirName, count: exportedCount });
        if (elements.imagesExportedMessage) {
          elements.imagesExportedMessage.textContent = detail;
        }
        if (elements.imagesExportedPath) {
          elements.imagesExportedPath.textContent = exportDirName;
        }
        applyTranslations(elements.imagesExportedDialog);
        elements.imagesExportedDialog.showModal();
      } else {
        window.alert(t("alerts.videosExported", { dir: exportDirName }));
      }
    } catch (error) {
      showError(t("errors.exportVideos"), error);
    }
  }

  async function handleExportedCopy() {
    if (!elements.imagesExportedPath) return;
    const text = elements.imagesExportedPath.textContent || "";
    if (!text.length) return;
    try {
      await copyToClipboard(text);
      if (elements.imagesExportedCopy) {
        const copiedLabel = t("actions.copied") || "Gekopieerd";
        const copyLabel = t("actions.copyPath") || "Kopieer pad";
        elements.imagesExportedCopy.textContent = copiedLabel;
        setTimeout(() => {
          if (elements.imagesExportedCopy) {
            elements.imagesExportedCopy.textContent = copyLabel;
          }
        }, 1200);
      }
    } catch (error) {
      showError(t("errors.copyFailed"), error);
    }
  }

  function handleExportedClose() {
    elements.imagesExportedDialog?.close();
  }

  return {
    openChoiceDialog,
    openMediaChoiceDialog,
    startPromptExport,
    handlePreviewCopy,
    handlePreviewClose,
    handleExportImages,
    handleExportVideos,
    handleExportedCopy,
    handleExportedClose,
    updatePreviewInfo,
  };
}
